import 'server-only';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAPIUser, verifyAPIToken } from '@/lib/api/auth-helpers';
import { isPrivateAccessAllowed } from '@/lib/features/auth/private-access';
import { currentMobileAccess, type MobileAccess } from '@/lib/features/mobile/access';
import { colorInfo } from '@/lib/features/colors/color-spec';
import { sql } from '@/lib/db';
import { WorkOrderActor, WorkOrderApiError, hasWorkOrderPermission } from '@/lib/features/work-orders/security';
import { getWorkOrderDetails, listWorkOrders, ListWorkOrdersQuerySchema } from '@/lib/features/work-orders/service';
import { productionOverview } from '@/lib/features/manufacturing/platform.service';
import { QualityChecksSchema } from '@/lib/features/manufacturing/quality';

export type FieldActor = WorkOrderActor & { mobileAccess?: MobileAccess };

export async function fieldActor(request: NextRequest, required: 'production'|'installations'|'any'='production'): Promise<FieldActor> {
  // This surface deliberately requires a mobile bearer token, never ambient cookies.
  if (!request.headers.get('authorization')?.startsWith('Bearer '))
    throw new WorkOrderApiError('Oturum açmanız gerekiyor.', 401);
  if (!(await verifyAPIToken(request)))
    throw new WorkOrderApiError('Oturumunuz sona erdi. Yeniden giriş yapın.', 401);
  const user = await getAPIUser(request);
  if (!user || !isPrivateAccessAllowed(user.email))
    throw new WorkOrderApiError('Oturumunuz sona erdi. Yeniden giriş yapın.', 401);
  if (!['owner', 'admin', 'office', 'worker'].includes(user.role))
    throw new WorkOrderApiError('Bu hesap saha uygulamasına erişemiyor.', 403);
  const actor = { userId: user.id, tenantId: user.tenantId, role: user.role as WorkOrderActor['role'] };
  const access = await currentMobileAccess(actor, request.headers.get('authorization')!.slice(7));
  if (required==='any' ? !access.production.view && !access.inventory.view && !access.installations.view : !access[required].view) throw new WorkOrderApiError('Bu modülü görme yetkiniz yok.',403);
  return { ...actor, mobileAccess: access };
}

export async function assertFieldJob(actor: WorkOrderActor, id: string) {
  z.string().uuid().parse(id);
  const rows = await sql`
    SELECT id, recipe_id FROM work_orders
    WHERE tenant_id = ${actor.tenantId} AND id = ${id}
      AND (${actor.role !== 'worker'} OR assigned_to = ${actor.userId}
        OR EXISTS (SELECT 1 FROM production_operations p
          WHERE p.tenant_id = ${actor.tenantId} AND p.work_order_id = work_orders.id
            AND p.assigned_to = ${actor.userId}))
  `;
  if (!rows[0]) throw new WorkOrderApiError('İş emri bulunamadı veya size atanmamış.', 404);
  return rows[0] as { id: string; recipe_id: string | null };
}

export function fieldColor(job: Record<string, unknown>, snake = false) {
  const configuration = job.configuration as Record<string, unknown> | null;
  const color = snake ? colorInfo(typeof configuration?.bodyName === 'string' ? configuration.bodyName : null) : job.color as ReturnType<typeof colorInfo>;
  if (!color) return null;
  return { label: color.label, code: color.code, name: color.name, hex: color.hex, finish: color.finish, finishAssumed: color.finishAssumed, standIn: color.standIn, kind: color.kind };
}

// Explicit projections keep costs, recipe snapshots and customer information off devices.
export function fieldJob(job: Record<string, unknown>, snake = false) {
  const value = (camel: string, raw: string) => job[snake ? raw : camel];
  return {
    id: String(job.id), title: String(job.title),
    description: job.description == null ? null : String(job.description),
    status: String(job.status), priority: String(job.priority),
    category: String(job.category || 'general'), location: job.location == null ? null : String(job.location),
    dueAt: value('dueAt', 'due_at') || null,
    assigneeName: value('assigneeName', 'assignee_name') || null,
    checklistTotal: Number(value('checklistTotal', 'checklist_total') || 0),
    checklistCompleted: Number(value('checklistCompleted', 'checklist_completed') || 0),
    blockedReasonDetail: value('blockedReasonDetail', 'blocked_reason_detail') || null,
    color: fieldColor(job, snake),
    updatedAt: value('updatedAt','updated_at') instanceof Date ? (value('updatedAt','updated_at') as Date).toISOString() : value('updatedAt','updated_at'),
  };
}

export function fieldOperation(op: Record<string, unknown>) {
  return {
    id: String(op.id), workOrderId: String(op.work_order_id), name: String(op.name),
    position: Number(op.position), workCenterCode: String(op.work_center_code),
    status: String(op.status), version: Number(op.version),
    plannedQty: Number(op.planned_qty), completedQty: Number(op.completed_qty),
    activeSeconds: Number(op.active_seconds || 0), activeSince: op.active_since || null,
    assignedTo: op.assigned_to || null, operatorName: op.operator_name || null,
    reason: op.reason || null, qualityChecks: QualityChecksSchema.parse(op.quality_checks || []),
  };
}

