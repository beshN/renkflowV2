/**
 * Data quality guard (pure). Each finding names the records and, when the fix is mechanical, the
 * exact before → after values, so an approved fix can be undone as long as nobody changed the value
 * since. Issues that need a person's judgement (a missing price, a unit that does not match) become
 * a to-do instead of a change.
 */
import { canonicalColor, parseColor } from '@/lib/features/colors/color-spec';
import { countBadge, type Finding } from './engine';

export type QualityIssue = 'duplicate_customer' | 'phone_format' | 'name_spelling' | 'color_spelling' | 'zero_price' | 'unit_mismatch';
export const ISSUE_LABELS: Record<QualityIssue, string> = {
  duplicate_customer: 'Kopya müşteri kartı', phone_format: 'Telefon biçimi', name_spelling: 'Ad yazımı',
  color_spelling: 'Renk yazımı', zero_price: 'Fiyatı boş teklif kalemi', unit_mismatch: 'Birim uyuşmazlığı',
};
/** One reversible change: a column of a row, from → to. */
export type FieldChange = { table: 'customers' | 'order_items' | 'quotation_items'; id: string; column: 'is_active' | 'phone' | 'full_name' | 'color'; from: string | boolean | null; to: string | boolean | null };
export type QualityPayload = { issue: QualityIssue; changes: FieldChange[]; todo: { entityType: string; entityId: string; title: string } | null };

export type CustomerRow = { id: string; name: string; phone: string | null; email: string | null; active: boolean; orders: number; createdAt: string };

