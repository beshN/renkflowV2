import { foldText } from '../lib/shared/text/fold';

/** One labelled case: input text and the items a careful person would extract from it. */
export type EvalCase = { id: string; input: string; expected: ExpectedItem[] };
export type ExpectedItem = { productName: string | null; quantity: number | null; widthMm: number | null; heightMm: number | null; projectionMm: number | null; color: string | null };
type ActualItem = Partial<Record<keyof ExpectedItem, string | number | null>>;

export const FIELDS: Array<keyof ExpectedItem> = ['productName', 'quantity', 'widthMm', 'heightMm', 'projectionMm', 'color'];

export type CaseScore = {
  id: string; correct: number; total: number;
  /** Expected empty (not in the text) but filled in: a made-up value. */
  fabricated: number;
  /** Expected a value, got empty: the model said it did not know. Not an error of the same kind. */
  missed: number;
  wrong: Array<{ item: number; field: string; expected: unknown; actual: unknown }>;
  latencyMs: number; inputTokens: number | null; outputTokens: number | null; costUsd: number | null; error?: string;
};

const textMatches = (expected: string, actual: unknown) => typeof actual === 'string' && foldText(actual).includes(foldText(expected));

/** Field-by-field comparison; items are matched in order. Text fields match by folded containment. */
export function scoreCase(testCase: EvalCase, actualItems: ActualItem[], run: Pick<CaseScore, 'latencyMs' | 'inputTokens' | 'outputTokens' | 'costUsd'>): CaseScore {
  const score: CaseScore = { id: testCase.id, correct: 0, total: 0, fabricated: 0, missed: 0, wrong: [], ...run };
  testCase.expected.forEach((expectedItem, index) => {
    const actual = actualItems[index] ?? {};
    for (const field of FIELDS) {
      score.total += 1;
      const want = expectedItem[field];
      const got = actual[field] ?? null;
      const ok = want === null ? got === null : typeof want === 'string' ? textMatches(want, got) : Number(got) === want;
      if (ok) score.correct += 1;
      else {
        if (want === null) score.fabricated += 1;
        else if (got === null) score.missed += 1;
        score.wrong.push({ item: index, field, expected: want, actual: got });
      }
    }
  });
  // Extra items the text never asked for are fabrications too.
  score.fabricated += Math.max(0, actualItems.length - testCase.expected.length);
  return score;
}

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

export type Summary = {
  provider: string; model: string; cases: number; errors: number;
  accuracy: number; fabricated: number; missed: number;
  latencyP50Ms: number; latencyP95Ms: number;
  inputTokens: number; outputTokens: number; costUsd: number | null;
};

export function summarize(provider: string, model: string, scores: CaseScore[]): Summary {
  const ok = scores.filter((s) => !s.error);
  const correct = ok.reduce((sum, s) => sum + s.correct, 0);
  const total = scores.reduce((sum, s) => sum + (s.total || 0), 0);
  const costs = ok.map((s) => s.costUsd);
  return {
    provider, model, cases: scores.length, errors: scores.length - ok.length,
    // A failed case counts as zero correct: an outage is not a better score.
    accuracy: total ? Number((correct / total).toFixed(4)) : 0,
    fabricated: ok.reduce((sum, s) => sum + s.fabricated, 0),
    missed: ok.reduce((sum, s) => sum + s.missed, 0),
    latencyP50Ms: percentile(ok.map((s) => s.latencyMs), 50),
    latencyP95Ms: percentile(ok.map((s) => s.latencyMs), 95),
    inputTokens: ok.reduce((sum, s) => sum + (s.inputTokens ?? 0), 0),
    outputTokens: ok.reduce((sum, s) => sum + (s.outputTokens ?? 0), 0),
    costUsd: costs.length && costs.every((c) => c !== null) ? Number(costs.reduce((a, b) => a! + b!, 0)!.toFixed(6)) : null,
  };
}

export function formatSummary(rows: Summary[]): string {
  const header = '| Sağlayıcı | Model | Vaka | Hata | Doğruluk | Uydurma | Eksik | p50 ms | p95 ms | Girdi tok. | Çıktı tok. | Maliyet $ |';
  const line = '|---|---|---|---|---|---|---|---|---|---|---|---|';
  const body = rows.map((r) => `| ${r.provider} | ${r.model} | ${r.cases} | ${r.errors} | ${(r.accuracy * 100).toFixed(1)}% | ${r.fabricated} | ${r.missed} | ${r.latencyP50Ms} | ${r.latencyP95Ms} | ${r.inputTokens} | ${r.outputTokens} | ${r.costUsd ?? 'fiyat yok'} |`);
  return [header, line, ...body].join('\n');
}
