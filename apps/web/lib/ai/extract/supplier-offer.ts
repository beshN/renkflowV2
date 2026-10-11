/**
 * A supplier's offer (text of their PDF / e-mail) → an answer to our price request (pure). Each of
 * our request lines is looked for in the offer by code first, then by name words; its unit price is
 * read from that offer line. Confidence: code match + one price = high; name match = medium;
 * several prices on the line = low (the person picks). Nothing found → the line stays empty.
 */

export type RfqLineRef = { lineId: string; name: string; codes: string[]; color: string | null; quantity: number };
export type OfferPrice = { lineId: string; unitPrice: number | null; confidence: 'high' | 'medium' | 'low'; evidence: string | null };
export type OfferDraft = { prices: OfferPrice[]; leadTimeDays: number | null; validUntil: string | null; currency: string | null; unmatched: string[] };

const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** "1.234,50" / "1234.5" / "12,5" → number (Turkish thousands dot, decimal comma). */
export function trMoney(s: string): number | null {
  const t = s.replace(/\s/g, '');
  const tr = t.match(/^\d{1,3}(\.\d{3})+(,\d+)?$|^\d+,\d+$/);
  const v = tr ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t.replace(/,(?=\d{3}\b)/g, ''));
  return Number.isFinite(v) ? v : null;
}

const MONEY = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:₺|TL|TRY|EUR|€|USD|\$)/giu;

export function parseSupplierOffer(text: string, lines: RfqLineRef[], today: string): OfferDraft {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const used = new Set<number>();
  const prices: OfferPrice[] = lines.map((l) => {
    // Codes compared without separators ("PRG-120" = "PRG 120" = "prg120"), as whole tokens of the line.
    const compact = (s: string) => fold(s).replace(/\s+/g, '');
    const tokens = (r: string) => new Set([...fold(r).split(' '), ...fold(r).split(' ').map((_, i, a) => a.slice(i, i + 2).join('')), ...fold(r).split(' ').map((_, i, a) => a.slice(i, i + 3).join(''))]);
    const byCode = rows.findIndex((r, i) => !used.has(i) && l.codes.some((c) => compact(c).length >= 3 && tokens(r).has(compact(c))));
    const words = fold(l.name).split(' ').filter((w) => w.length >= 3);
    const byName = byCode >= 0 ? -1 : rows.findIndex((r, i) => !used.has(i) && words.length > 0 && words.filter((w) => fold(r).includes(w)).length >= Math.min(2, words.length));
    const at = byCode >= 0 ? byCode : byName;
    if (at < 0) return { lineId: l.lineId, unitPrice: null, confidence: 'low', evidence: null };
    used.add(at);
    const found = [...rows[at].matchAll(MONEY)].map((m) => trMoney(m[1])).filter((v): v is number => v !== null && v > 0);
    // "birim" price first when the line also shows a total.
    const unitM = rows[at].match(/birim\s*(?:fiyat[ıi]?)?\s*:?\s*(\d[\d.,]*)/iu);
    const unit = unitM ? trMoney(unitM[1]) : found.length ? Math.min(...found) : null;
    const confidence = unit === null ? 'low' : found.length > 1 && !unitM ? (found.some((v) => Math.abs(v - (unit * l.quantity)) < 0.01) ? 'medium' : 'low') : byCode >= 0 ? 'high' : 'medium';
    return { lineId: l.lineId, unitPrice: unit, confidence, evidence: rows[at].slice(0, 200) };
  });
  const lead = text.match(/teslim(?:at)?\s*(?:süresi)?\s*:?\s*(\d{1,3})\s*(?:iş\s*)?gün/iu);
  const validDate = text.match(/(?:geçerlilik|geçerli(?:dir)?|son\s*geçerlilik)[^\d]{0,20}(\d{1,2})[./](\d{1,2})[./](\d{4})/iu);
  const validDays = text.match(/(\d{1,3})\s*gün\s*(?:süreyle\s*)?geçerli/iu);
  const validUntil = validDate ? `${validDate[3]}-${validDate[2].padStart(2, '0')}-${validDate[1].padStart(2, '0')}`
    : validDays ? new Date(Date.parse(today + 'T00:00:00Z') + Number(validDays[1]) * 86_400_000).toISOString().slice(0, 10) : null;
  const cur = text.match(/\b(TRY|TL|₺|EUR|€|USD|\$)/u)?.[1] ?? null;
  return {
    prices, leadTimeDays: lead ? Number(lead[1]) : null, validUntil,
    currency: cur ? ({ TL: 'TRY', '₺': 'TRY', '€': 'EUR', $: 'USD' } as Record<string, string>)[cur] ?? cur : null,
    unmatched: lines.filter((l) => !prices.find((p) => p.lineId === l.lineId && p.unitPrice !== null)).map((l) => l.name),
  };
}
