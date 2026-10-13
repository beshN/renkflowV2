import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';

import { recordAudit } from '@/lib/audit/audit-log';
import { openSecret, sealSecret } from '@/lib/security/secret-box';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp';

// Two-step sign-in. Every function takes the database client (pool or open transaction).

type Db = any;

const PURPOSE = 'auth.totp_secret';
const ISSUER = 'RenkFlow';
const RECOVERY_CODES = 10;
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export class MfaError extends Error {}

function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.toLowerCase().replace(/[^a-z0-9]/g, '')).digest('hex');
}

function newRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODES }, () => {
    const bytes = randomBytes(8);
    const chars = Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('');
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
}

/** Until migration 052 is applied the feature is simply off; sign-in must keep working. */
async function tableReady(db: Db): Promise<boolean> {
  const [row] = await db`SELECT to_regclass('public.user_mfa') IS NOT NULL AS ready`;
  return Boolean(row?.ready);
}

export async function isMfaEnabled(db: Db, userId: string): Promise<boolean> {
  if (!(await tableReady(db))) return false;
  const [row] = await db`SELECT 1 FROM user_mfa WHERE user_id = ${userId} AND enabled_at IS NOT NULL`;
  return Boolean(row);
}

export async function getMfaState(db: Db, userId: string) {
  if (!(await tableReady(db))) return { available: false, enabled: false, recoveryCodesLeft: 0 };
  const [row] = await db`SELECT enabled_at, cardinality(recovery_code_hashes) AS left FROM user_mfa WHERE user_id = ${userId}`;
  return { available: true, enabled: Boolean(row?.enabled_at), recoveryCodesLeft: row?.enabled_at ? Number(row.left) : 0 };
}

/** New secret for the authenticator app. Not active until confirmMfaSetup accepts a code from it. */
export async function startMfaSetup(db: Db, input: { userId: string; email: string }) {
  if (!(await tableReady(db))) throw new MfaError('İki adımlı doğrulama henüz etkin değil.');
  const [existing] = await db`SELECT enabled_at FROM user_mfa WHERE user_id = ${input.userId}`;
  if (existing?.enabled_at) throw new MfaError('İki adımlı doğrulama zaten açık.');
  const secret = generateTotpSecret();
  await db`
    INSERT INTO user_mfa (user_id, secret_sealed) VALUES (${input.userId}, ${sealSecret(secret, PURPOSE)})
    ON CONFLICT (user_id) DO UPDATE SET secret_sealed = EXCLUDED.secret_sealed, last_used_step = NULL, updated_at = now()
  `;
  const uri = otpauthUri(secret, input.email, ISSUER);
  return { secret, uri, qrDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
}

/** Turns two-step sign-in on and returns the recovery codes, shown to the user once. */
export async function confirmMfaSetup(db: Db, input: { userId: string; tenantId: string; code: string }): Promise<string[]> {
  return db.begin(async (tx: Db) => {
    const [row] = await tx`SELECT secret_sealed, enabled_at FROM user_mfa WHERE user_id = ${input.userId} FOR UPDATE`;
    if (!row) throw new MfaError('Önce kurulumu başlatın.');
    if (row.enabled_at) throw new MfaError('İki adımlı doğrulama zaten açık.');
    const step = verifyTotp(openSecret(row.secret_sealed, PURPOSE)!, input.code);
    if (step === null) throw new MfaError('Kod doğrulanamadı. Uygulamadaki güncel kodu girin.');
    const codes = newRecoveryCodes();
    await tx`
      UPDATE user_mfa SET enabled_at = now(), last_used_step = ${step},
        recovery_code_hashes = ${codes.map(hashRecoveryCode)}, updated_at = now()
      WHERE user_id = ${input.userId}
    `;
    await recordAudit(tx, { tenantId: input.tenantId, actorId: input.userId, entityType: 'user', entityId: input.userId, action: 'mfa_enabled' });
    return codes;
  });
}

/**
 * Checks a sign-in code: an authenticator code (once per step) or an unused recovery code
 * (consumed). Runs in its own transaction so two parallel requests cannot both use one code.
 */
export async function verifyMfaCode(db: Db, input: { userId: string; tenantId: string; code: string }): Promise<boolean> {
  return db.begin(async (tx: Db) => {
    const [row] = await tx`SELECT secret_sealed, last_used_step, recovery_code_hashes FROM user_mfa WHERE user_id = ${input.userId} AND enabled_at IS NOT NULL FOR UPDATE`;
    if (!row) return false;
    const step = verifyTotp(openSecret(row.secret_sealed, PURPOSE)!, input.code, Date.now(), row.last_used_step == null ? null : Number(row.last_used_step));
    if (step !== null) {
      await tx`UPDATE user_mfa SET last_used_step = ${step}, updated_at = now() WHERE user_id = ${input.userId}`;
      return true;
    }
    const hash = hashRecoveryCode(input.code);
    const hashes: string[] = row.recovery_code_hashes || [];
    const match = hashes.find((stored) => timingSafeEqual(Buffer.from(stored), Buffer.from(hash)));
    if (!match) return false;
    await tx`UPDATE user_mfa SET recovery_code_hashes = array_remove(recovery_code_hashes, ${match}), updated_at = now() WHERE user_id = ${input.userId}`;
    await recordAudit(tx, { tenantId: input.tenantId, actorId: input.userId, entityType: 'user', entityId: input.userId, action: 'mfa_recovery_code_used', metadata: { left: hashes.length - 1 } });
    return true;
  });
}

/** Turning it off needs a valid code, so a hijacked open session alone cannot remove it. */
export async function disableMfa(db: Db, input: { userId: string; tenantId: string; code: string }): Promise<void> {
  if (!(await verifyMfaCode(db, input))) throw new MfaError('Kod doğrulanamadı.');
  await db.begin(async (tx: Db) => {
    await tx`DELETE FROM user_mfa WHERE user_id = ${input.userId}`;
    await recordAudit(tx, { tenantId: input.tenantId, actorId: input.userId, entityType: 'user', entityId: input.userId, action: 'mfa_disabled' });
  });
}
