/**
 * Matching the name written on a föy to the firm's customer cards. Sheets are typed by hand
 * ("BLAK COFFEE" for Black Coffee), carry branch suffixes ("… POZ-2", "… /MAKEDONYA") and sometimes
 * leave the customer cell empty, so this ranks candidates and never picks one silently.
 */
export type CustomerCandidate = { id: string; name: string };
export type CustomerMatch = CustomerCandidate & { score: number; reason: 'aynı' | 'benzer' | 'içeriyor' };

const SUFFIXES = /\b(ltd|şti|sti|a ?ş|as|san|tic|inş|ins|ve|limited|şirketi|sirketi)\b\.?/g;

export function normalizeName(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c] as string)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/** Best candidates for the names on the sheet (customer cell, then address), strongest first. */
export function matchCustomers(names: Array<string | null | undefined>, customers: CustomerCandidate[], limit = 3): CustomerMatch[] {
  const wanted = names.filter((n): n is string => Boolean(n && n.trim())).map(normalizeName).filter((n) => n.length >= 3);
  if (!wanted.length) return [];
  const best = new Map<string, CustomerMatch>();
  for (const c of customers) {
    const n = normalizeName(c.name);
    if (n.length < 3) continue;
    for (const w of wanted) {
      let m: CustomerMatch | null = null;
      if (n === w) m = { ...c, score: 1, reason: 'aynı' };
      else {
        const d = distance(n, w);
        const ratio = 1 - d / Math.max(n.length, w.length);
        if (d <= 2 && ratio >= 0.8) m = { ...c, score: ratio, reason: 'benzer' };
        // "MÜŞTERİ C POZ-2" vs card "Müşteri C": the card name is the head of the sheet's name.
        else if ((w.startsWith(n + ' ') || n.startsWith(w + ' ')) && Math.min(n.length, w.length) >= 5) m = { ...c, score: 0.7, reason: 'içeriyor' };
      }
      if (m && (!best.has(c.id) || best.get(c.id)!.score < m.score)) best.set(c.id, m);
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'tr')).slice(0, limit);
}
