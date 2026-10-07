/**
 * Repeatable evaluation: accuracy, made-up values, latency, tokens and cost per provider.
 *   npm run evals -- --task order-extraction --provider openai [--limit 5]
 * Results go to evals/results/<time>-<task>-<provider>.json; a summary table is printed.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { formatSummary, scoreCase, summarize, type CaseScore, type EvalCase } from './core';
import { productProvider, replayProvider, type EvalProvider } from './providers';

function arg(name: string, fallback?: string) {
  const index = process.argv.indexOf('--' + name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

export function loadDataset(task: string): EvalCase[] {
  const file = path.join(__dirname, 'datasets', task + '.jsonl');
  return readFileSync(file, 'utf8').split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
}

export async function runEval(provider: EvalProvider, cases: EvalCase[]): Promise<CaseScore[]> {
  const scores: CaseScore[] = [];
  for (const testCase of cases) {
    try {
      const run = await provider.extract(testCase);
      scores.push(scoreCase(testCase, run.items, run));
    } catch (error) {
      // An error is reported as an error, never replaced by a guessed answer.
      scores.push({ id: testCase.id, correct: 0, total: testCase.expected.length * 6, fabricated: 0, missed: 0, wrong: [], latencyMs: 0, inputTokens: null, outputTokens: null, costUsd: null, error: error instanceof Error ? error.message.slice(0, 200) : 'error' });
    }
  }
  return scores;
}

async function main() {
  const task = arg('task', 'order-extraction')!;
  const providerName = arg('provider', 'openai')!;
  const limit = Number(arg('limit', '0'));
  const provider = providerName === 'replay' ? replayProvider(arg('file')!) : providerName === 'openai' ? productProvider() : null;
  if (!provider) throw new Error(`Bilinmeyen sağlayıcı: ${providerName}. Sağlayıcı katmanı gelene kadar yalnız "openai" ve "replay" var.`);
  const missing = provider.available();
  if (missing) {
    console.error(`Değerlendirme çalıştırılmadı: ${missing}. Sonuç üretilmedi (tahmini rakam yazılmaz).`);
    process.exitCode = 2;
    return;
  }
  const cases = loadDataset(task).slice(0, limit > 0 ? limit : undefined);
  const scores = await runEval(provider, cases);
  const summary = summarize(provider.name, provider.model, scores);
  mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  const out = path.join(__dirname, 'results', `${new Date().toISOString().replace(/[:.]/g, '-')}-${task}-${provider.name}.json`);
  writeFileSync(out, JSON.stringify({ task, summary, scores }, null, 2));
  console.log(formatSummary([summary]));
  console.log('Ayrıntı: ' + path.relative(process.cwd(), out));
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });
