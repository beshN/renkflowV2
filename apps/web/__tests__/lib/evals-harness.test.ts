/** @jest-environment node */
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scoreCase, summarize, formatSummary, type EvalCase } from '../../evals/core';
import { replayProvider } from '../../evals/providers';
import { loadDataset, runEval } from '../../evals/run';

const pergola: EvalCase = { id: 'p', input: '1 adet pergola 5400x4200 RAL 7016', expected: [{ productName: 'pergola', quantity: 1, widthMm: 5400, projectionMm: 4200, heightMm: null, color: '7016' }] };
const run = { latencyMs: 100, inputTokens: 1000, outputTokens: 200, costUsd: 0.003 };

it('scores fields, counts made-up values apart from honest blanks', () => {
  const exact = scoreCase(pergola, [{ productName: 'Pergola 108', quantity: 1, widthMm: 5400, projectionMm: 4200, heightMm: null, color: 'RAL 7016 Antrasit' }], run);
  expect(exact).toMatchObject({ correct: 6, total: 6, fabricated: 0, missed: 0 });
  const invented = scoreCase(pergola, [{ productName: 'pergola', quantity: 1, widthMm: 5400, projectionMm: null, heightMm: 2500, color: '7016' }, { productName: 'tente' }], run);
  expect(invented).toMatchObject({ correct: 4, fabricated: 2, missed: 1 });
});

it('runs a dataset through a provider, counts a failed case as zero, and reports cost only when known', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'evals-'));
  const file = path.join(dir, 'replay.json');
  const cases = loadDataset('order-extraction');
  writeFileSync(file, JSON.stringify(Object.fromEntries(cases.map((c) => [c.id, c.expected]))));
  const perfect = summarize('replay', 'x', await runEval(replayProvider(file), cases));
  expect(perfect).toMatchObject({ cases: cases.length, errors: 0, accuracy: 1, fabricated: 0, costUsd: null });

  const failing = summarize('broken', 'x', await runEval({ name: 'broken', model: 'x', available: () => null, extract: async () => { throw new Error('timeout'); } }, cases.slice(0, 2)));
  expect(failing).toMatchObject({ errors: 2, accuracy: 0 });
  expect(formatSummary([perfect, failing])).toContain('| broken | x | 2 | 2 | 0.0% |');
});

it('keeps the dataset free of contact data', () => {
  for (const testCase of loadDataset('order-extraction')) expect(testCase.input).not.toMatch(/@|\b0?5\d{2}[\s-]?\d{3}/);
});
