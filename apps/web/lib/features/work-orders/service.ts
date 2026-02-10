import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import {
  canTransitionWorkOrderStatus,
  isWorkOrderTerminalStatus,
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_STATUSES,
  WorkOrderPriority,
  WorkOrderStatus,
} from './status';
import { WorkOrderActor, WorkOrderApiError } from './security';

const WorkOrderStatusSchema = z.enum(WORK_ORDER_STATUSES);
const WorkOrderPrioritySchema = z.enum(WORK_ORDER_PRIORITIES);

const ChecklistInputSchema = z.object({
  title: z.string().trim().min(1).max(240),
  required: z.boolean().optional(),
});

export const CreateWorkOrderInputSchema = z.object({
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().max(5000).optional(),
  category: z.string().trim().min(1).max(120).default('general'),
  priority: WorkOrderPrioritySchema.default('medium'),
  dueAt: z.string().datetime().optional(),
  location: z.string().trim().max(180).optional(),
  assetTag: z.string().trim().max(120).optional(),
  estimatedMinutes: z.number().int().positive().max(24 * 60 * 30).optional(),
  assignedToUserId: z.string().uuid().optional(),
  checklist: z.array(ChecklistInputSchema).max(100).default([]),
});

export const UpdateWorkOrderInputSchema = z
  .object({
    title: z.string().trim().min(3).max(240).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    category: z.string().trim().min(1).max(120).optional(),
    priority: WorkOrderPrioritySchema.optional(),
    status: WorkOrderStatusSchema.optional(),
    dueAt: z.string().datetime().nullable().optional(),
    location: z.string().trim().max(180).nullable().optional(),
    assetTag: z.string().trim().max(120).nullable().optional(),
    estimatedMinutes: z.number().int().positive().max(24 * 60 * 30).nullable().optional(),
    actualMinutes: z.number().int().min(0).max(24 * 60 * 90).nullable().optional(),
    assignedToUserId: z.string().uuid().nullable().optional(),
    appendChecklistItems: z.array(ChecklistInputSchema).max(100).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'No changes supplied',
  });

export const ListWorkOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: WorkOrderStatusSchema.optional(),
  priority: WorkOrderPrioritySchema.optional(),
  assignedToUserId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  includeClosed: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

export const WorkOrderCommentInputSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const ToggleChecklistInputSchema = z.object({
  completed: z.boolean(),
});

type WorkOrderRow = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  category: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  location: string | null;
  asset_tag: string | null;
  due_at: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  source: string;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  assignee_name?: string | null;
  creator_name?: string | null;
  checklist_total?: number;
  checklist_completed?: number;
  comment_total?: number;
};

type ChecklistItemRow = {
  id: string;
  work_order_id: string;
  title: string;
  required: boolean;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  completed_by_name?: string | null;
};

type WorkOrderCommentRow = {
  id: string;
  work_order_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
};

export type WorkOrder = ReturnType<typeof mapWorkOrderRow>;
export type WorkOrderChecklistItem = ReturnType<typeof mapChecklistItemRow>;
export type WorkOrderComment = ReturnType<typeof mapWorkOrderCommentRow>;