const trLower = (s: string) => s.toLocaleLowerCase('tr-TR');
const nameKey = (s: string) => trLower(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const digits = (s: string | null) => (s ?? '').replace(/\D/g, '');
/** A Turkish mobile/landline as stored: "05321234567" (11 digits starting with 0). */
export function normalPhone(raw: string | null): string | null {
  const d = digits(raw);
  const local = d.startsWith('90') && d.length === 12 ? '0' + d.slice(2) : d.length === 10 && !d.startsWith('0') ? '0' + d : d;
  return /^0\d{10}$/.test(local) ? local : null;
}
/** "  ahmet   YILMAZ " → "Ahmet Yılmaz" (only for names written all lower or all upper case, or with stray spaces). */
export function tidyName(raw: string): string | null {
  const spaced = raw.replace(/\s+/g, ' ').trim();
  const oneCase = spaced === trLower(spaced) || spaced === spaced.toLocaleUpperCase('tr-TR');
  const fixed = oneCase && /\p{L}/u.test(spaced) ? spaced.split(' ').map((w) => (w.length <= 3 && /^(a\.ş\.|ltd|şti|ve)$/iu.test(w) ? w.toLocaleUpperCase('tr-TR') : w.charAt(0).toLocaleUpperCase('tr-TR') + trLower(w.slice(1)))).join(' ') : spaced;
  return fixed !== raw ? fixed : null;
}

const finding = (key: string, issue: QualityIssue, title: string, rationale: string, records: Finding['evidence']['records'], payload: QualityPayload, confidence: Finding['confidence'] = 'high'): Finding<QualityPayload> => ({
  detector: 'data_quality', dedupeKey: `${issue}:${key}`, title, rationale, priority: 'low', confidence,
  rule: `${ISSUE_LABELS[issue]}: ${payload.changes.length ? 'onaylanırsa düzeltilir, geri alınabilir' : 'onaylanırsa yapılacak açılır'}`,
  evidence: { badges: [{ label: ISSUE_LABELS[issue], tone: 'info', kind: 'text' }, ...(payload.changes.length > 1 ? [countBadge(payload.changes.length, 'kayıt', 'info')] : [])], records, numbers: {} },
  payload,
});

export function customerIssues(rows: CustomerRow[]): Finding<QualityPayload>[] {
  const out: Finding<QualityPayload>[] = [];
  const active = rows.filter((r) => r.active);
  // Duplicates: the same name, or the same phone. The card with more orders (then the older) stays.
  const groups = new Map<string, CustomerRow[]>();
  for (const r of active) {
    for (const k of [`n:${nameKey(r.name)}`, normalPhone(r.phone) ? `p:${normalPhone(r.phone)}` : null]) if (k && k.length > 3) groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const seen = new Set<string>();
  for (const [k, g] of groups) {
    const ids = [...new Set(g.map((r) => r.id))];
    if (ids.length < 2) continue;
    const sig = ids.sort().join(',');
    if (seen.has(sig)) continue;
    seen.add(sig);
    const sorted = [...new Map(g.map((r) => [r.id, r])).values()].sort((a, b) => b.orders - a.orders || a.createdAt.localeCompare(b.createdAt));
    const [keep, ...dups] = sorted;
    out.push(finding(sig, 'duplicate_customer', `${keep.name}: ${dups.length + 1} kart aynı kişi gibi`, `${k.startsWith('p:') ? 'Aynı telefon' : 'Aynı ad'}. "${keep.name}" (${keep.orders} sipariş) kalır; diğer kart(lar) pasife alınır, siparişleri yerinde durur.`,
      sorted.map((r) => ({ entityType: 'customer', entityId: r.id, label: `${r.name} · ${r.orders} sipariş`, href: `/crm/${r.id}` })),
      { issue: 'duplicate_customer', changes: dups.map((d) => ({ table: 'customers', id: d.id, column: 'is_active', from: true, to: false })), todo: null }, k.startsWith('p:') ? 'high' : 'medium'));
  }
  for (const r of active) {
    const p = normalPhone(r.phone);
    if (r.phone && p && p !== r.phone)
      out.push(finding(r.id, 'phone_format', `${r.name}: telefon "${r.phone}" → "${p}"`, 'Telefonlar tek biçimde tutulursa aramada ve kopya kontrolünde bulunur.', [{ entityType: 'customer', entityId: r.id, label: r.name, href: `/crm/${r.id}` }],
        { issue: 'phone_format', changes: [{ table: 'customers', id: r.id, column: 'phone', from: r.phone, to: p }], todo: null }));
    const n = tidyName(r.name);
    if (n) out.push(finding(r.id, 'name_spelling', `"${r.name}" → "${n}"`, 'Ad tek biçimde yazılırsa listelerde ve teklif çıktısında düzgün görünür.', [{ entityType: 'customer', entityId: r.id, label: r.name, href: `/crm/${r.id}` }],
      { issue: 'name_spelling', changes: [{ table: 'customers', id: r.id, column: 'full_name', from: r.name, to: n }], todo: null }));
  }
  return out;
}

/** Colours on open orders/quotes written another way than the one spelling ("7016 mat" → "RAL 7016 Mat"). */
export function colorIssues(rows: Array<{ table: 'order_items' | 'quotation_items'; id: string; parentId: string; parentLabel: string; color: string }>): Finding<QualityPayload>[] {
  const by = new Map<string, typeof rows>();
  for (const r of rows) {
    if (parseColor(r.color).kind === 'text') continue; // an unknown name stays as written
    const c = canonicalColor(r.color);
    if (c === r.color) continue;
    by.set(`${r.color}→${c}`, [...(by.get(`${r.color}→${c}`) ?? []), r]);
  }
  return [...by.entries()].map(([k, list]) => {
    const to = canonicalColor(list[0].color);
    return finding(k, 'color_spelling', `"${list[0].color}" → "${to}" (${list.length} kalem)`, 'Aynı renk tek yazımla tutulursa boya kuyruğu ve stok eşleşmesi doğru çalışır.',
      list.slice(0, 10).map((r) => ({ entityType: r.table === 'order_items' ? 'order' : 'quotation', entityId: r.parentId, label: r.parentLabel, href: r.table === 'order_items' ? `/orders/${r.parentId}` : `/quotations/${r.parentId}` })),
      { issue: 'color_spelling', changes: list.slice(0, 200).map((r) => ({ table: r.table, id: r.id, column: 'color', from: r.color, to })), todo: null });
  });
}

/** Judgement issues → a to-do on the record (no value is made up). */
export function todoIssues(zero: Array<{ quotationId: string; number: string; lines: number }>, units: Array<{ poId: string; number: string; itemName: string; lineUom: string; itemUom: string }>): Finding<QualityPayload>[] {
  return [
    ...zero.map((z) => finding(z.quotationId, 'zero_price', `${z.number}: ${z.lines} kalemin fiyatı boş`, 'Gönderilmiş ya da taslak teklifte fiyatı 0 olan kalem var.', [{ entityType: 'quotation', entityId: z.quotationId, label: z.number, href: `/quotations/${z.quotationId}` }],
      { issue: 'zero_price', changes: [], todo: { entityType: 'quotation', entityId: z.quotationId, title: 'Fiyatı boş kalemleri doldur' } })),
    ...units.map((u) => finding(`${u.poId}:${u.itemName}`, 'unit_mismatch', `${u.number}: ${u.itemName} ${u.lineUom} ile sipariş edilmiş, stok birimi ${u.itemUom}`, 'Birim farklıysa teslim alınca stok yanlış miktarla girer.', [{ entityType: 'purchase_order', entityId: u.poId, label: u.number, href: `/purchases` }],
      { issue: 'unit_mismatch', changes: [], todo: { entityType: 'purchase_order', entityId: u.poId, title: `${u.itemName}: birimi kontrol et (${u.lineUom} / ${u.itemUom})` } })),
  ];
}
