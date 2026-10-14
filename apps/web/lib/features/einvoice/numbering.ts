// GİB invoice numbers: 16 characters, a three-letter series prefix, the year and a 9-digit
// sequence that restarts every year (RNK2026000000001).

const PREFIX = /^[A-Z]{3}$/;
const NUMBER = /^([A-Z]{3})(\d{4})(\d{9})$/;

export function isValidSeriesPrefix(prefix: string): boolean {
  return PREFIX.test(prefix);
}

export function formatInvoiceNumber(prefix: string, year: number, sequence: number): string {
  if (!isValidSeriesPrefix(prefix)) throw new Error('Seri öneki üç büyük harf olmalı');
  if (!Number.isInteger(year) || year < 2000 || year > 2999) throw new Error('Geçersiz yıl');
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999_999_999) throw new Error('Seri bu yıl için doldu');
  return `${prefix}${year}${String(sequence).padStart(9, '0')}`;
}

export function parseInvoiceNumber(value: string): { prefix: string; year: number; sequence: number } | null {
  const match = NUMBER.exec(value);
  return match ? { prefix: match[1], year: Number(match[2]), sequence: Number(match[3]) } : null;
}

/**
 * The next number of a series, taken inside the issuing transaction. The upsert locks the counter
 * row, so parallel issues wait for each other; a rolled-back issue gives its number back, so the
 * series has no gaps.
 */
export async function nextSeriesNumber(tx: any, tenantId: string, prefix: string, year: number): Promise<string> {
  if (!isValidSeriesPrefix(prefix)) throw new Error('Seri öneki üç büyük harf olmalı');
  const [row] = await tx`
    INSERT INTO invoice_number_series (tenant_id, prefix, year, last_number) VALUES (${tenantId}, ${prefix}, ${year}, 1)
    ON CONFLICT (tenant_id, prefix, year) DO UPDATE SET last_number = invoice_number_series.last_number + 1
    RETURNING last_number
  `;
  return formatInvoiceNumber(prefix, year, Number(row.last_number));
}
