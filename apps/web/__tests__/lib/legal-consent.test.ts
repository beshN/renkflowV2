/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/schema-guard', () => ({ columnExists: jest.fn(async () => true) }));
jest.mock('@/lib/features/auth/private-access', () => ({ privateAccessEmail: () => null }));
jest.mock('@/lib/security/rate-limit', () => ({
  consumeRateLimit: jest.fn(async () => ({ allowed: true })),
  getClientIp: () => '203.0.113.7',
  rateLimitResponse: () => Response.json({ error: 'limit' }, { status: 429 }),
}));
jest.mock('@/lib/email', () => ({ sendVerificationEmail: jest.fn(async () => ({ success: true })) }));
jest.mock('bcryptjs', () => ({ hash: jest.fn(async () => 'hashed') }));

type Call = { text: string; values: unknown[] };
const calls: Call[] = [];
// A tagged-template stand-in: records each statement and answers by what it touches.
const fakeDb: any = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
  const text = strings.join('$X').replace(/\s+/g, ' ').trim();
  calls.push({ text, values });
  if (/^SELECT id FROM users/i.test(text)) return [];
  if (/INSERT INTO users/i.test(text)) return [{ id: 'user-1' }];
  if (/INSERT INTO tenants/i.test(text)) return [{ id: 'tenant-1' }];
  if (/FROM invitations/i.test(text)) return [{ id: 'inv-1', email: 'davet@example.invalid', tenant_id: 'tenant-1', role: 'office' }];
  return [];
});
jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => fakeDb(...args),
  withTransaction: async (fn: (tx: any) => unknown) => fn((...args: any[]) => fakeDb(...args)),
}));

import { NextRequest } from 'next/server';
import { columnExists } from '@/lib/db/schema-guard';
import { POST as register } from '@/app/api/auth/register/route';
import { POST as acceptInvite } from '@/app/api/tenant/invite/accept/route';
import { privacyDocument, termsDocument } from '@/lib/core/legal-content';
import { consentOutdated, hasLegalConsent, PRIVACY_NOTICE_VERSION, TERMS_VERSION } from '@/lib/features/auth/legal-consent';
import { legalConsentRequired, recordLegalConsent } from '@/lib/features/auth/legal-consent.server';

const signup = { name: 'Ayşe Yılmaz', email: 'ayse@example.invalid', password: 'Uzun-sifre-2026x', companyName: 'Örnek Alüminyum' };
const post = (url: string, body: unknown) =>
  new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const consentWrite = () => calls.find((c) => /UPDATE users SET terms_accepted_at/i.test(c.text));

beforeEach(() => {
  calls.length = 0;
  (columnExists as jest.Mock).mockResolvedValue(true);
});

describe('legal consent rules', () => {
  it('takes its versions from legal-content', () => {
    expect(TERMS_VERSION).toBe(termsDocument.version);
    expect(PRIVACY_NOTICE_VERSION).toBe(privacyDocument.version);
  });

  it('counts only an explicit true as consent', () => {
    expect(hasLegalConsent({ acceptLegal: true })).toBe(true);
    for (const body of [null, undefined, {}, { acceptLegal: 'true' }, { acceptLegal: 1 }, { acceptLegal: false }]) expect(hasLegalConsent(body)).toBe(false);
  });

  it('asks again when nothing is recorded or a text has a newer version', () => {
    const current = { terms_accepted_at: new Date(), terms_version: TERMS_VERSION, privacy_notice_ack_at: new Date(), privacy_notice_version: PRIVACY_NOTICE_VERSION };
    expect(consentOutdated(current)).toBe(false);
    expect(consentOutdated({ ...current, terms_accepted_at: null })).toBe(true);
    expect(consentOutdated({ ...current, terms_version: '0.9' })).toBe(true);
    expect(consentOutdated({ ...current, privacy_notice_version: null })).toBe(true);
    expect(consentOutdated(undefined)).toBe(false);
  });
});

describe('POST /api/auth/register', () => {
  it('rejects a sign-up without consent and creates nothing', async () => {
    const res = await register(post('http://x/api/auth/register', signup));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ field: 'acceptLegal', code: 'consent_required' });
    expect(body.error).toMatch(/Kullanım Koşulları/);
    expect(calls.some((c) => /INSERT INTO users/i.test(c.text))).toBe(false);
  });

  it('records the accepted versions, time and address with the new user', async () => {
    const res = await register(post('http://x/api/auth/register', { ...signup, acceptLegal: true }));
    expect(res.status).toBe(201);
    const write = consentWrite();
    expect(write).toBeDefined();
    expect(write!.text).toMatch(/terms_version = \$X/);
    expect(write!.text).toMatch(/privacy_notice_ack_at = now\(\)/);
    expect(write!.values).toEqual([TERMS_VERSION, PRIVACY_NOTICE_VERSION, '203.0.113.7', 'user-1']);
  });

  it('still signs up when migration 078 is not applied yet', async () => {
    (columnExists as jest.Mock).mockResolvedValue(false);
    const res = await register(post('http://x/api/auth/register', { ...signup, acceptLegal: true }));
    expect(res.status).toBe(201);
    expect(consentWrite()).toBeUndefined();
  });
});

describe('POST /api/tenant/invite/accept', () => {
  const invite = { token: 'tok', name: 'Mehmet Kaya', password: 'Uzun-sifre-2026x' };

  it('rejects joining without consent', async () => {
    const res = await acceptInvite(post('http://x/api/tenant/invite/accept', invite));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('consent_required');
    expect(calls.some((c) => /FROM invitations/i.test(c.text))).toBe(false);
  });

  it('records consent for the invited user', async () => {
    const res = await acceptInvite(post('http://x/api/tenant/invite/accept', { ...invite, acceptLegal: true }));
    expect(res.status).toBe(200);
    expect(consentWrite()?.values).toEqual([TERMS_VERSION, PRIVACY_NOTICE_VERSION, '203.0.113.7', 'user-1']);
  });
});

describe('consent store', () => {
  it('does not ask or write before the migration', async () => {
    (columnExists as jest.Mock).mockResolvedValue(false);
    expect(await legalConsentRequired(fakeDb, 'user-1')).toBe(false);
    expect(await recordLegalConsent(fakeDb, { userId: 'user-1' })).toBe(false);
    expect(calls).toEqual([]);
  });

  it('never blocks when the check itself fails', async () => {
    (columnExists as jest.Mock).mockRejectedValue(new Error('connection refused'));
    expect(await legalConsentRequired(fakeDb, 'user-1')).toBe(false);
  });

  it('asks a user with no record (an SSO sign-up)', async () => {
    const db: any = jest.fn(async () => [{ terms_accepted_at: null, terms_version: null, privacy_notice_ack_at: null, privacy_notice_version: null }]);
    expect(await legalConsentRequired(db, 'user-1')).toBe(true);
  });

  it('drops an unknown client address', async () => {
    await recordLegalConsent(fakeDb, { userId: 'user-1', ip: 'unknown' });
    expect(consentWrite()?.values[2]).toBeNull();
  });
});
