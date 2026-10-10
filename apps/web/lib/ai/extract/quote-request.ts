/**
 * A quote request from a pasted WhatsApp / e-mail message (pure, deterministic): customer, phone,
 * address, and one line per product (family, measure, colour, quantity). Every field carries a
 * confidence; a field the text does not state clearly is low (shown yellow) or missing — never
 * guessed. The model (when the firm allows it) only fills what the rules left empty.
 */
import { parseColorWords, parseCustomer, parseDims } from '@/lib/ai/commands/parse';

export type Confidence = 'high' | 'medium' | 'low';
export type Field<T> = { value: T; confidence: Confidence; source: 'rules' | 'model'; evidence?: string };
export type RequestLine = { family: Field<string> | null; widthMm: Field<number> | null; projectionMm: Field<number> | null; color: Field<string> | null; quantity: Field<number> };
export type QuoteRequest = { customer: Field<string> | null; phone: Field<string> | null; email: Field<string> | null; address: Field<string> | null; lines: RequestLine[]; notes: string[] };

const FAMILIES: Array<[RegExp, string]> = [
  [/bioklimatik|biyoklimatik|pergola|pergole/iu, 'pergola'], [/mafsall?ı?\s*tente|kol\s*tente|tente/iu, 'awning'],
  [/giyotin/iu, 'guillotine'], [/zip\s*perde|zip/iu, 'zip'], [/rolling\s*roof|açılır\s*tavan/iu, 'rolling_roof'], [/kış\s*bahçesi/iu, 'winter_garden'],
];
const f = <T>(value: T, confidence: Confidence, evidence?: string): Field<T> => ({ value, confidence, source: 'rules', evidence });

export function extractQuoteRequest(raw: string): QuoteRequest {
  const text = raw.replace(/\r/g, '').trim();
  const notes: string[] = [];
  // Contact details (they stay here: personal data is never sent to a model).
  const phoneM = text.match(/(?:\+?90[\s-]?)?0?\s?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/);
  const phone = phoneM ? f(phoneM[0].replace(/[^\d+]/g, '').replace(/^(\+?90)?0?/, '0'), 'high', phoneM[0]) : null;
  const emailM = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const email = emailM ? f(emailM[0].toLowerCase(), 'high') : null;
  const addrM = text.match(/(?:adres(?:im)?|konum|yer)\s*[:\-]?\s*([^\n]{8,160})/iu) ?? text.match(/([^\n]*\b(?:mah(?:allesi)?\.?|sok(?:ak|\.)|cad(?:desi|\.)|no\s*:?\s*\d+)[^\n]*)/iu);
  const address = addrM ? f(addrM[1].trim().replace(/\s+/g, ' '), addrM[0].toLowerCase().includes('adres') ? 'high' : 'medium') : null;

  // Customer: a signature ("Ahmet Yılmaz" on its own last line), "ben X", or a dative at the start.
  let customer: Field<string> | null = null;
  const sig = text.split('\n').map((l) => l.trim()).filter(Boolean).reverse().find((l) => /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+){1,2}$/u.test(l));
  const ben = text.match(/\b(?:ben|adım|ismim)\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)?)/u);
  if (ben) customer = f(ben[1], 'high', ben[0]);
  else if (sig) customer = f(sig, 'medium', 'imza satırı');
  else { const d = parseCustomer(text.split('\n')[0]); if (d && d.split(' ').length <= 3) customer = f(d, 'low', 'ilk satır'); }

  // Lines: each sentence/line with a measure is one product; the colour/family nearest to it apply.
  const chunks = text.split(/\n|(?<=[.!?])\s+|,?\s+(?:bir de|ayrıca)\s+|\s+ve\s+(?=\d)/u).map((c) => c.trim()).filter(Boolean);
  const globalColor = parseColorWords(text);
  const globalFamily = FAMILIES.find(([re]) => re.test(text))?.[1] ?? null;
  const lines: RequestLine[] = [];
  // A colour said once for one product may apply to it; with several products it is not spread to
  // the others (which one it belongs to is the person's call, so the line stays empty and yellow).
  const productChunks = chunks.filter((c) => parseDims(c)).length;
  for (const c of chunks) {
    const dims = parseDims(c);
    if (!dims) continue;
    const fam = FAMILIES.find(([re]) => re.test(c))?.[1] ?? null;
    const col = parseColorWords(c);
    const qtyM = c.match(/(\d+)\s*(?:adet|tane|tk|ad\.?)\b/iu) ?? c.match(/\b(iki|üç|dört|beş)\s*(?:adet|tane)?\b/iu);
    const words: Record<string, number> = { iki: 2, üç: 3, dört: 4, beş: 5 };
    const qty = qtyM ? Number(words[qtyM[1].toLocaleLowerCase('tr-TR')] ?? qtyM[1]) : 1;
    const metresUnstated = !/\b(m|metre|cm|mm)\b/iu.test(c) && Math.max(dims.widthMm, dims.projectionMm) <= 30000;
    lines.push({
      family: fam ? f(fam, 'high', c) : globalFamily ? f(globalFamily, 'medium', 'mesajın geneli') : null,
      // "3x4" without a unit is read as metres (how people write it); said so with medium confidence.
      widthMm: f(dims.widthMm, metresUnstated ? 'medium' : 'high', c),
      projectionMm: f(dims.projectionMm, metresUnstated ? 'medium' : 'high', c),
      color: col ? f(col, 'high', c) : globalColor && productChunks === 1 ? f(globalColor, 'medium', 'mesajın geneli') : null,
      quantity: f(qty, qtyM ? 'high' : 'medium', c),
    });
  }
  if (!lines.length) notes.push('Mesajda ölçü bulunamadı; ürün satırı açılmadı.');
  if (lines.some((l) => !l.color)) notes.push('Renk belirtilmemiş satır var.');
  return { customer, phone, email, address, lines, notes };
}

/** Fields below "high" are the ones the screen marks yellow for the person to check. */
export const needsReview = (r: QuoteRequest) =>
  [r.customer, r.phone, r.address, ...r.lines.flatMap((l) => [l.family, l.widthMm, l.projectionMm, l.color, l.quantity])].filter((x) => !x || x.confidence !== 'high').length;
