import 'server-only';

import { randomUUID } from 'node:crypto';

import { recordAudit } from '@/lib/audit/audit-log';
import { sql } from '@/lib/db';
import { columnExists } from '@/lib/db/schema-guard';
import { WorkOrderApiError } from '@/lib/features/work-orders/security';
import { nextSeriesNumber } from './numbering';
import { eInvoiceProvider, type EInvoiceProvider } from './provider';
import { buildUblInvoice, eBelgeProblems, type UblInvoice } from './ubl';

// e-Belge lifecycle of an issued invoice (docs/superpowers/specs/2026-10-14-e-belge-design.md):
//   issue → queued → sent → accepted | rejected, with error (retried) and cancelled (e-Arşiv).
// Issuing only queues: the provider being down never blocks issuing an invoice.

type Db = any;
type Row = Record<string, any>;

const MAX_ATTEMPTS = 8;
const POLL_MINUTES = 5;
/** 2, 4, 8 … minutes, at most 6 hours between attempts. */
export const retryDelayMinutes = (attempts: number) => Math.min(2 ** Math.max(attempts, 1), 360);

/** Is e-Belge on here: a provider is configured and migrations 053–054 are applied? */
export async function eBelgeProvider(): Promise<EInvoiceProvider | null> {
  let provider: EInvoiceProvider | null;
  try {
    provider = eInvoiceProvider();
  } catch (error) {
    throw new WorkOrderApiError(error instanceof Error ? error.message : 'e-Belge sağlayıcısı yapılandırılamadı', 503);
  }
  if (!provider) return null;
  if (!(await columnExists('invoices', 'ettn')) || !(await columnExists('invoices', 'customer_city')) || !(await columnExists('invoices', 'e_invoice_xml'))) {
    throw new WorkOrderApiError('e-Belge açık ama veritabanı güncellemesi (053–054, 060) uygulanmamış', 503);
  }
  return provider;
}

const istanbulTime = (date: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date);
const iso = (d: unknown) => (d instanceof Date ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(d) : d ? String(d).slice(0, 10) : null);

/** The UBL input of an invoice, from its own snapshot (buyer) and the firm's current identity (seller). */
export async function ublInput(tx: Db, invoice: Row, override: Partial<UblInvoice> = {}): Promise<UblInvoice> {
  const [tenant] = await tx`SELECT * FROM tenants WHERE id = ${invoice.tenant_id}`;
  const lines = await tx`SELECT * FROM invoice_lines WHERE invoice_id = ${invoice.id} ORDER BY position`;
  return {
    number: invoice.invoice_number,
    ettn: invoice.ettn,
    issueDate: iso(invoice.issued_on)!,
    issueTime: istanbulTime(invoice.issued_at ? new Date(invoice.issued_at) : new Date()),
    documentType: invoice.document_type,
    profile: invoice.profile,
    typeCode: invoice.invoice_type_code ?? 'SATIS',
    currency: invoice.currency,
    exchangeRate: invoice.exchange_rate ? Number(invoice.exchange_rate) : null,
    notes: invoice.notes ? [invoice.notes] : [],
    iban: tenant.iban,
    dueDate: iso(invoice.due_on),
    seller: {
      name: tenant.legal_name || tenant.name, taxNumber: tenant.tax_number, taxOffice: tenant.tax_office, addressLine: tenant.address_line,
      district: tenant.district, city: tenant.city, postalCode: tenant.postal_code, phone: tenant.phone, email: tenant.invoice_email,
      mersisNo: tenant.mersis_no, tradeRegistryNo: tenant.trade_registry_no,
    },
    buyer: {
      name: invoice.customer_name, taxNumber: invoice.customer_tax_number || null, taxOffice: invoice.customer_tax_office,
      addressLine: invoice.customer_address, district: invoice.customer_district, city: invoice.customer_city,
    },
    lines: lines.map((l: Row) => ({
      description: l.description, quantity: Number(l.quantity), unitCode: l.unit_code ?? 'C62', unitPrice: Number(l.unit_price),
      net: Number(l.net_amount), vatPercent: Number(l.vat_percent), vat: Number(l.vat_amount),
      withholdingCode: l.withholding_code, withholdingPercent: Number(l.withholding_percent ?? 0), withholding: Number(l.withholding_amount ?? 0),
      exemptionCode: l.exemption_code, exemptionReason: l.exemption_reason,
    })),
    totals: {
      subtotal: Number(invoice.subtotal), vatTotal: Number(invoice.vat_total), total: Number(invoice.total),
      withholdingTotal: Number(invoice.withholding_total ?? 0), payable: Number(invoice.payable_total ?? invoice.total),
    },
    ...override,
  };
}

/**
 * Inside the issuing transaction: decide e-Fatura or e-Arşiv, take the next number of that series
 * and an ETTN, and refuse (with every reason) an invoice GİB would reject. The caller stores the
 * result and the invoice waits in the queue.
 */
