/** Turkish IBAN: "TR" + 2 check digits + 22 digits (5 bank, 1 reserve, 16 account); mod-97 check. */
export function normalizeIban(raw: string) {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function validIban(raw: string) {
  const s = normalizeIban(raw);
  if (!/^TR\d{24}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const ch of digits) rest = (rest * 10 + Number(ch)) % 97;
  return rest === 1;
}

/** "TR12 0006 4000 0011 2345 6789 01" for display. */
export function formatIban(raw: string | null | undefined) {
  if (!raw) return '';
  return normalizeIban(raw).replace(/(.{4})/g, '$1 ').trim();
}
