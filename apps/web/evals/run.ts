/**
 * Repeatable evaluation: accuracy, made-up values, latency, tokens and cost per provider.
 *   npm run evals -- --task order-extraction --provider anthropic,openai,gemini,glm [--limit 5]
 * Each provider runs the same cases through the same product path. A provider without its key is
 * listed as not run; no numbers are produced for it. Results go to
 * evals/results/<time>-<task>-<provider>.json and one comparison table is printed.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { formatSummary, scoreCase, summarize, type CaseScore, type EvalCase } from './core';
import { productProvider, replayProvider, type EvalProvider } from './providers';
import { isProviderId } from '../lib/ai/providers';

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
      const run = (error as { run?: Partial<CaseScore> })?.run;
      scores.push({ id: testCase.id, correct: 0, total: testCase.expected.length * 6, fabricated: 0, missed: 0, wrong: [], latencyMs: run?.latencyMs ?? 0, inputTokens: run?.inputTokens ?? null, outputTokens: run?.outputTokens ?? null, costUsd: run?.costUsd ?? null, error: error instanceof Error ? error.message.slice(0, 200) : 'error' });
    }
  }
  return scores;
}

export function selectProviders(list: string, file?: string): EvalProvider[] {
  return list.split(',').map((name) => name.trim()).filter(Boolean).map((name) => {
    if (name === 'replay') {
      if (!file) throw new Error('replay sağlayıcısı için --file <kayıt.json> gerekli.');
      return replayProvider(file);
    }
    if (!isProviderId(name)) throw new Error(`Bilinmeyen sağlayıcı: ${name}. Geçerli: anthropic, openai, gemini, glm, replay.`);
    return productProvider(name);
  });
}

async function main() {
  const task = arg('task', 'order-extraction')!;
  const providers = selectProviders(arg('provider', 'anthropic')!, arg('file'));
  const limit = Number(arg('limit', '0'));
  const cases = loadDataset(task).slice(0, limit > 0 ? limit : undefined);
  const skipped = providers.flatMap((p) => { const reason = p.available(); return reason ? [{ provider: p, reason }] : []; });
  const runnable = providers.filter((p) => !p.available());
  // Providers run side by side; within one provider the cases run one after another, so
  // per-call latency is measured the same way.
  const summaries = await Promise.all(runnable.map(async (provider) => {
    const scores = await runEval(provider, cases);
    const summary = summarize(provider.name, provider.model, scores);
    mkdirSync(path.join(__dirname, 'results'), { recursive: true });
    const out = path.join(__dirname, 'results', `${new Date().toISOString().replace(/[:.]/g, '-')}-${task}-${provider.name}.json`);
    writeFileSync(out, JSON.stringify({ task, summary, scores }, null, 2));
    console.log('Ayrıntı: ' + path.relative(process.cwd(), out));
    return summary;
  }));
  if (summaries.length) console.log(formatSummary(summaries));
  // Asked-for providers that did not run are part of the result, not a footnote.
  for (const { provider, reason } of skipped)
    console.log(`| ${provider.name} | ${provider.model} | çalıştırılmadı: ${reason}; rakam yok |`);
  if (!summaries.length) console.error('Hiçbir sağlayıcı çalıştırılmadı; karşılaştırma yok.');
  if (skipped.length) process.exitCode = 2;
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });
