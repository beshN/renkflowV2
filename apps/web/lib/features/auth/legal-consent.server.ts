import 'server-only';

import { columnExists } from '@/lib/db/schema-guard';
import { consentOutdated, PRIVACY_NOTICE_VERSION, TERMS_VERSION, type ConsentRecord } from './legal-consent';

type Db = any;

/** Until migration 078 is applied nothing is recorded and nobody is asked; sign-up keeps working. */
export async function legalConsentReady(): Promise<boolean> {
  try {
    return await columnExists('users', 'privacy_notice_version');
  } catch {
    return false;
  }
}

/** Stores the acceptance of the current texts for this user (the user row has no tenant). */
export async function recordLegalConsent(db: Db, input: { userId: string; ip?: string | null }): Promise<boolean> {
  if (!(await legalConsentReady())) return false;
  const ip = input.ip && input.ip !== 'unknown' ? input.ip.slice(0, 64) : null;
  await db`
    UPDATE users SET terms_accepted_at = now(), terms_version = ${TERMS_VERSION},
      privacy_notice_ack_at = now(), privacy_notice_version = ${PRIVACY_NOTICE_VERSION},
      terms_accepted_ip = ${ip}, updated_at = now()
    WHERE id = ${input.userId}
  `;
  return true;
}

/** Whether this user still has to accept the current texts. False whenever it cannot be told. */
export async function legalConsentRequired(db: Db, userId: string): Promise<boolean> {
  if (!(await legalConsentReady())) return false;
  try {
    const [row] = await db`
      SELECT terms_accepted_at, terms_version, privacy_notice_ack_at, privacy_notice_version
      FROM users WHERE id = ${userId}
    `;
    return consentOutdated(row as ConsentRecord | undefined);
  } catch {
    return false;
  }
}