function mapWorkOrderRow(row: WorkOrderRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    priority: row.priority,
    location: row.location,
    assetTag: row.asset_tag,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    estimatedMinutes: row.estimated_minutes,
    actualMinutes: row.actual_minutes,
    source: row.source,
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    assigneeName: row.assignee_name || null,
    creatorName: row.creator_name || null,
    checklistTotal: Number(row.checklist_total || 0),
    checklistCompleted: Number(row.checklist_completed || 0),
    commentTotal: Number(row.comment_total || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChecklistItemRow(row: ChecklistItemRow) {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    title: row.title,
    required: row.required,
    completed: row.completed,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    completedByName: row.completed_by_name || null,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorkOrderCommentRow(row: WorkOrderCommentRow) {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    body: row.body,
    createdBy: row.created_by,
    authorName: row.author_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function nullableTrimmed(value?: string | null): string | null {
  if (value === undefined) return null;
  const trimmed = value?.trim() || '';
  return trimmed ? trimmed : null;
}

async function ensureTenantMember(tx: any, tenantId: string, userId: string): Promise<void> {
  const result = await tx`
    SELECT id
    FROM tenant_members
    WHERE tenant_id = ${tenantId}
      AND user_id = ${userId}
    LIMIT 1
  `;
  const rows = result as Array<{ id: string }>;
  if (rows.length === 0) {
    throw new WorkOrderApiError('Atanacak kullanıcı tenant üyesi değil', 400);
  }
}

async function insertWorkOrderEvent(
  tx: any,
  params: {
    tenantId: string;
    workOrderId: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdBy: string;
  }
) {
  await tx`
    INSERT INTO work_order_events (tenant_id, work_order_id, event_type, payload, created_by, created_at)
    VALUES (
      ${params.tenantId},
      ${params.workOrderId},
      ${params.eventType},
      ${params.payload},
      ${params.createdBy},
      NOW()
    )
  `;
}

async function loadWorkOrderForUpdate(tx: any, tenantId: string, workOrderId: string) {
  const result = await tx`
    SELECT *
    FROM work_orders
    WHERE id = ${workOrderId}
      AND tenant_id = ${tenantId}
    LIMIT 1
    FOR UPDATE
  `;
  const rows = result as WorkOrderRow[];
  const workOrder = rows[0];
  if (!workOrder) {
    throw new WorkOrderApiError('İş emri bulunamadı', 404);
  }
  return workOrder;
}

async function loadWorkOrderById(tenantId: string, workOrderId: string) {
  const result = await sql`
    SELECT
      w.*,
      assignee.name as assignee_name,
      creator.name as creator_name,
      COALESCE(ci.total_count, 0)::int as checklist_total,
      COALESCE(ci.completed_count, 0)::int as checklist_completed,
      COALESCE(cc.total_count, 0)::int as comment_total
    FROM work_orders w
    LEFT JOIN users assignee ON assignee.id = w.assigned_to
    LEFT JOIN users creator ON creator.id = w.created_by
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE completed = true) as completed_count
      FROM work_order_checklist_items
      WHERE work_order_id = w.id
    ) ci ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) as total_count
      FROM work_order_comments
      WHERE work_order_id = w.id
    ) cc ON true
    WHERE w.tenant_id = ${tenantId}
      AND w.id = ${workOrderId}
    LIMIT 1
  `;
  const rows = result as WorkOrderRow[];
  const row = rows[0];
  return row ? mapWorkOrderRow(row) : null;
}

export async function listWorkOrders(
  tenantId: string,
  query: z.infer<typeof ListWorkOrdersQuerySchema>
) {
  const whereClauses: string[] = ['w.tenant_id = $1'];
  const params: unknown[] = [tenantId];

  if (query.status) {
    params.push(query.status);
    whereClauses.push(`w.status = $${params.length}`);
  }

  if (query.priority) {
    params.push(query.priority);
    whereClauses.push(`w.priority = $${params.length}`);
  }

  if (query.assignedToUserId) {
    params.push(query.assignedToUserId);
    whereClauses.push(`w.assigned_to = $${params.length}`);
  }

  if (!query.includeClosed) {
    whereClauses.push(`w.status NOT IN ('done', 'cancelled')`);
  }

  if (query.search) {
    params.push(`%${query.search}%`);
    const searchParamIndex = params.length;
    whereClauses.push(
      `(w.title ILIKE $${searchParamIndex} OR COALESCE(w.description, '') ILIKE $${searchParamIndex} OR COALESCE(w.asset_tag, '') ILIKE $${searchParamIndex})`
    );
  }

  const whereSql = whereClauses.join(' AND ');
  const offset = (query.page - 1) * query.pageSize;

  const countRows = await sql.unsafe(
    `SELECT COUNT(*)::int AS total FROM work_orders w WHERE ${whereSql}`,
    params
  );
  const total = Number((countRows as Array<{ total: number }>)[0]?.total || 0);

  const listParams = [...params, query.pageSize, offset];
  const listRows = await sql.unsafe(
    `
      SELECT
        w.*,
        assignee.name as assignee_name,
        creator.name as creator_name,
        COALESCE(ci.total_count, 0)::int as checklist_total,
        COALESCE(ci.completed_count, 0)::int as checklist_completed,
        COALESCE(cc.total_count, 0)::int as comment_total
      FROM work_orders w
      LEFT JOIN users assignee ON assignee.id = w.assigned_to
      LEFT JOIN users creator ON creator.id = w.created_by
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) as total_count,
          COUNT(*) FILTER (WHERE completed = true) as completed_count
        FROM work_order_checklist_items
        WHERE work_order_id = w.id
      ) ci ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as total_count
        FROM work_order_comments
        WHERE work_order_id = w.id
      ) cc ON true
      WHERE ${whereSql}
      ORDER BY
        CASE w.priority
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        COALESCE(w.due_at, w.created_at) ASC,
        w.created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    listParams
  );

  return {
    data: (listRows as WorkOrderRow[]).map(mapWorkOrderRow),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getWorkOrderSummary(tenantId: string) {
  const rows = await sql`
    SELECT
      COUNT(*)::int as total_count,
      COUNT(*) FILTER (WHERE status = 'open')::int as open_count,
      COUNT(*) FILTER (WHERE status = 'in_progress')::int as in_progress_count,
      COUNT(*) FILTER (WHERE status = 'blocked')::int as blocked_count,
      COUNT(*) FILTER (WHERE status = 'done')::int as done_count,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int as cancelled_count,
      COUNT(*) FILTER (WHERE due_at IS NOT NULL AND due_at < NOW() AND status NOT IN ('done', 'cancelled'))::int as overdue_count,
      COUNT(*) FILTER (WHERE due_at IS NOT NULL AND due_at::date = NOW()::date AND status NOT IN ('done', 'cancelled'))::int as due_today_count,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int as created_last_7d,
      COUNT(*) FILTER (WHERE completed_at IS NOT NULL AND completed_at >= NOW() - INTERVAL '7 days')::int as completed_last_7d,
      COALESCE(
        AVG(
          EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600
        ) FILTER (WHERE completed_at IS NOT NULL AND completed_at >= NOW() - INTERVAL '30 days'),
        0
      )::numeric(12,2) as avg_resolution_hours
    FROM work_orders
    WHERE tenant_id = ${tenantId}
  `;

  const summary = (rows as Array<Record<string, unknown>>)[0] || {};
  const createdLast7d = Number(summary.created_last_7d || 0);
  const completedLast7d = Number(summary.completed_last_7d || 0);
  const completionRate7d =
    createdLast7d === 0 ? 0 : Number(((completedLast7d / createdLast7d) * 100).toFixed(2));

  return {
    total: Number(summary.total_count || 0),
    byStatus: {
      open: Number(summary.open_count || 0),
      inProgress: Number(summary.in_progress_count || 0),
      blocked: Number(summary.blocked_count || 0),
      done: Number(summary.done_count || 0),
      cancelled: Number(summary.cancelled_count || 0),
    },
    overdue: Number(summary.overdue_count || 0),
    dueToday: Number(summary.due_today_count || 0),
    throughput: {
      createdLast7d,
      completedLast7d,
      completionRate7d,
    },
    avgResolutionHours30d: Number(summary.avg_resolution_hours || 0),
  };
}

export async function createWorkOrder(
  actor: WorkOrderActor,
  input: z.infer<typeof CreateWorkOrderInputSchema>
) {
  return withTransaction(async (tx) => {
    if (input.assignedToUserId) {
      await ensureTenantMember(tx, actor.tenantId, input.assignedToUserId);
    }

    const created = await tx`
      INSERT INTO work_orders (
        tenant_id,
        title,
        description,
        category,
        status,
        priority,
        location,
        asset_tag,
        due_at,
        estimated_minutes,
        source,
        created_by,
        assigned_to,
        created_at,
        updated_at
      )
      VALUES (
        ${actor.tenantId},
        ${input.title},
        ${nullableTrimmed(input.description) || null},
        ${input.category},
        'open',
        ${input.priority},
        ${nullableTrimmed(input.location)},
        ${nullableTrimmed(input.assetTag)},
        ${input.dueAt || null},
        ${input.estimatedMinutes || null},
        'manual',
        ${actor.userId},
        ${input.assignedToUserId || null},
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    const createdRows = created as Array<{ id: string }>;
    const workOrderId = createdRows[0]?.id;
    if (!workOrderId) {
      throw new Error('İş emri oluşturulamadı');
    }

    if (input.checklist.length > 0) {
      let position = 0;
      for (const item of input.checklist) {
        await tx`
          INSERT INTO work_order_checklist_items (
            tenant_id,
            work_order_id,
            title,
            required,
            completed,
            position,
            created_at,
            updated_at
          )
          VALUES (
            ${actor.tenantId},
            ${workOrderId},
            ${item.title},
            ${item.required ?? true},
            false,
            ${position},
            NOW(),
            NOW()
          )
        `;
        position += 1;
      }
    }

    await insertWorkOrderEvent(tx, {
      tenantId: actor.tenantId,
      workOrderId,
      eventType: 'work_order.created',
      payload: {
        title: input.title,
        priority: input.priority,
        dueAt: input.dueAt || null,
        checklistItems: input.checklist.length,
      },
      createdBy: actor.userId,
    });

    const createdWorkOrder = await loadWorkOrderById(actor.tenantId, workOrderId);
    if (!createdWorkOrder) {
      throw new Error('Oluşturulan iş emri yüklenemedi');
    }
    return createdWorkOrder;
  });
}

export async function getWorkOrderDetails(tenantId: string, workOrderId: string) {
  const workOrder = await loadWorkOrderById(tenantId, workOrderId);
  if (!workOrder) {
    throw new WorkOrderApiError('İş emri bulunamadı', 404);
  }

  const checklistResult = await sql`
    SELECT
      c.*,
      u.name as completed_by_name
    FROM work_order_checklist_items c
    LEFT JOIN users u ON u.id = c.completed_by
    WHERE c.tenant_id = ${tenantId}
      AND c.work_order_id = ${workOrderId}
    ORDER BY c.position ASC, c.created_at ASC
  `;

  const commentsResult = await sql`
    SELECT
      c.*,
      u.name as author_name
    FROM work_order_comments c
    LEFT JOIN users u ON u.id = c.created_by
    WHERE c.tenant_id = ${tenantId}
      AND c.work_order_id = ${workOrderId}
    ORDER BY c.created_at ASC
  `;

  return {
    ...workOrder,
    checklist: (checklistResult as ChecklistItemRow[]).map(mapChecklistItemRow),
    comments: (commentsResult as WorkOrderCommentRow[]).map(mapWorkOrderCommentRow),
  };
}

export async function updateWorkOrder(
  actor: WorkOrderActor,
  workOrderId: string,
  input: z.infer<typeof UpdateWorkOrderInputSchema>
) {
  return withTransaction(async (tx) => {
    const existing = await loadWorkOrderForUpdate(tx, actor.tenantId, workOrderId);

    if (input.assignedToUserId) {
      await ensureTenantMember(tx, actor.tenantId, input.assignedToUserId);
    }

    const targetStatus = input.status || existing.status;
    if (input.status && !canTransitionWorkOrderStatus(existing.status, input.status)) {
      throw new WorkOrderApiError(
        `Durum geçişi izinli değil: ${existing.status} -> ${input.status}`,
        400
      );
    }

    let completedAt = existing.completed_at;
    if (input.status && input.status !== existing.status) {
      if (input.status === 'done') {
        completedAt = new Date().toISOString();
      } else if (!isWorkOrderTerminalStatus(input.status)) {
        completedAt = null;
      }
    }

    const nextPayload = {
      title: input.title ?? existing.title,
      description: input.description === undefined ? existing.description : nullableTrimmed(input.description),
      category: input.category ?? existing.category,
      priority: input.priority ?? existing.priority,
      status: targetStatus,
      dueAt: input.dueAt === undefined ? existing.due_at : input.dueAt,
      location: input.location === undefined ? existing.location : nullableTrimmed(input.location),
      assetTag: input.assetTag === undefined ? existing.asset_tag : nullableTrimmed(input.assetTag),
      estimatedMinutes:
        input.estimatedMinutes === undefined ? existing.estimated_minutes : input.estimatedMinutes,
      actualMinutes: input.actualMinutes === undefined ? existing.actual_minutes : input.actualMinutes,
      assignedTo:
        input.assignedToUserId === undefined ? existing.assigned_to : input.assignedToUserId,
      completedAt,
    };

    await tx`
      UPDATE work_orders
      SET
        title = ${nextPayload.title},
        description = ${nextPayload.description},
        category = ${nextPayload.category},
        priority = ${nextPayload.priority},
        status = ${nextPayload.status},
        due_at = ${nextPayload.dueAt},
        location = ${nextPayload.location},
        asset_tag = ${nextPayload.assetTag},
        estimated_minutes = ${nextPayload.estimatedMinutes},
        actual_minutes = ${nextPayload.actualMinutes},
        assigned_to = ${nextPayload.assignedTo},
        completed_at = ${nextPayload.completedAt},
        updated_at = NOW()
      WHERE id = ${workOrderId}
        AND tenant_id = ${actor.tenantId}
    `;

    if (input.appendChecklistItems && input.appendChecklistItems.length > 0) {
      const lastPositionResult = await tx`
        SELECT COALESCE(MAX(position), -1)::int as max_position
        FROM work_order_checklist_items
        WHERE tenant_id = ${actor.tenantId}
          AND work_order_id = ${workOrderId}
      `;
      const lastPositionRows = lastPositionResult as Array<{ max_position: number }>;
      let position = (lastPositionRows[0]?.max_position || -1) + 1;
      for (const item of input.appendChecklistItems) {
        await tx`
          INSERT INTO work_order_checklist_items (
            tenant_id,
            work_order_id,
            title,
            required,
            completed,
            position,
            created_at,
            updated_at
          )
          VALUES (
            ${actor.tenantId},
            ${workOrderId},
            ${item.title},
            ${item.required ?? true},
            false,
            ${position},
            NOW(),
            NOW()
          )
        `;
        position += 1;
      }
    }

    await insertWorkOrderEvent(tx, {
      tenantId: actor.tenantId,
      workOrderId,
      eventType: 'work_order.updated',
      payload: {
        changedStatus: input.status ? { from: existing.status, to: input.status } : null,
        assignedTo: input.assignedToUserId === undefined ? null : input.assignedToUserId,
        appendedChecklistItems: input.appendChecklistItems?.length || 0,
      },
      createdBy: actor.userId,
    });

    const updated = await loadWorkOrderById(actor.tenantId, workOrderId);
    if (!updated) {
      throw new Error('Güncellenen iş emri yüklenemedi');
    }
    return updated;
  });
}

export async function listWorkOrderComments(tenantId: string, workOrderId: string) {
  const rows = await sql`
    SELECT
      c.*,
      u.name as author_name
    FROM work_order_comments c
    LEFT JOIN users u ON u.id = c.created_by
    WHERE c.tenant_id = ${tenantId}
      AND c.work_order_id = ${workOrderId}
    ORDER BY c.created_at ASC
  `;
  return (rows as WorkOrderCommentRow[]).map(mapWorkOrderCommentRow);
}

export async function addWorkOrderComment(
  actor: WorkOrderActor,
  workOrderId: string,
  body: string
) {
  return withTransaction(async (tx) => {
    await loadWorkOrderForUpdate(tx, actor.tenantId, workOrderId);

    const insertResult = await tx`
      INSERT INTO work_order_comments (
        tenant_id,
        work_order_id,
        body,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        ${actor.tenantId},
        ${workOrderId},
        ${body},
        ${actor.userId},
        NOW(),
        NOW()
      )
      RETURNING *
    `;
    const insertedRows = insertResult as WorkOrderCommentRow[];
    const inserted = insertedRows[0];
    if (!inserted) {
      throw new Error('Yorum eklenemedi');
    }

    await insertWorkOrderEvent(tx, {
      tenantId: actor.tenantId,
      workOrderId,
      eventType: 'work_order.comment_added',
      payload: {
        commentId: inserted.id,
        bodyPreview: body.slice(0, 120),
      },
      createdBy: actor.userId,
    });

    const commentRows = await tx`
      SELECT
        c.*,
        u.name as author_name
      FROM work_order_comments c
      LEFT JOIN users u ON u.id = c.created_by
      WHERE c.id = ${inserted.id}
      LIMIT 1
    `;
    const commentRow = (commentRows as WorkOrderCommentRow[])[0];
    return commentRow ? mapWorkOrderCommentRow(commentRow) : mapWorkOrderCommentRow(inserted);
  });
}

export async function toggleWorkOrderChecklistItem(
  actor: WorkOrderActor,
  workOrderId: string,
  itemId: string,
  completed: boolean
) {
  return withTransaction(async (tx) => {
    await loadWorkOrderForUpdate(tx, actor.tenantId, workOrderId);

    const itemRows = await tx`
      SELECT *
      FROM work_order_checklist_items
      WHERE tenant_id = ${actor.tenantId}
        AND work_order_id = ${workOrderId}
        AND id = ${itemId}
      LIMIT 1
      FOR UPDATE
    `;
    const item = (itemRows as ChecklistItemRow[])[0];
    if (!item) {
      throw new WorkOrderApiError('Checklist öğesi bulunamadı', 404);
    }

    const completedAt = completed ? new Date().toISOString() : null;
    const completedBy = completed ? actor.userId : null;

    const updatedRows = await tx`
      UPDATE work_order_checklist_items
      SET
        completed = ${completed},
        completed_at = ${completedAt},
        completed_by = ${completedBy},
        updated_at = NOW()
      WHERE tenant_id = ${actor.tenantId}
        AND work_order_id = ${workOrderId}
        AND id = ${itemId}
      RETURNING *
    `;
    const updated = (updatedRows as ChecklistItemRow[])[0];
    if (!updated) {
      throw new Error('Checklist öğesi güncellenemedi');
    }

    await insertWorkOrderEvent(tx, {
      tenantId: actor.tenantId,
      workOrderId,
      eventType: 'work_order.checklist_toggled',
      payload: {
        itemId: updated.id,
        completed,
        title: updated.title,
      },
      createdBy: actor.userId,
    });

    const summaryRows = await tx`
      SELECT
        COUNT(*)::int as total_count,
        COUNT(*) FILTER (WHERE completed = true)::int as completed_count
      FROM work_order_checklist_items
      WHERE tenant_id = ${actor.tenantId}
        AND work_order_id = ${workOrderId}
    `;
    const summary = (summaryRows as Array<{ total_count: number; completed_count: number }>)[0];

    return {
      item: mapChecklistItemRow(updated),
      summary: {
        total: Number(summary?.total_count || 0),
        completed: Number(summary?.completed_count || 0),
      },
    };
  });
}
