export type CurrencyCode = 'TRY' | 'USD' | 'EUR' | 'GBP';

const SYMBOL_TO_CODE: Record<string, CurrencyCode> = {
  '₺': 'TRY',
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
};

const CODE_TO_SYMBOL: Record<CurrencyCode, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export function normalizeCurrencyInput(input: unknown): CurrencyCode {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return 'TRY';

  const upper = raw.toUpperCase();
  if (upper in CODE_TO_SYMBOL) return upper as CurrencyCode;

  if (raw in SYMBOL_TO_CODE) return SYMBOL_TO_CODE[raw];

  return 'TRY';
}

export function currencyCodeToSymbol(code: unknown): string {
  const normalized = normalizeCurrencyInput(code);
  return CODE_TO_SYMBOL[normalized];
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return normalizeCurrencyInput(value) === value;
}
