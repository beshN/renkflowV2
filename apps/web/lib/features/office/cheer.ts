/**
 * The staff notice the racing record: when a run on the games screen beats the personal best, the
 * nearest member of staff with nothing pressing waves and says something about it. Pure helpers,
 * so the page and the tests share them.
 */

import type { Point } from './layout';
import type { Agent, AgentPhase } from './simulation';

export type RallyRun = { score: number; best: number; previousBest: number; isRecord: boolean };

/** A finished run with the record before it: whether it beat that record, and the record after. */
export function runResult(score: number, previousBest: number): RallyRun {
  const s = Math.max(0, Math.floor(score)), before = Math.max(0, Math.floor(previousBest));
  const isRecord = s > before;
  return { score: s, previousBest: before, best: isRecord ? s : before, isRecord };
}

/** Points the Turkish way: 4250 → "4.250". */
export const formatScore = (value: number) => String(Math.max(0, Math.floor(value))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Who may stop for a word: someone lounging, on a break or at the manager's desk, standing still.
 * Never anyone at work, in a meeting (briefing, checking, called over) or walking somewhere.
 */
const FREE: ReadonlySet<AgentPhase> = new Set<AgentPhase>(['lounge', 'break', 'managing']);
export const isFree = (agent: Pick<Agent, 'phase' | 'path'>) => FREE.has(agent.phase) && agent.path.length === 0;

/** The free member of staff nearest `spot` (the games corner), or null when everyone is busy. */
export function pickCheerer<A extends Pick<Agent, 'id' | 'phase' | 'path' | 'position'>>(agents: readonly A[], spot: Point): A | null {
  let best: A | null = null, bestDistance = Infinity;
  for (const agent of agents) {
    if (!isFree(agent)) continue;
    const distance = Math.hypot(agent.position.x - spot.x, agent.position.z - spot.z);
    if (distance < bestDistance) { best = agent; bestDistance = distance; }
  }
  return best;
}

/** A new record, in each person's own voice; `{score}` becomes the points. Same staff ids as the quips. */
export const CHEERS: Record<string, string[]> = {
  manager: ['Rekor! {score} puan, kahveler benden.', '{score} puan mı? Bunu panoya yazıyorum.', 'Yeni rekor: {score}. Toplantıda konuşacağız, ama tebrikler.'],
  deniz: ['{score} puan! Bunun afişini ben tasarlarım.', 'Rekor {score}. Renk paletin bile hızlı.', '{score}! Kupaya logo çizeyim mi?'],
  elif: ['{score} puan rekor, tutanağa geçti.', 'Rekor {score}. Resmi olarak tebrik ederim.', '{score} puan. Saygılarımla, çok etkilendim.'],
  murat: ['{score} puan, kuruşu kuruşuna. Rekor!', 'Tabloya işledim: yeni rekor {score}.', '{score}… ortalamayı fena yükselttiniz.'],
  zeynep: ['{score} puan! Bu bir kapak slaytı olur.', 'Rekor {score}. Tek slayt, tek fikir: harika.', '{score} puan, sunumda gösteririm.'],
  kerem: ['{score} puan, kaynağı da ben: gözümle gördüm.', 'Rakiplerde böyle skor yok: {score}.', 'Rekor {score}. Not aldım, araştıracağım.'],
  selin: ['Konu: Yeni rekor, {score} puan. Tümünü Yanıtla!', '{score} puan! Duyuru e-postasını hazırlıyorum.', 'Sevgilerle tebrikler: {score} puan.'],
  can: ['{score} puan! İngilizcesi: new record.', 'Rekor {score}. Almancası: Rekordpunktzahl.', '{score}, hangi dilde söylesem harika.'],
  aylin: ['{score} puan, veri temiz: rekor.', 'Yeni kayıt eklendi: {score}. Tekrarı yok.', 'Rekor {score}. Bu satırı silmiyorum.'],
};

/** The first score on this device is no record to beat yet: a softer word. */
export const FIRST_RUN = ['İlk skor {score}. Fena değil, rekor sizin artık.', '{score} puanla başladınız, bakalım geçebilecek misiniz.', 'İlk tur {score}. Sıradaki daha iyi olur.'];

/** The line `agentId` says about `run`, or null when there is nothing to say (no record). `random` picks among the lines. */
export function cheerLine(agentId: string, run: RallyRun, random: () => number = Math.random): string | null {
  if (!run.isRecord) return null;
  const lines = run.previousBest > 0 ? CHEERS[agentId] ?? ['Rekor! {score} puan.'] : FIRST_RUN;
  const line = lines[Math.min(lines.length - 1, Math.floor(random() * lines.length))];
  return line.replace('{score}', formatScore(run.score));
}
