/**
 * Scoring for the assistant eval (commands and pasted quote requests), pure. A case passes when every
 * expected field matches; a value filled where the case expects none (a colour the message never
 * gave, a product line from a message without a measure) counts as made up. `ask: true` cases pass
 * only when the reader does not produce a complete command (it must ask back).
 */
export type AssistantCase = { id: string; task: 'command' | 'quote_request'; input: string; expected: Record<string, any> };
export type AssistantScore = { id: string; task: AssistantCase['task']; pass: boolean; fabricated: number; wrong: string[]; latencyMs: number; error?: string };

const norm = (v: unknown) => (typeof v === 'string' ? v.toLocaleLowerCase('tr-TR').trim() : v);
const same = (a: unknown, b: unknown) => norm(a) === norm(b) || (a == null && b == null);

export function scoreCommand(c: AssistantCase, actual: { command: Record<string, any>; missing: string[] }, latencyMs = 0): AssistantScore {
  const wrong: string[] = [];
  let fabricated = 0;
  if (c.expected.ask) {
    const complete = actual.command.intent !== 'unknown' && actual.missing.length === 0;
    if (complete) { wrong.push('sormadı'); fabricated++; }
  } else {
    for (const [k, v] of Object.entries(c.expected)) {
      if (!same(actual.command[k], v)) { wrong.push(`${k}: ${JSON.stringify(actual.command[k] ?? null)} ≠ ${JSON.stringify(v)}`); if (v === null && actual.command[k] != null) fabricated++; }
    }
  }
  return { id: c.id, task: c.task, pass: wrong.length === 0, fabricated, wrong, latencyMs };
}

type Line = { family: unknown; widthMm: unknown; projectionMm: unknown; color: unknown; quantity: unknown };
export function scoreQuoteRequest(c: AssistantCase, actual: { customer: string | null; lines: Line[] }, latencyMs = 0): AssistantScore {
  const wrong: string[] = [];
  let fabricated = 0;
  const exp = c.expected as { customer?: string; lines: Line[] };
  if (exp.customer !== undefined && !same(actual.customer, exp.customer)) wrong.push(`customer: ${JSON.stringify(actual.customer)} ≠ ${JSON.stringify(exp.customer)}`);
  if (actual.lines.length !== exp.lines.length) {
    wrong.push(`satır: ${actual.lines.length} ≠ ${exp.lines.length}`);
    if (actual.lines.length > exp.lines.length) fabricated += actual.lines.length - exp.lines.length;
  }
  exp.lines.forEach((e, i) => {
    const a = actual.lines[i];
    if (!a) return;
    for (const k of Object.keys(e) as Array<keyof Line>) {
      if (!same(a[k], e[k])) { wrong.push(`${i + 1}.${k}: ${JSON.stringify(a[k] ?? null)} ≠ ${JSON.stringify(e[k])}`); if (e[k] === null && a[k] != null) fabricated++; }
    }
  });
  return { id: c.id, task: c.task, pass: wrong.length === 0, fabricated, wrong, latencyMs };
}

export function summarizeAssistant(provider: string, scores: AssistantScore[]) {
  const by = (t: AssistantCase['task']) => scores.filter((s) => s.task === t);
  const rate = (xs: AssistantScore[]) => (xs.length ? `${xs.filter((s) => s.pass).length}/${xs.length}` : '—');
  const ran = scores.filter((s) => !s.error);
  return {
    provider, commands: rate(by('command')), quoteRequests: rate(by('quote_request')), total: rate(scores),
    fabricated: scores.reduce((n, s) => n + s.fabricated, 0), errors: scores.length - ran.length,
    medianMs: ran.length ? [...ran.map((s) => s.latencyMs)].sort((a, b) => a - b)[Math.floor(ran.length / 2)] : null,
  };
}