export async function prepareEBelge(tx: Db, provider: EInvoiceProvider, invoice: Row, issuedOn: string) {
  if (issuedOn > iso(new Date())!) throw new WorkOrderApiError('e-Belge ileri tarihli kesilemez', 400);
  let documentType: 'e_fatura' | 'e_arsiv' = 'e_arsiv';
  let alias: string | null = null;
  const taxNumber = invoice.customer_tax_number as string | null;
  if (taxNumber && /^(\d{10}|\d{11})$/.test(taxNumber)) {
    const answer = await provider.isRegisteredRecipient(taxNumber);
    documentType = answer.registered ? 'e_fatura' : 'e_arsiv';
    alias = answer.alias ?? null;
    if (invoice.customer_id) {
      await tx`UPDATE customers SET e_invoice_registered = ${answer.registered}, e_invoice_alias = ${alias} WHERE id = ${invoice.customer_id}`;
    }
  }
  const profile = documentType === 'e_fatura' ? 'TEMELFATURA' : 'EARSIVFATURA';
  const [tenant] = await tx`SELECT e_fatura_prefix, e_arsiv_prefix FROM tenants WHERE id = ${invoice.tenant_id}`;
  const prefix = documentType === 'e_fatura' ? tenant.e_fatura_prefix : tenant.e_arsiv_prefix;

  // Check before the number is taken, so a refused invoice does not consume one.
  const preview = await ublInput(tx, { ...invoice, issued_on: issuedOn }, { number: `${prefix}${issuedOn.slice(0, 4)}000000000`, ettn: randomUUID(), documentType, profile });
  const problems = eBelgeProblems(preview);
  if (problems.length) throw new WorkOrderApiError(`e-Belge kesilemez: ${problems.join('; ')}`, 422);

  const number = await nextSeriesNumber(tx, invoice.tenant_id, prefix, Number(issuedOn.slice(0, 4)));
  return { number, documentType, profile, ettn: randomUUID(), alias };
}

/** A legacy document can be frozen only before its first send attempt. Never invent sent XML. */
export async function invoiceDocument(tx: Db, invoice: Row): Promise<string> {
  if (invoice.e_invoice_xml) return invoice.e_invoice_xml;
  if (invoice.e_invoice_status !== 'queued' || Number(invoice.e_invoice_attempts) !== 0) {
    throw new WorkOrderApiError('Bu eski e-Belgenin özgün XML kaydı yok; belgeyi entegratörden alın', 409);
  }
  const xml = buildUblInvoice(await ublInput(tx, invoice));
  const [customer] = invoice.customer_id ? await tx`SELECT e_invoice_alias FROM customers WHERE id = ${invoice.customer_id} AND tenant_id = ${invoice.tenant_id}` : [null];
  const alias = customer?.e_invoice_alias ?? null;
  await tx`UPDATE invoices SET e_invoice_xml = ${xml}, e_invoice_recipient_alias = ${alias} WHERE id = ${invoice.id} AND tenant_id = ${invoice.tenant_id}`;
  invoice.e_invoice_xml = xml;
  invoice.e_invoice_recipient_alias = alias;
  return xml;
}

async function audit(tx: Db, invoice: Row, action: string, metadata: Record<string, unknown> = {}) {
  await recordAudit(tx, { tenantId: invoice.tenant_id, actorId: null, entityType: 'order', entityId: invoice.order_id, action, metadata: { invoiceId: invoice.id, number: invoice.invoice_number, ...metadata } });
}

