/**
 * Message drafts written by rule (pure, Turkish): what the person copies and sends themselves.
 * Tone follows the customer's history: a firm or a first-time customer gets the formal form, a
 * returning person the warm one. No gendered forms (Bey/Hanım) are guessed from names.
 */

export type Tone = 'formal' | 'warm';

const dmy = (d: string) => d.slice(0, 10).split('-').reverse().join('.');
const money = (n: number, currency = 'TRY') => `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency === 'TRY' ? 'TL' : currency}`;

/** Formal for a company or someone without earlier business; warm for a returning person. */
export function toneFor(c: { isCompany: boolean; pastOrders: number }): Tone {
  return c.isCompany || c.pastOrders < 1 ? 'formal' : 'warm';
}

const greet = (name: string | null, tone: Tone) => {
  const n = (name ?? '').trim();
  if (tone === 'formal') return n ? `Sayın ${n},` : 'Merhaba,';
  return n ? `Merhaba ${n},` : 'Merhaba,';
};
const close = (firm: string | null, tone: Tone) => (tone === 'formal' ? `Saygılarımızla,\n${firm ?? ''}`.trim() : `İyi çalışmalar,\n${firm ?? ''}`.trim());

export function lateOrderMessage(p: { customer: string | null; firm: string | null; orderNumber: string; oldDate: string | null; newDate: string; reason: string; tone: Tone }) {
  const old = p.oldDate ? ` ${dmy(p.oldDate)} tarihinde teslim etmeyi planladığımız` : '';
  return [
    greet(p.customer, p.tone),
    '',
    `${p.orderNumber} numaralı siparişinizle ilgili bilgi vermek isteriz:${old} siparişiniz ${p.reason} nedeniyle gecikecek.`,
    `Yeni tahmini teslim tarihimiz ${dmy(p.newDate)}. Gecikme için özür dileriz; gelişmeleri size ayrıca bildireceğiz.`,
    '',
    close(p.firm, p.tone),
  ].join('\n');
}

export function quoteFollowUpMessage(p: { customer: string | null; firm: string | null; quoteNumber: string; days: number; validUntil: string | null; step: 1 | 2; tone: Tone }) {
  const valid = p.validUntil ? ` Teklifimiz ${dmy(p.validUntil)} tarihine kadar geçerlidir.` : '';
  const body = p.step === 1
    ? `${p.days} gün önce ilettiğimiz ${p.quoteNumber} numaralı teklifimizi inceleme fırsatınız oldu mu? Sorularınız ya da değiştirmek istediğiniz bir ölçü/renk varsa memnuniyetle güncelleriz.${valid}`
    : `${p.quoteNumber} numaralı teklifimizle ilgili son durumu öğrenmek istedik. Karar verirken yardımcı olabileceğimiz bir konu varsa (keşif, alternatif ürün, ödeme planı) bize yazmanız yeterli.${valid}`;
  return [greet(p.customer, p.tone), '', body, '', close(p.firm, p.tone)].join('\n');
}

export function paymentReminderMessage(p: { customer: string | null; firm: string | null; invoiceNumber: string; dueOn: string; openAmount: number; currency?: string; daysOverdue: number; tone: Tone }) {
  const body = p.daysOverdue <= 15
    ? `${dmy(p.dueOn)} vadeli ${p.invoiceNumber} numaralı faturamızın ${money(p.openAmount, p.currency)} tutarındaki bakiyesi görünüyor. Ödemeyi yaptıysanız bu mesajı dikkate almayınız; yapmadıysanız uygun olduğunuzda bilgi verirseniz seviniriz.`
    : `${dmy(p.dueOn)} vadeli ${p.invoiceNumber} numaralı faturamızın ${money(p.openAmount, p.currency)} tutarındaki bakiyesi ${p.daysOverdue} gündür açık. Ödeme planı konusunda konuşmak isterseniz memnuniyetle yardımcı oluruz.`;
  return [greet(p.customer, p.tone), '', body, '', close(p.firm, p.tone)].join('\n');
}
