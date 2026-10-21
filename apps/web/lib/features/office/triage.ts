import { TASK_CATEGORIES, type TaskCategoryId } from './catalog';

/**
 * The manager reading a task written in plain words: which kind of work it is and a short title
 * for the board. On the server the model makes this call (triage.server.ts); these rules are the
 * fallback when it cannot, and the simulation's only judge.
 */

const RULES: Array<[TaskCategoryId, RegExp]> = [
  ['translation', /çevir|tercüme|ingilizce(ye|si)|almanca(ya|sı)|arapça(ya|sı)|rusça(ya|sı)|fransızca(ya|sı)|translate/i],
  ['presentation', /sunum|slayt|powerpoint|pptx|takdim/i],
  ['data', /listeyi|liste(leri)? (birleştir|temizle|düzenle)|veri girişi|ayrıştır|tekrar(lar)?ı (sil|temizle)|csv/i],
  ['design', /afiş|logo|tasarım|tasarla|görsel|banner|poster|broşür|kartvizit|instagram|sosyal medya|katalog sayfası/i],
  ['spreadsheet', /excel|xlsx|tablo|hesapla|fiyat listesi|maliyet|bütçe|formül|gider|gelir/i],
  ['research', /araştır|rakip|pazar|analiz et|karşılaştır|rapor hazırla|kaynaklı/i],
  ['correspondence', /e-?posta|mail|mektup|yazı yaz|cevap yaz|yanıtla|duyuru|teşekkür|özür|bildir/i],
  ['document', /word|docx|belge|dilekçe|sözleşme|tutanak|rapor|döküman|doküman|metin|form/i],
];

export type Triage = { category: TaskCategoryId; title: string; reason: string; by: 'model' | 'rules' };

/** Plain-words task → a short board title: the first sentence, at most about 80 characters. */
export function shortTitle(text: string) {
  const first = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0] ?? '';
  if (first.length <= 80) return first.replace(/[.!?]+$/, '') || 'Görev';
  const cut = first.slice(0, 80);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : 80)}…`;
}

/** The first rule that matches, in order of how specific it is; plain writing when nothing does. */
export function triageByRules(text: string): Triage {
  const hit = RULES.find(([, pattern]) => pattern.test(text));
  return { category: hit?.[0] ?? 'document', title: shortTitle(text), reason: hit ? 'anahtar kelimeye göre' : 'belirgin bir tür bulunamadı, belge olarak ele alındı', by: 'rules' };
}

export const isCategory = (value: unknown): value is TaskCategoryId => (TASK_CATEGORIES as readonly unknown[]).includes(value);
