/**
 * Everyday talk the command box should answer instead of "anlayamadım" (pure): greetings, thanks,
 * "what can you do". Anything else goes on to the model or to a search of the firm's records.
 */

const fold = (s: string) =>
  s.toLocaleLowerCase('tr-TR').replace(/[’'`´]/g, '').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();

const CAPABILITIES =
  'Siparişleri, teslimatları, stoğu, faturaları ve satın almaları sorabilir, teklif taslağı hazırlatabilir, bir siparişi öne alırsak ya da geciktirirsek ne olacağını görebilirsiniz.';

const RULES: Array<[RegExp, string]> = [
  [/^(selam|selamlar|slm|merhaba|merhabalar|mrb|hey|hi|hello|günaydın|tünaydın|iyi günler|iyi akşamlar|iyi geceler)( .*)?$/u, 'Merhaba! Size nasıl yardımcı olabilirim?'],
  [/^(naber|nbr|ne haber|nasılsın|nasılsınız|nasıl gidiyor|ne var ne yok|n aber|napıyorsun|ne yapıyorsun)( .*)?$/u, 'İyiyim, teşekkürler! Siz nasılsınız? Bugün neye bakalım?'],
  [/^(teşekkürler|teşekkür ederim|teşekkür|sağ ol|sağol|eyvallah|tşk|tesekkurler|çok sağ ol|saol)( .*)?$/u, 'Rica ederim, başka bir şey lazım olursa buradayım.'],
  [/^(tamam|ok|okey|anladım|peki|olur|harika|süper)( .*)?$/u, 'Tamam. Başka bir şey sormak isterseniz yazın.'],
  [/^(ne yapabilirsin|neler yapabilirsin|neler yapabiliyorsun|ne işe yararsın|sen ne yapıyorsun|yardım|yardim|help|komutlar|nasıl kullanılır|nasıl kullanırım|bana yardım et|yardımcı olur musun)( .*)?$/u, CAPABILITIES],
  [/^(sen kimsin|kimsin|adın ne|ismin ne)( .*)?$/u, `Ben RenkFlow asistanıyım. ${CAPABILITIES}`],
];

/** The reply to everyday talk, or null when the text is not small talk. */
export function smallTalk(text: string): string | null {
  const t = fold(text);
  if (!t) return null;
  for (const [re, reply] of RULES) if (re.test(t)) return reply;
  return null;
}

const STOP = new Set(('bir bu şu o ve ile için ama de da mi mı mu mü ne nerede neden nasıl kaç kim hangi var yok bana benim bize göster getir ver listele bak bakar mısın mısınız lütfen şunu bunu ' +
  'şey bütün tüm hepsi hakkında ilgili olan olanlar olarak gibi daha çok az en kadar sonra önce şimdi bugün yarın').split(' '));

/** Words worth searching the firm's records for (names, order numbers, materials), longest first. */
export function searchWords(text: string, max = 3): string[] {
  const words = fold(text).split(' ').filter((w) => w.length >= 3 && !STOP.has(w));
  return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, max);
}
