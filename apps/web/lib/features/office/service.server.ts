import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';
import { readFile } from '@/lib/storage';
import { aiAvailable } from '@/lib/ai/service';
import { getAiSettings } from '@/lib/ai/gate.server';
import { modelConfigurationBlock, modelUnavailableMessage } from '@/lib/ai/policy';
import { ROUTE_ROLES } from '@/lib/features/auth/permissions';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { STAFF, TASK_CATEGORIES } from './catalog';
import { decide, type ManagerDecision } from './routing';
import { triage } from './triage.server';

/**
 * The AI office's tasks as the firm's records: who asked for what, the manager's call, the
 * question a member of staff raised, the delivery and its files. The work itself runs in
 * runner.server.ts after the request that queued it has answered.
 */

export type OfficeTaskStatus = 'queued' | 'working' | 'needs_input' | 'review' | 'approved' | 'failed';

export type OfficeFileView = { id: string; name: string; contentType: string; size: number; revision: number; url: string };
export type OfficeTaskView = {
  id: string; number: number; category: string; title: string; brief: string; status: OfficeTaskStatus;
  agentId: string; decision: ManagerDecision; question: string | null; revisions: number; notes: string[];
  summary: string | null; error: string | null; costUsd: number;
  createdAt: string; startedAt: string | null; deliveredAt: string | null; files: OfficeFileView[];
};

/** A task still "working" after this long lost its run (the function timed out or was stopped). */
const STALE_MINUTES = 6;

const fail = (message: string, status = 409): never => { throw new WorkOrderApiError(message, status); };

export function assertOfficeRole(actor: WorkOrderActor) {
  if (actor.station || !ROUTE_ROLES['/office'].includes(actor.role)) fail('AI ofise erişim yetkiniz yok.', 403);
}

/** The free OpenRouter models are offered only when their key is set on the server. */
const freeModelsConfigured = () => Boolean(process.env.OPENROUTER_API_KEY?.trim());

