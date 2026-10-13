/**
 * Assistant eval (gece 3): Turkish commands and pasted quote requests, slang included.
 *   npm run evals:assistant -- --provider rules,anthropic,openai,gemini,glm
 * "rules" is the deterministic reader the product uses first (no model, no cost). A model provider
 * runs the product's own model path (commands: AIService.parseCommand, OpenAI only; quote requests:
 * AIService.analyzeText) and is listed as not run when its key is missing — no numbers are made up.
 * Writes evals/results/<time>-assistant.md with the table and every failing case.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseCommand } from '../lib/ai/commands/parse';
import { extractQuoteRequest } from '../lib/ai/extract/quote-request';
import { isProviderId, providerUnavailable } from '../lib/ai/providers';
import { scoreCommand, scoreQuoteRequest, summarizeAssistant, type AssistantCase, type AssistantScore } from './assistant-core';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] : fallback; };
const cases: AssistantCase[] = readFileSync(path.join(__dirname, 'datasets', 'assistant-tr.jsonl'), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const FAMILIES = ['pergola', 'awning', 'guillotine', 'zip', 'rolling_roof', 'winter_garden'];

async function runRules(): Promise<AssistantScore[]> {
  return cases.map((c) => {
    const t0 = performance.now();
    if (c.task === 'command') { const p = parseCommand(c.input, FAMILIES); return scoreCommand(c, { command: p.command as any, missing: p.missing }, performance.now() - t0); }
    const r = extractQuoteRequest(c.input);
    return scoreQuoteRequest(c, { customer: r.customer?.value ?? null, lines: r.lines.map((l) => ({ family: l.family?.value ?? null, widthMm: l.widthMm?.value ?? null, projectionMm: l.projectionMm?.value ?? null, color: l.color?.value ?? null, quantity: l.quantity.value })) }, performance.now() - t0);
  });
}

async function runModel(id: string): Promise<AssistantScore[]> {
  const { getAIService } = await import('../lib/ai/service');
  const { parseColorWords } = await import('../lib/ai/commands/parse');
  const out: AssistantScore[] = [];
  for (const c of cases) {
    const t0 = performance.now();
    try {
      if (c.task === 'command') {
        if (id !== 'anthropic') { out.push({ id: c.id, task: c.task, pass: false, fabricated: 0, wrong: [], latencyMs: 0, error: 'komut yolu yalnız Anthropic' }); continue; }
        const command = await getAIService().parseCommand(c.input, { feature: 'eval.assistant' });
        const complete = command.intent !== 'unknown' && !(command.intent === 'quote_draft' && (!command.widthMm || !command.family));
        out.push(scoreCommand(c, { command: command as any, missing: complete ? [] : ['?'] }, performance.now() - t0));
      } else {
        const r = await getAIService().analyzeText(c.input, [], { feature: 'eval.assistant' }, id as any);
        const fam = (n: string | null) => (!n ? null : /tente/i.test(n) ? 'awning' : /zip/i.test(n) ? 'zip' : /giyotin/i.test(n) ? 'guillotine' : /kış/i.test(n) ? 'winter_garden' : /pergola|bioklimatik/i.test(n) ? 'pergola' : null);
        out.push(scoreQuoteRequest(c, { customer: r.customerName, lines: r.items.map((i) => ({ family: fam(i.productName), widthMm: i.widthMm, projectionMm: i.projectionMm ?? i.heightMm, color: i.color ? parseColorWords(i.color) ?? i.color : null, quantity: i.quantity ?? 1 })) }, performance.now() - t0));
      }
    } catch (e) {
      out.push({ id: c.id, task: c.task, pass: false, fabricated: 0, wrong: [], latencyMs: performance.now() - t0, error: e instanceof Error ? e.message.slice(0, 160) : 'hata' });
    }
  }
  return out;
}

async function main() {
  const providers = arg('provider', 'rules').split(',').map((s) => s.trim()).filter(Boolean);
  const rows: string[] = ['| Okuyucu | Komut | Mesajdan teklif | Toplam | Uydurma | Hata | Medyan süre |', '|---|---|---|---|---|---|---|'];
  const fails: string[] = [];
  let anyMissing = false;
  for (const p of providers) {
    if (p !== 'rules') {
      const why = isProviderId(p) ? providerUnavailable(p) : 'bilinmeyen sağlayıcı';
      if (why) { rows.push(`| ${p} | çalıştırılmadı (${why}) | | | | | |`); anyMissing = true; continue; }
    }
    const scores = p === 'rules' ? await runRules() : await runModel(p);
    const s = summarizeAssistant(p, scores);
    rows.push(`| ${p} | ${s.commands} | ${s.quoteRequests} | ${s.total} | ${s.fabricated} | ${s.errors} | ${s.medianMs === null ? '—' : `${s.medianMs.toFixed(1)} ms`} |`);
    for (const x of scores.filter((x) => !x.pass)) fails.push(`- ${p} · ${x.id}: ${x.error ?? x.wrong.join('; ')}`);
  }
  const report = [`# Asistan değerlendirmesi (${cases.length} vaka)`, '', `Veri seti: evals/datasets/assistant-tr.jsonl · ${new Date().toISOString()}`, '', ...rows, '', '## Geçemeyen vakalar', '', ...(fails.length ? fails : ['- yok']), ''].join('\n');
  mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  const file = path.join(__dirname, 'results', `${new Date().toISOString().replace(/[:.]/g, '-')}-assistant.md`);
  writeFileSync(file, report);
  console.log(report);
  console.log(`→ ${path.relative(process.cwd(), file)}`);
  if (anyMissing) process.exitCode = 2;
}

main().catch((e) => { console.error(e); process.exit(1); });
