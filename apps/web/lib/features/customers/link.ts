import 'server-only';

import { recordAudit } from '@/lib/audit/audit-log';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';

export type OrderCustomerInput = {
  customerId?: string | null;
  customerName: string;
  email?: string | null;
  phone?: string | null;
};

/**
 * Name folding identical in JS and SQL, independent of the database locale (a C-locale lower() leaves
 * Ş, İ, Ö… uppercase): single spaces, then the Turkish alphabet mapped explicitly, with İ/I/ı → i so
 * "YAPI", "Yapı" and "yapi" agree.
 */
const FOLD_FROM = 'ABCÇDEFGĞHIİJKLMNOÖPQRSŞTUÜVWXYZı';
const FOLD_TO = 'abcçdefgğhiijklmnoöpqrsştuüvwxyzi';
export const nameKey = (value: string) =>
  [...value.trim().replace(/\s+/g, ' ')].map((char) => { const at = FOLD_FROM.indexOf(char); return at === -1 ? char : FOLD_TO[at]; }).join('');
/** Last 10 digits, so +90 532…, 0532… and 532… are the same number. */
export const phoneKey = (value?: string | null) => (value || '').replace(/\D/g, '').slice(-10);

type Card = { id: string; full_name: string; company_name: string | null; email: string | null; phone_key: string };

/** More than one card fits the typed name: the user has to pick, the server does not guess. */
export class AmbiguousCustomerError extends WorkOrderApiError {
  constructor() {
    super('Bu adla birden çok müşteri kartı var. Öneri listesinden doğru kartı seçin.', 409);
  }
}

/**
 * Every order gets a customer card (run inside the order's transaction). A wrong link is worse than
 * a duplicate card, so matching is conservative:
 * 1. A chosen card (customerId) must belong to the firm and be active.
 * 2. Same e-mail, else same phone → that card.
 * 3. Same name (card name or company name) → that card, unless the order brings an e-mail/phone the
 *    card contradicts; several such cards → AmbiguousCustomerError.
 * 4. Otherwise a new card from the order's contact fields (checked again under a firm-level lock).
 */
export async function resolveOrderCustomer(
  tx: any,
  tenantId: string,
  input: OrderCustomerInput,
  actorId?: string | null,
): Promise<{ id: string; name: string; created: boolean }> {
  if (input.customerId) {
    const [card] = await tx`SELECT id, full_name FROM customers WHERE tenant_id = ${tenantId} AND id = ${input.customerId} AND is_active = true`;
    if (!card) throw new WorkOrderApiError('Seçilen müşteri bulunamadı', 400);
    return { id: card.id, name: card.full_name, created: false };
  }

  const name = (input.customerName || '').trim().replace(/\s+/g, ' ');
  if (!name) throw new WorkOrderApiError('Müşteri adı gerekli', 400);
  const key = nameKey(name);
  const email = input.email?.trim().toLowerCase() || null;
  const phone = phoneKey(input.phone);

  const find = async () => {
    const cards: Card[] = await tx`
      SELECT id, full_name, company_name, lower(email) AS email, right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) AS phone_key
      FROM customers
      WHERE tenant_id = ${tenantId} AND is_active = true
        AND (
          ${email ? tx`lower(email) = ${email}` : tx`false`}
          OR ${phone.length === 10 ? tx`right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = ${phone}` : tx`false`}
          OR translate(regexp_replace(btrim(full_name), '\\s+', ' ', 'g'), ${FOLD_FROM}, ${FOLD_TO}) = ${key}
          OR translate(regexp_replace(btrim(coalesce(company_name, '')), '\\s+', ' ', 'g'), ${FOLD_FROM}, ${FOLD_TO}) = ${key}
        )
      ORDER BY created_at ASC
    `;
    const contradicts = (card: Card) => Boolean((email && card.email && card.email !== email) || (phone.length === 10 && card.phone_key.length === 10 && card.phone_key !== phone));
    const byContact = (email && cards.find((card) => card.email === email)) || (phone.length === 10 && cards.find((card) => card.phone_key === phone));
    if (byContact) return byContact;
    const named = cards.filter((card) => (nameKey(card.full_name) === key || (card.company_name && nameKey(card.company_name) === key)) && !contradicts(card));
    if (named.length > 1) throw new AmbiguousCustomerError();
    return named[0];
  };

  const match = await find();
  if (match) return { id: match.id, name: match.full_name, created: false };

  // Only the create path is serialized; re-check so two concurrent orders cannot open two cards.
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId + ':customer-create'}, 0))`;
  const raced = await find();
  if (raced) return { id: raced.id, name: raced.full_name, created: false };

  const [created] = await tx`
    INSERT INTO customers (tenant_id, full_name, email, phone)
    VALUES (${tenantId}, ${name}, ${email}, ${input.phone?.trim() || null})
    RETURNING id, full_name
  `;
  await recordAudit(tx, { tenantId, actorId: actorId ?? null, entityType: 'customer', entityId: created.id, action: 'created', metadata: { source: 'order' } });
  return { id: created.id, name: created.full_name, created: true };
}
