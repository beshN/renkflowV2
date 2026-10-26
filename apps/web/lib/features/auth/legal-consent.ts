import { privacyDocument, termsDocument } from '@/lib/core/legal-content';

/**
 * Legal consent (KVKK): the user accepts the Kullanım Koşulları and acknowledges the Gizlilik ve
 * KVKK Aydınlatma Metni. The versions come only from lib/core/legal-content.ts; raising one there
 * asks every user once more.
 */
export const TERMS_VERSION = termsDocument.version;
export const PRIVACY_NOTICE_VERSION = privacyDocument.version;

export const LEGAL_CONSENT_REQUIRED_MESSAGE =
  "Devam etmek için Kullanım Koşulları'nı kabul etmeniz ve Gizlilik ve KVKK Aydınlatma Metni'ni okuduğunuzu onaylamanız gerekir.";

/** The request body carries `acceptLegal: true` only when the user ticked the box. */
export function hasLegalConsent(body: unknown): boolean {
  return Boolean(body && typeof body === 'object' && (body as { acceptLegal?: unknown }).acceptLegal === true);
}

export type ConsentRecord = {
  terms_accepted_at: Date | string | null;
  terms_version: string | null;
  privacy_notice_ack_at: Date | string | null;
  privacy_notice_version: string | null;
};

/** Asked when nothing is recorded yet or a text has a newer version than the one accepted. */
export function consentOutdated(row: ConsentRecord | null | undefined): boolean {
  if (!row) return false;
  return (
    !row.terms_accepted_at ||
    row.terms_version !== TERMS_VERSION ||
    !row.privacy_notice_ack_at ||
    row.privacy_notice_version !== PRIVACY_NOTICE_VERSION
  );
}
