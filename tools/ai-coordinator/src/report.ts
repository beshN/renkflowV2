import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from './types.ts';
import type { Store } from './store.ts';
import { nowIso } from './util.ts';

export async function writeReport(store: Store, cfg: Config): Promise<string> {
  const board = await store.readBoard();
  const usage = await store.readUsage();
  const count = (s: string) => board.tasks.filter((t) => t.status === s).length;
  const lines = [
    '# RenkFlow AI — İlerleme Raporu', '', `Oluşturulma: ${nowIso()}`, '',
    '## Özet', '',
    `Toplam ${board.tasks.length} görev — bitti: ${count('done')}, PR'a hazır: ${count('ready_for_pr')}, çalışıyor/denetimde: ${count('in_progress') + count('in_review')}, düzeltme bekliyor: ${count('changes_requested')}, Sonnet kararı bekliyor: ${count('escalated')}, engelli: ${count('blocked')}, bekliyor: ${count('todo')}.`, '',
    '## Maliyet ve limitler', '',
    `- Model çağrısı: ${usage.runs}/${cfg.limits.maxTotalRuns}`,
    `- Raporlanan maliyet: $${usage.totalUsd.toFixed(4)} / $${cfg.limits.maxTotalUsd} (yalnızca maliyet bildiren CLI'lar; Gemini/Codex için çağrı sayısı limiti geçerli)`,
    `- Ardışık hata: ${usage.consecutiveFailures}/${cfg.limits.maxConsecutiveFailures}`,
    ...Object.entries(usage.perModel).map(([m, v]) => `- ${m}: ${v.runs} çağrı, $${v.usd.toFixed(4)}, ${(v.ms / 1000).toFixed(0)} sn`), '',
    '## Görevler', '', '| ID | Başlık | Sahip→Denetçi | Öncelik | Durum | Deneme | Sonraki işlem |', '|---|---|---|---|---|---|---|',
    ...board.tasks.map((t) => `| ${t.id} | ${t.title} | ${t.owner}→${t.reviewer} | ${t.priority} | ${t.status} | ${t.attempts} | ${(t.blockedReason ?? t.nextAction).replace(/\|/g, '/').slice(0, 140)} |`), '',
  ];
  const path = join(store.dir, 'reports', 'PROGRESS.md');
  await mkdir(join(store.dir, 'reports'), { recursive: true });
  await writeFile(path, `${lines.join('\n')}\n`);
  return path;
}
