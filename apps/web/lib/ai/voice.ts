/**
 * Worker voice commands (pure, Turkish, no model): "Başla", "Bitti", "3 adet fire, kesim hatası".
 * The scrap reason must be one of the firm's own reasons (matched by its words); a phrase that does
 * not clearly say one of these is not guessed — the screen asks again.
 */
export type VoiceAction =
  | { action: 'start' }
  | { action: 'complete' }
  | { action: 'scrap'; quantity: number; reasonCode: string | null; reasonLabel: string | null };

const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
// (\b is ASCII-only in JS: Turkish letters need explicit letter look-arounds.)
const NUMBER_WORDS: Record<string, number> = { bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10 };

export function parseVoice(said: string, reasons: Array<{ code: string; label: string }>): VoiceAction | null {
  const t = fold(said);
  if (!t) return null;
  if (/(?<!\p{L})(fire|hurda|bozuk)/u.test(t)) {
    const n = t.match(/(\d+)\s*(?:adet|tane|parça)?\s*(?:fire|hurda|bozuk)/u)?.[1] ?? t.match(/(?<!\p{L})(bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)(?!\p{L})\s*(?:adet|tane|parça)?\s*(?:fire|hurda|bozuk)/u)?.[1];
    const quantity = n ? (/\d/.test(n) ? Number(n) : NUMBER_WORDS[n]) : 1;
    // The reason whose words all appear in what was said (the longest such label wins).
    const hit = reasons
      .map((r) => ({ r, words: fold(r.label).split(' ').filter((w) => w.length >= 3) }))
      .filter(({ words }) => words.length && words.every((w) => t.includes(w.slice(0, Math.max(3, w.length - 2)))))
      .sort((a, b) => b.words.length - a.words.length)[0]?.r ?? null;
    return { action: 'scrap', quantity, reasonCode: hit?.code ?? null, reasonLabel: hit?.label ?? null };
  }
  if (/^(bitti|bitir|bitirdim|tamamlandı|tamam|iş bitti)(?!\p{L})/u.test(t)) return { action: 'complete' };
  if (/^(başlıyorum|başladım|başlat|başla)(?!\p{L})/u.test(t)) return { action: 'start' };
  return null;
}