/** Claims one due invoice (SKIP LOCKED) and runs `work` on it in its own transaction. */
async function claimOne(where: Db, work: (tx: Db, invoice: Row) => Promise<void>): Promise<boolean> {
  return sql.begin(async (tx: Db) => {
    const [invoice] = await tx`
      SELECT * FROM invoices WHERE ${where} AND e_invoice_next_attempt_at <= now()
      ORDER BY e_invoice_next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if (!invoice) return false;
    await work(tx, invoice);
    return true;
  });
}

/**
 * Sends queued invoices and asks the provider about sent ones. Each invoice is its own transaction,
 * so one failure never blocks the rest. Called by the cron route and the production worker.
 */
export async function drainEInvoices(limit = 10) {
  const provider = eInvoiceProvider();
  if (!provider || !(await columnExists('invoices', 'ettn'))) return { skipped: true };
  if (!(await columnExists('invoices', 'e_invoice_xml'))) throw new WorkOrderApiError('e-Belge veritabanı güncellemesi (060) uygulanmamış', 503);
  const result = { sent: 0, accepted: 0, rejected: 0, failed: 0 };

  for (let i = 0; i < limit; i++) {
    const claimed = await claimOne(sql`e_invoice_status IN ('queued', 'error') AND status = 'issued' AND e_invoice_attempts < ${MAX_ATTEMPTS}`, async (tx, invoice) => {
      try {
        const xml = await invoiceDocument(tx, invoice);
        const { providerId } = await provider.send({ ettn: invoice.ettn, number: invoice.invoice_number, documentType: invoice.document_type, recipientAlias: invoice.e_invoice_recipient_alias ?? null, xml });
        await tx`UPDATE invoices SET e_invoice_status = 'sent', e_invoice_provider_id = ${providerId}, e_invoice_sent_at = now(), e_invoice_error = NULL,
          e_invoice_attempts = e_invoice_attempts + 1, e_invoice_next_attempt_at = now() + make_interval(mins => ${POLL_MINUTES}), updated_at = now() WHERE id = ${invoice.id}`;
        await audit(tx, invoice, 'e_invoice_sent', { provider: provider.name, documentType: invoice.document_type });
        result.sent++;
      } catch (error) {
        const attempts = Number(invoice.e_invoice_attempts) + 1;
        const message = (error instanceof Error ? error.message : 'Gönderilemedi').slice(0, 500);
        await tx`UPDATE invoices SET e_invoice_status = 'error', e_invoice_error = ${message}, e_invoice_attempts = ${attempts},
          e_invoice_next_attempt_at = now() + make_interval(mins => ${retryDelayMinutes(attempts)}), updated_at = now() WHERE id = ${invoice.id}`;
        await audit(tx, invoice, 'e_invoice_failed', { attempts, error: message });
        result.failed++;
      }
    });
    if (!claimed) break;
  }

  for (let i = 0; i < limit; i++) {
    const claimed = await claimOne(sql`e_invoice_status = 'sent'`, async (tx, invoice) => {
      const answer = await provider.status(invoice.e_invoice_provider_id).catch((error) => ({ status: 'sent' as const, message: error instanceof Error ? error.message : undefined }));
      if (answer.status === 'accepted' || answer.status === 'rejected') {
        await tx`UPDATE invoices SET e_invoice_status = ${answer.status}, e_invoice_error = ${answer.message ?? null}, e_invoice_next_attempt_at = NULL, updated_at = now() WHERE id = ${invoice.id}`;
        await audit(tx, invoice, answer.status === 'accepted' ? 'e_invoice_accepted' : 'e_invoice_rejected', answer.message ? { message: answer.message } : {});
        result[answer.status]++;
      } else {
        await tx`UPDATE invoices SET e_invoice_next_attempt_at = now() + make_interval(mins => ${POLL_MINUTES}) WHERE id = ${invoice.id}`;
      }
    });
    if (!claimed) break;
  }
  return result;
}

/** A failed invoice goes back to the queue now (after the cause, e.g. a missing address, is fixed). */
export async function retryEInvoice(tx: Db, invoice: Row) {
  if (!['error', 'rejected'].includes(invoice.e_invoice_status)) throw new WorkOrderApiError('Yalnız hatalı ya da reddedilmiş e-Belge yeniden gönderilir', 409);
  if (invoice.e_invoice_status === 'rejected') throw new WorkOrderApiError('Reddedilen e-Fatura yeniden gönderilmez: iptal edip yeni fatura kesin', 409);
  if (!invoice.e_invoice_xml) throw new WorkOrderApiError('Bu eski e-Belgenin özgün XML kaydı yok; belgeyi entegratörden alın', 409);
  await tx`UPDATE invoices SET e_invoice_status = 'queued', e_invoice_error = NULL, e_invoice_attempts = 0, e_invoice_next_attempt_at = now(), updated_at = now() WHERE id = ${invoice.id}`;
}

/**
 * What cancelling an issued invoice means for its e-Belge: an e-Arşiv is cancelled at the provider,
 * an e-Fatura cannot be (it is answered with a return invoice), and one still on its way waits.
 */
export async function cancelEBelge(tx: Db, invoice: Row) {
  const status = invoice.e_invoice_status as string;
  if (!status || status === 'not_connected' || status === 'rejected') return;
  if (['queued', 'sent', 'error'].includes(status)) throw new WorkOrderApiError('e-Belge gönderimi sürüyor; tamamlanınca iptal edin', 409);
  if (status === 'cancelled') return;
  if (invoice.document_type === 'e_fatura') {
    throw new WorkOrderApiError('Kabul edilmiş e-Fatura sistemden iptal edilemez: alıcıyla mutabık kalıp iade faturası düzenleyin ya da GİB üzerinden iptal talebi açın', 409);
  }
  const provider = await eBelgeProvider();
  if (!provider) throw new WorkOrderApiError('e-Belge sağlayıcısı kapalı; e-Arşiv iptali yapılamıyor', 503);
  await provider.cancelArchive(invoice.e_invoice_provider_id, 'İptal');
  await tx`UPDATE invoices SET e_invoice_status = 'cancelled', updated_at = now() WHERE id = ${invoice.id}`;
}
