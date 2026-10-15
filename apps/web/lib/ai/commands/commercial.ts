/** Only explicitly supplied commercial terms are read; zero VAT/discount are real values. */
export function quoteCommercialTerms(text: string) {
  const number = (value: string) => {
    const s = value.replace(/\s/g, '');
    return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(?:\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s);
  };
  const amount = /(?:₺\s*([\d.,]+)|([\d.,]+)\s*(?:₺|tl|try|eur|euro|€|usd|dolar|\$))(?!\p{L})/iu.exec(text);
  const discount = /(?:yüzde|%)\s*(\d+(?:[.,]\d+)?)\s*(?:iskonto|indirim)|(?:iskonto|indirim)\s*(?:yüzde|%)?\s*(\d+(?:[.,]\d+)?)/iu.exec(text);
  const vat = /(?:kdv\s*(?:yüzde|%)?\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:%\s*)?kdv)/iu.exec(text);
  const result: { unitPrice?: number; discountPercent?: number; vatPercent?: number; currency?: 'TRY' | 'EUR' | 'USD'; issues?: string[] } = {};
  const issues: string[] = [];
  if (amount) {
    const value = number(amount[1] ?? amount[2]);
    if (Number.isFinite(value) && value >= 0 && value <= 1e12) {
      result.unitPrice = value;
      result.currency = /eur|euro|€/iu.test(amount[0]) ? 'EUR' : /usd|dolar|\$/iu.test(amount[0]) ? 'USD' : 'TRY';
    } else issues.push('Fiyat geçerli bir tutar olmalı.');
  }
  if (discount) { const value = number(discount[1] ?? discount[2]); if (value >= 0 && value <= 100) result.discountPercent = value; else issues.push('İskonto %0 ile %100 arasında olmalı.'); }
  if (vat) { const value = number(vat[1] ?? vat[2]); if ([0, 1, 10, 20].includes(value)) result.vatPercent = value; else issues.push('Desteklenen KDV oranları %0, %1, %10 ve %20.'); }
  if (issues.length) result.issues = issues;
  return result;
}
