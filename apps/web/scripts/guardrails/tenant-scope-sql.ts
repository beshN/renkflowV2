/**
 * Statement-level firm isolation guard. Every tagged SQL template in app/ and lib/ that reads or
 * writes a table carrying tenant_id must say tenant_id, unless it is one of the statements reviewed
 * when this guard was introduced (tenant-scope-baseline.json: queue workers, signed-link lookups,
 * writes by an id loaded with its tenant just before) or it carries a reviewed marker:
 *   sql`/* tenant-checked: loaded with its tenant above *\/ UPDATE … WHERE id = ${id}`
 *
 *   npx tsx scripts/guardrails/tenant-scope-sql.ts            check (CI)
 *   npx tsx scripts/guardrails/tenant-scope-sql.ts --update   rewrite the baseline (after review)
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = path.join(__dirname, 'tenant-scope-baseline.json');
const SKIP_DIRS = new Set(['node_modules', '.next', '__tests__', 'scripts', 'evals', 'public']);

/** Tables that get a tenant_id column: the base schema, the migrations and the mobile migrations. */
function tenantTables(): Set<string> {
  const tables = new Set<string>();
  const sqlFiles = [path.join(ROOT, 'lib/db/schema.sql')];
  for (const dir of ['lib/db/migrations', 'lib/features/mobile/migrations']) {
    for (const f of readdirSync(path.join(ROOT, dir))) if (f.endsWith('.sql')) sqlFiles.push(path.join(ROOT, dir, f));
  }
  for (const file of sqlFiles) {
    const sqlText = readFileSync(file, 'utf8');
    for (const m of sqlText.matchAll(/create table\s+(?:if not exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\s*\);/gi)) {
      if (/\btenant_id\b/i.test(m[2])) tables.add(m[1].toLowerCase());
    }
    for (const m of sqlText.matchAll(/alter table\s+(?:if exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+add column\s+(?:if not exists\s+)?tenant_id\b/gi)) tables.add(m[1].toLowerCase());
  }
  return tables;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.|\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/** Text of each tagged template (interpolations replaced by $X), with its line. */
function templates(src: string): Array<{ line: number; text: string }> {
  const found: Array<{ line: number; text: string }> = [];
  const tag = /\b(sql|tx|db|t|trx|q|client|d|conn|c|s|sq|x)\s*`/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(src))) {
    let i = tag.lastIndex;
    let text = '';
    let depth = 0;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (depth === 0) {
        if (ch === '`') break;
        if (ch === '$' && src[i + 1] === '{') { depth = 1; i++; text += ' $X '; continue; }
        text += ch;
      } else if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '`') { let j = i + 1; while (j < src.length && src[j] !== '`') { if (src[j] === '\\') j++; j++; } i = j; }
    }
    tag.lastIndex = i + 1;
    found.push({ line: src.slice(0, m.index).split('\n').length, text: text.replace(/\s+/g, ' ').trim() });
  }
  return found;
}

function unscoped(tables: Set<string>) {
  const result: Array<{ key: string; where: string }> = [];
  for (const file of sourceFiles(path.join(ROOT, 'app')).concat(sourceFiles(path.join(ROOT, 'lib')))) {
    const rel = path.relative(ROOT, file);
    for (const { line, text } of templates(readFileSync(file, 'utf8'))) {
      if (!/\b(select|update|delete|insert)\b/i.test(text)) continue;
      if (/tenant_id|tenant-checked:/i.test(text)) continue;
      const touched = [...text.matchAll(/\b(?:from|join|update|into)\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)].map((t) => t[1].toLowerCase()).filter((t) => tables.has(t));
      if (!touched.length) continue;
      result.push({ key: `${rel} :: ${text}`, where: `${rel}:${line} [${[...new Set(touched)].join(',')}] ${text.slice(0, 140)}` });
    }
  }
  return result;
}

const tables = tenantTables();
const found = unscoped(tables);
if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, JSON.stringify(found.map((f) => f.key).sort(), null, 1) + '\n');
  console.log(`[tenant-scope-sql] baseline written: ${found.length} reviewed statements`);
  process.exit(0);
}
const baseline = new Set<string>(JSON.parse(readFileSync(BASELINE, 'utf8')));
const fresh = found.filter((f) => !baseline.has(f.key));
if (fresh.length) {
  console.error('[tenant-scope-sql] SQL on a firm table without tenant_id (add the tenant condition, or mark a reviewed exception with /* tenant-checked: why */):');
  for (const f of fresh) console.error('  ' + f.where);
  process.exit(1);
}
console.log(`[tenant-scope-sql] ${tables.size} firm tables; every statement is tenant-scoped or reviewed (${found.length} reviewed exceptions).`);