export async function fieldSnapshot(actor: FieldActor) {
  const [list, production] = await Promise.all([
    listWorkOrders(actor.tenantId, ListWorkOrdersQuerySchema.parse({
      pageSize: 100, assignedToUserId: actor.role === 'worker' ? actor.userId : undefined,
      includeClosed: 'false',
    })),
    productionOverview(actor),
  ]);
  const jobs = new Map(list.data.map(job => [job.id, fieldJob(job)]));
  const productionJobs = production.jobs as Array<Record<string, unknown>>;
  for (const job of productionJobs) {
    if (!jobs.has(String(job.id)) && !['done', 'cancelled'].includes(String(job.status)))
      jobs.set(String(job.id), fieldJob(job, true));
  }
  const operations = (production.operations as Array<Record<string, unknown>>)
    .filter(op => jobs.has(String(op.work_order_id)))
    .filter(op => actor.role !== 'worker' || op.assigned_to === actor.userId)
    .map(fieldOperation);
  const jobIds=[...jobs.keys()];
  const [checks,notes]=await Promise.all([
    sql`SELECT id,work_order_id,title,required,completed FROM work_order_checklist_items WHERE tenant_id=${actor.tenantId} AND work_order_id=ANY(${jobIds}::uuid[]) ORDER BY position LIMIT 4000`,
    sql`SELECT c.id,c.work_order_id,c.body,c.created_at,u.name AS author_name FROM (SELECT *,row_number()OVER(PARTITION BY work_order_id ORDER BY created_at DESC) AS rn FROM work_order_comments WHERE tenant_id=${actor.tenantId} AND work_order_id=ANY(${jobIds}::uuid[])) c LEFT JOIN users u ON u.id=c.created_by WHERE c.rn<=20 ORDER BY c.created_at DESC LIMIT 500`,
  ]);
  const checklistByJob=new Map<string,Array<{id:string;title:string;required:boolean;completed:boolean}>>();
  const notesByJob=new Map<string,Array<{id:string;body:string;authorName:string|null;createdAt:string}>>();
  for(const item of checks) {
    const key=String(item.work_order_id),list=checklistByJob.get(key)||[];
    list.push({id:String(item.id),title:String(item.title),required:Boolean(item.required),completed:Boolean(item.completed)});checklistByJob.set(key,list);
  }
  for(const note of notes) {
    const key=String(note.work_order_id),list=notesByJob.get(key)||[];
    list.push({id:String(note.id),body:String(note.body),authorName:note.author_name?String(note.author_name):null,createdAt:note.created_at instanceof Date?note.created_at.toISOString():String(note.created_at)});notesByJob.set(key,list);
  }
  const managed=new Set(productionJobs.map(job=>String(job.id)));
  return {
    workOrders: [...jobs.values()].map(job=>({...job,productionManaged:managed.has(job.id),checklist:checklistByJob.get(job.id)||[],comments:notesByJob.get(job.id)||[]})), operations, cutPlans: production.cutPlans, generatedAt: new Date().toISOString(),
    truncated: list.pagination.total > 100 || productionJobs.length >= 300,
    permissions: {
      transition: hasWorkOrderPermission(actor.role, 'transition') && actor.mobileAccess?.production.edit !== false,
      close: hasWorkOrderPermission(actor.role, 'close') && actor.mobileAccess?.production.edit !== false,
      checklist: hasWorkOrderPermission(actor.role, 'checklist') && actor.mobileAccess?.production.edit !== false,
      comment: hasWorkOrderPermission(actor.role, 'comment') && actor.mobileAccess?.production.edit !== false,
    },
  };
}

export async function fieldDetails(actor: WorkOrderActor, id: string) {
  const record = await assertFieldJob(actor, id);
  const job = await getWorkOrderDetails(actor.tenantId, id);
  return {
    ...fieldJob(job), productionManaged: Boolean(record.recipe_id),
    checklist: job.checklist.map(item => ({ id: item.id, title: item.title, required: item.required, completed: item.completed })),
    comments: job.comments.map(comment => ({ id: comment.id, body: comment.body, authorName: comment.authorName, createdAt: comment.createdAt })),
  };
}

export async function readFieldJson(request: NextRequest, limit = 64_000): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new WorkOrderApiError('JSON isteği gerekli.', 415);
  if (Number(request.headers.get('content-length')) > limit)
    throw new WorkOrderApiError('İstek çok büyük.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new WorkOrderApiError('İstek gövdesi gerekli.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new WorkOrderApiError('İstek çok büyük.', 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new WorkOrderApiError('Geçersiz JSON.', 400); }
}
