import { foldText } from '@/lib/shared/text/fold';

/**
 * Personal data never goes to the model provider as plain text (KVKK: sending it abroad is a
 * transfer). Before a prompt leaves the server, e-mails, phone numbers, TC kimlik numbers,
 * IBANs and the names we know (customer, contact, person fields) are replaced with stable
 * placeholders such as [KİŞİ_1]; the model answers in placeholders and `restore` puts the
 * real values back locally. Free text can still contain a name we were not told about, so
 * callers pass every name the request carries.
 */
export type Masked = {
  text: string;
  /** Puts the original values back into model output (strings, arrays and objects). */
  restore: <T>(value: T) => T;
  /** How many values of each kind were masked (for logs and tests; never the values). */
  counts: Record<string, number>;
};

const PATTERNS: Array<[label: string, pattern: RegExp]> = [
  ['E-POSTA', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
  ['IBAN', /\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi],
  // Digits glued to letters or a dash ("RF-20260012345", UUIDs) are codes, not identities.
  ['KİMLİK', /(?<![\p{L}\p{N}-])[1-9]\d{10}(?![\p{L}\p{N}])/gu],
  // With a +90 / 0 prefix: any Turkish number, (0212) 555 00 00 included. Without a prefix only the
  // mobile 5xx form, so dimension lists like "300 120 15 20" stay readable.
  ['TELEFON', /(?<![\p{L}\p{N}-])(?:\+90[\s-]?\(?[2-5]\d{2}\)?|\(?(?:0[2-5]\d{2}|5\d{2})\)?)[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?![\p{L}\p{N}])/gu],
];

/** Keys whose values are personal data wherever they appear in a JSON payload. E-mail and phone
 * values are also caught by the patterns above; names and addresses only through these keys. */
export const PERSONAL_KEYS = new Set([
  'customerName', 'customer_name', 'fullName', 'full_name', 'companyName', 'company_name', 'contactName', 'contact_name',
  'supplierName', 'supplier_name', 'assigneeName', 'assignee_name', 'workerName', 'worker_name',
  'email', 'phone', 'address', 'billingAddress', 'billing_address', 'shippingAddress', 'shipping_address',
  'taxNumber', 'tax_number', 'actorName', 'actor_name', 'userName', 'user_name',
]);

/** Values under these keys are left to the patterns, so they keep their own placeholder label. */
const PATTERN_KEYS = new Set(['email', 'phone']);

/** Collects the person-like string values of a payload so they can be masked in free text too. */
export function personalValues(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => personalValues(item, found));
  else if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      if ((PERSONAL_KEYS.has(key) || /(?:_by_name|ByName)$/.test(key)) && !PATTERN_KEYS.has(key) && typeof inner === 'string' && inner.trim().length >= 3) found.add(inner.trim());
      else personalValues(inner, found);
    }
  }
  return found;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type Masker = {
  /** Adds names (customer, contact…) that must be masked wherever they appear. */
  know: (values: Iterable<string>) => void;
  mask: (text: string) => string;
  /** Puts the original values back into model output (strings, arrays and objects). */
  restore: <T>(value: T) => T;
  counts: Record<string, number>;
};

/** One masker per model request: the same value gets the same placeholder in every part of it. */
export function createMasker(knownValues: Iterable<string> = []): Masker {
  const byValue = new Map<string, string>();
  const byToken = new Map<string, string>();
  const names = new Set<string>();
  const counts: Record<string, number> = {};
  const token = (label: string, original: string) => {
    const key = label + '\u0000' + (label === 'KİŞİ' ? foldText(original) : original);
    let placeholder = byValue.get(key);
    if (!placeholder) {
      counts[label] = (counts[label] ?? 0) + 1;
      placeholder = `[${label}_${counts[label]}]`;
      byValue.set(key, placeholder);
      byToken.set(placeholder, original);
    }
    return placeholder;
  };
  // One alternation regex over every known spelling, rebuilt only when names are added. Names
  // match as whole words only, so "Ali" does not touch "kalite".
  let namePattern: RegExp | null = null;
  const know = (values: Iterable<string>) => {
    for (const v of values) if (v.trim().length >= 3 && !names.has(v.trim())) { names.add(v.trim()); namePattern = null; }
  };
  know(knownValues);
  const nameRegex = () => {
    if (namePattern || !names.size) return namePattern;
    const spellings = new Set<string>();
    for (const name of names) for (const variant of [name, name.toLocaleUpperCase('tr-TR'), name.toLocaleLowerCase('tr-TR')]) spellings.add(variant);
    // Longest first, so "Ahmet Yılmaz Yapı" wins over "Ahmet Yılmaz".
    const alternatives = [...spellings].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
    namePattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, 'gu');
    return namePattern;
  };

  const mask = (text: string) => {
    const pattern = nameRegex();
    let out = pattern ? text.replace(pattern, (match) => token('KİŞİ', match)) : text;
    for (const [label, regex] of PATTERNS) out = out.replace(regex, (match) => token(label, match));
    return out;
  };
  const restoreString = (value: string) => value.replace(/\[(?:E-POSTA|IBAN|TELEFON|KİMLİK|KİŞİ)_\d+\]/g, (placeholder) => byToken.get(placeholder) ?? placeholder);
  const restore = <T,>(value: T): T => {
    if (typeof value === 'string') return restoreString(value) as T;
    if (Array.isArray(value)) return value.map((item) => restore(item)) as T;
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restore(v)])) as T;
    return value;
  };
  return { know, mask, restore, counts };
}

/** Masks one text; the same value always gets the same placeholder. */
export function maskPersonalData(text: string, knownValues: Iterable<string> = []): Masked {
  const masker = createMasker(knownValues);
  return { text: masker.mask(text), restore: masker.restore, counts: masker.counts };
}

/** Removes personal fields from a structured payload before it is sent (no restore needed). */
export function stripPersonalFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripPersonalFields(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !PERSONAL_KEYS.has(key)).map(([key, inner]) => [key, stripPersonalFields(inner)])) as T;
  }
  return value;
}
