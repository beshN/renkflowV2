/**
 * What an order draft still lacks, and the message that asks the customer for it (pure, Turkish, no
 * model): the person copies and sends it themselves. Only things the customer can answer are asked
 * (size, quantity, colour, delivery date); optional details such as motor or LED are not chased.
 * No gendered forms (Bey/Hanım) are guessed from names.
 */
import type { DocumentExtraction } from '@/lib/ai/extraction';

type Draft = Pick<DocumentExtraction, 'customerName' | 'deliveryDate' | 'items'>;

const SIZE_FIELDS = ['widthMm', 'projectionMm', 'heightMm'];
const positive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const filled = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

/** One line per product that lacks something, in the order of the draft. */
export function missingInfo(d: Draft): { lines: string[]; deliveryDate: boolean } {
  const lines: string[] = [];
  d.items.forEach((item, index) => {
    const asks: string[] = [];
    if (!positive(item.quantity)) asks.push('adet');
    if (!positive(item.widthMm)) asks.push('genişlik (en)');
    // A product has a depth (açılım) or a height (zip, giyotin); one of them is enough.
    if (!positive(item.projectionMm) && !positive(item.heightMm)) asks.push('açılım (çıkma) ya da yükseklik');
    if (!filled(item.color)) asks.push('renk (RAL kodu varsa yazın)');
    else if ((item.uncertainFields ?? []).includes('color')) asks.push('rengin RAL kodu');
    const sizeUnsure = (item.uncertainFields ?? []).some((f) => SIZE_FIELDS.includes(f)) && positive(item.widthMm);
    if (sizeUnsure) {
      const other = positive(item.projectionMm) ? item.projectionMm : item.heightMm;
      asks.push(`ölçünün doğrulanması (${item.widthMm} × ${other ?? '?'} mm: ilk sayı genişlik mi, ikincisi açılım/yükseklik mi?)`);
    }
    if (asks.length) lines.push(`${item.productName?.trim() || `${index + 1}. ürün`}: ${asks.join(', ')}`);
  });
  return { lines, deliveryDate: !filled(d.deliveryDate) };
}

/** The message to the customer, or null when the draft has everything we would ask for. */
export function missingInfoMessage(d: Draft, firm?: string | null): string | null {
  const { lines, deliveryDate } = missingInfo(d);
  if (!lines.length && !deliveryDate) return null;
  const name = d.customerName?.trim();
  const asks = [...lines.map((l) => `• ${l}`), ...(deliveryDate ? ['• Teslim almak istediğiniz tarih'] : [])];
  return [
    name ? `Merhaba ${name},` : 'Merhaba,',
    '',
    'Siparişinizi hazırlayabilmemiz için aşağıdaki bilgilere ihtiyacımız var:',
    '',
    ...asks,
    '',
    'Bu bilgileri yazmanız yeterli, hemen devam edelim.',
    '',
    ['İyi çalışmalar,', firm?.trim()].filter(Boolean).join('\n'),
  ].join('\n');
}
