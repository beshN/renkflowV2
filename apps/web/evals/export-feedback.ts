/**
 * Turns people's corrections of assistant suggestions (ai_feedback_examples) into an eval set:
 *   DATABASE_URL=... npm run evals:export -- --kind cutting_plan [--tenant <uuid>]
 * Writes evals/datasets/feedback-<kind>.jsonl with personal fields removed. Reads only from a local
 * database unless EVAL_EXPORT_ALLOW_REMOTE=1 is set on purpose (for example the Neon dev branch).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { stripPersonalFields } from '../lib/ai/privacy';

async function main() {
  const kindIndex = process.argv.indexOf('--kind');
  const kind = kindIndex >= 0 ? process.argv[kindIndex + 1] : '';
  if (!kind) throw new Error('--kind gerekli (ör. cutting_plan)');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL gerekli');
  const host = new URL(url).hostname;
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(host) && process.env.EVAL_EXPORT_ALLOW_REMOTE !== '1') {
    throw new Error(`Uzak veritabanı (${host}) için EVAL_EXPORT_ALLOW_REMOTE=1 gerekli. Production'dan dışa aktarmayın.`);
  }
  const db = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const tenantIndex = process.argv.indexOf('--tenant');
    const tenant = tenantIndex >= 0 ? process.argv[tenantIndex + 1] : null;
    const rows = await db`SELECT id, kind, original_payload, corrected_payload, note, created_at FROM ai_feedback_examples WHERE kind = ${kind} ${tenant ? db`AND tenant_id = ${tenant}` : db``} ORDER BY created_at`;
    const lines = rows.map((row) => JSON.stringify({ id: row.id, kind: row.kind, input: stripPersonalFields(row.original_payload), expected: stripPersonalFields(row.corrected_payload), note: row.note ?? null }));
    mkdirSync(path.join(__dirname, 'datasets'), { recursive: true });
    const out = path.join(__dirname, 'datasets', `feedback-${kind}.jsonl`);
    writeFileSync(out, lines.join('\n') + (lines.length ? '\n' : ''));
    console.log(`${lines.length} düzeltme örneği → ${path.relative(process.cwd(), out)}`);
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