/** Can this firm's office do real work now? Without it the page runs as a simulation. */
export async function officeAvailability(tenantId: string) {
  if (!(await tableExists('office_tasks'))) return { live: false, reason: 'AI ofis için veritabanı güncellemesi bekleniyor; şimdilik simülasyon çalışıyor.', freeModels: false };
  const block = modelConfigurationBlock(await getAiSettings(tenantId), aiAvailable());
  return block ? { live: false, reason: `${modelUnavailableMessage(block)} Şimdilik simülasyon çalışıyor.`, freeModels: false } : { live: true, reason: null, freeModels: freeModelsConfigured() };
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

function view(row: Record<string, any>, files: OfficeFileView[]): OfficeTaskView {
  return {
    id: row.id, number: Number(row.number), category: row.category, title: row.title, brief: row.brief, status: row.status,
    agentId: row.agent_id, decision: row.decision, question: row.question, revisions: Number(row.revisions), notes: row.notes ?? [],
    summary: row.summary, error: row.error, costUsd: Number(row.cost_usd ?? 0),
    createdAt: iso(row.created_at)!, startedAt: iso(row.started_at), deliveredAt: iso(row.delivered_at), files,
  };
}

export async function listOfficeTasks(actor: WorkOrderActor) {
  assertOfficeRole(actor);
  const availability = await officeAvailability(actor.tenantId);
  if (!(await tableExists('office_tasks'))) return { ...availability, tasks: [] as OfficeTaskView[] };
  await sql`UPDATE office_tasks SET status='failed', error='İş zaman aşımına uğradı; yeniden deneyebilirsiniz.', updated_at=now()
    WHERE tenant_id=${actor.tenantId} AND status='working' AND started_at < now() - make_interval(mins => ${STALE_MINUTES})`;
  const rows = await sql`SELECT * FROM office_tasks WHERE tenant_id=${actor.tenantId} ORDER BY created_at DESC LIMIT 60`;
  const ids = rows.map((r: any) => r.id);
  const files = ids.length ? await sql`SELECT id, task_id, file_name, content_type, size_bytes, revision FROM office_files
    WHERE tenant_id=${actor.tenantId} AND task_id = ANY(${ids}::uuid[]) ORDER BY revision DESC, created_at` : [];
  const byTask = new Map<string, OfficeFileView[]>();
  for (const f of files as any[]) {
    const list = byTask.get(f.task_id) ?? [];
    list.push({ id: f.id, name: f.file_name, contentType: f.content_type, size: Number(f.size_bytes), revision: Number(f.revision), url: `/api/v1/office/files/${f.id}` });
    byTask.set(f.task_id, list);
  }
  return { ...availability, tasks: rows.reverse().map((r: any) => view(r, byTask.get(r.id) ?? [])) };
}

const CreateTask = z.object({
  text: z.string().trim().min(3, 'Ne yapılması gerektiğini yazın.').max(8000, 'Görev en fazla 8000 karakter olabilir.'),
  /** Only when the person picked the kind of work themselves; otherwise the manager decides. */
  category: z.enum(TASK_CATEGORIES, { message: 'Bilinmeyen görev türü.' }).optional(),
  /** Claude (the office default) or the free OpenRouter models, for trying the office out. */
  family: z.enum(['claude', 'free']).default('claude'),
});

/** Queues a task written in plain words; the manager reads it first. The caller starts the run once the response is on its way. */
export async function createOfficeTask(actor: WorkOrderActor, raw: unknown) {
  assertOfficeRole(actor);
  const availability = await officeAvailability(actor.tenantId);
  if (!availability.live) fail(availability.reason ?? 'AI ofis şu anda kullanılamıyor.');
  const input = CreateTask.parse(raw);
  if (input.family === 'free' && !freeModelsConfigured()) fail('Ücretsiz modeller için sunucuda OPENROUTER_API_KEY tanımlı değil.');
  const read = await triage(input.text, { tenantId: actor.tenantId, userId: actor.userId });
  const category = input.category ?? read.category;
  const title = read.title.slice(0, 200);
  const agent = STAFF.find(s => s.role === category)!;
  const decision: ManagerDecision = {
    ...decide({ category, title, brief: input.text, revisions: 0 }, input.family),
    triage: input.category ? { by: 'rules', reason: 'türü görevi veren seçti' } : { by: read.by, reason: read.reason },
  };
  return withTransaction(async (tx: any) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId + ':office_tasks'}, 0))`;
    const [{ n }] = await tx`SELECT coalesce(max(number), 0)::int + 1 AS n FROM office_tasks WHERE tenant_id=${actor.tenantId}`;
    const [row] = await tx`INSERT INTO office_tasks (tenant_id, number, category, title, brief, agent_id, decision, cost_usd, created_by)
      VALUES (${actor.tenantId}, ${n}, ${category}, ${title}, ${input.text}, ${agent.id}, ${tx.json(decision)}, ${read.costUsd}, ${actor.userId}) RETURNING *`;
    return view(row, []);
  });
}

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('revise'), note: z.string().trim().min(1, 'Ne değişmesi gerektiğini yazın.').max(2000) }),
  z.object({ action: z.literal('answer'), answer: z.string().trim().min(1, 'Bir cevap yazın.').max(2000) }),
  z.object({ action: z.literal('retry') }),
]);

/** Approve a delivery, send it back with a note, answer a raised hand or retry a failed run. Returns whether a run is due. */
export async function actOnOfficeTask(actor: WorkOrderActor, taskId: string, raw: unknown): Promise<{ run: boolean }> {
  assertOfficeRole(actor);
  const input = Action.parse(raw);
  const [task] = await sql`SELECT * FROM office_tasks WHERE tenant_id=${actor.tenantId} AND id=${taskId}`;
  if (!task) fail('Görev bulunamadı.', 404);
  if (input.action === 'approve') {
    const [row] = await sql`UPDATE office_tasks SET status='approved', decided_at=now(), updated_at=now()
      WHERE tenant_id=${actor.tenantId} AND id=${taskId} AND status='review' RETURNING id`;
    if (!row) fail('Bu görev onay beklemiyor.');
    return { run: false };
  }
  if (input.action === 'revise') {
    // A revision stays with the family the task was given to.
    const family = task.decision?.model?.family === 'free' ? 'free' : 'claude';
    const decision = { ...decide({ category: task.category, title: task.title, brief: task.brief, revisions: Number(task.revisions) + 1 }, family), triage: task.decision?.triage };
    const [row] = await sql`UPDATE office_tasks SET status='queued', revisions=revisions+1, notes=notes || ${sql.json([input.note])}::jsonb,
      decision=${sql.json(decision)}, summary=NULL, error=NULL, updated_at=now()
      WHERE tenant_id=${actor.tenantId} AND id=${taskId} AND status='review' RETURNING id`;
    if (!row) fail('Bu görev revizyona gönderilemez.');
    return { run: true };
  }
  if (input.action === 'answer') {
    const [row] = await sql`UPDATE office_tasks SET status='queued', answers=answers || ${sql.json([{ question: task.question, answer: input.answer }])}::jsonb,
      question=NULL, updated_at=now() WHERE tenant_id=${actor.tenantId} AND id=${taskId} AND status='needs_input' RETURNING id`;
    if (!row) fail('Bu görev bir cevap beklemiyor.');
    return { run: true };
  }
  const [row] = await sql`UPDATE office_tasks SET status='queued', error=NULL, updated_at=now()
    WHERE tenant_id=${actor.tenantId} AND id=${taskId} AND status='failed' RETURNING id`;
  if (!row) fail('Yalnızca başarısız bir görev yeniden denenebilir.');
  return { run: true };
}

/** One delivered file, read only by the firm that owns it. */
export async function readOfficeFile(actor: WorkOrderActor, fileId: string) {
  assertOfficeRole(actor);
  if (!z.string().uuid().safeParse(fileId).success) fail('Dosya bulunamadı.', 404);
  const [file] = await sql`SELECT file_name, content_type, storage_key FROM office_files WHERE tenant_id=${actor.tenantId} AND id=${fileId}`;
  if (!file) fail('Dosya bulunamadı.', 404);
  return { ...(await readFile(file.storage_key)), name: file.file_name as string, contentType: file.content_type as string };
}
