import 'client-only';

import { z } from 'zod';

export const WORK_ORDER_STATUSES = [
  'open',
  'in_progress',
  'blocked',
  'done',
  'cancelled',
] as const;

export const WORK_ORDER_PRIORITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export const WORK_ORDER_BLOCK_REASON_CATEGORIES = [
  'material',
  'machine',
  'planning',
  'manpower',
  'quality',
  'other',
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];
export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];
export type WorkOrderBlockReasonCategory =
  (typeof WORK_ORDER_BLOCK_REASON_CATEGORIES)[number];

const WorkOrderStatusSchema = z.enum(WORK_ORDER_STATUSES);
const WorkOrderPrioritySchema = z.enum(WORK_ORDER_PRIORITIES);
const WorkOrderBlockReasonCategorySchema = z.enum(WORK_ORDER_BLOCK_REASON_CATEGORIES);

const WorkOrderSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  status: WorkOrderStatusSchema,
  priority: WorkOrderPrioritySchema,
  location: z.string().nullable(),
  assetTag: z.string().nullable(),
  dueAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  estimatedMinutes: z.number().int().nullable(),
  actualMinutes: z.number().int().nullable(),
  blockedReasonCategory: WorkOrderBlockReasonCategorySchema.nullable().optional(),
  blockedReasonDetail: z.string().nullable().optional(),
  blockedAt: z.string().nullable().optional(),
  source: z.string(),
  createdBy: z.string().uuid().nullable(),
  assignedTo: z.string().uuid().nullable(),
  assigneeName: z.string().nullable(),
  creatorName: z.string().nullable(),
  checklistTotal: z.number().int(),
  checklistCompleted: z.number().int(),
  commentTotal: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const WorkOrderChecklistItemSchema = z.object({
  id: z.string().uuid(),
  workOrderId: z.string().uuid(),
  title: z.string(),
  required: z.boolean(),
  completed: z.boolean(),
  completedAt: z.string().nullable(),
  completedBy: z.string().uuid().nullable(),
  completedByName: z.string().nullable(),
  position: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const WorkOrderCommentSchema = z.object({
  id: z.string().uuid(),
  workOrderId: z.string().uuid(),
  body: z.string(),
  createdBy: z.string().uuid().nullable(),
  authorName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const PaginationSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

const WorkOrderListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(WorkOrderSchema),
  pagination: PaginationSchema,
});

const WorkOrderSummaryResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    total: z.number().int().min(0),
    byStatus: z.object({
      open: z.number().int().min(0),
      inProgress: z.number().int().min(0),
      blocked: z.number().int().min(0),
      done: z.number().int().min(0),
      cancelled: z.number().int().min(0),
    }),
    overdue: z.number().int().min(0),
    dueToday: z.number().int().min(0),
    throughput: z.object({
      createdLast7d: z.number().int().min(0),
      completedLast7d: z.number().int().min(0),
      completionRate7d: z.number().min(0),
    }),
    avgResolutionHours30d: z.number().min(0),
  }),
});

const WorkOrderDetailResponseSchema = z.object({
  success: z.literal(true),
  data: WorkOrderSchema.extend({
    checklist: z.array(WorkOrderChecklistItemSchema),
    comments: z.array(WorkOrderCommentSchema),
  }),
});

const WorkOrderSingleResponseSchema = z.object({
  success: z.literal(true),
  data: WorkOrderSchema,
});

const WorkOrderCommentResponseSchema = z.object({
  success: z.literal(true),
  data: WorkOrderCommentSchema,
});

const WorkOrderChecklistToggleResponseSchema = z.object({
  success: z.literal(true),
  data: WorkOrderChecklistItemSchema,
});

const TenantMembersResponseSchema = z.object({
  success: z.literal(true),
  members: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email(),
      role: z.string(),
      avatar: z.string().nullable().optional(),
      joinedAt: z.string().optional(),
    })
  ),
});

const ErrorPayloadSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  details: z.unknown().optional(),
});

export type WorkOrder = z.infer<typeof WorkOrderSchema>;
export type WorkOrderChecklistItem = z.infer<typeof WorkOrderChecklistItemSchema>;
export type WorkOrderComment = z.infer<typeof WorkOrderCommentSchema>;
export type WorkOrderSummary = z.infer<typeof WorkOrderSummaryResponseSchema>['data'];
export type WorkOrderDetails = z.infer<typeof WorkOrderDetailResponseSchema>['data'];
export type TenantMember = z.infer<typeof TenantMembersResponseSchema>['members'][number];

export type ListWorkOrdersQuery = {
  page?: number;
  pageSize?: number;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  assignedToUserId?: string;
  search?: string;
  includeClosed?: boolean;
};

export type CreateWorkOrderInput = {
  title: string;
  description?: string;
  category?: string;
  priority?: WorkOrderPriority;
  dueAt?: string;
  location?: string;
  assetTag?: string;
  estimatedMinutes?: number;
  assignedToUserId?: string;
  checklist?: Array<{ title: string; required?: boolean }>;
};

export type UpdateWorkOrderInput = {
  title?: string;
  description?: string | null;
  category?: string;
  priority?: WorkOrderPriority;
  status?: WorkOrderStatus;
  dueAt?: string | null;
  location?: string | null;
  assetTag?: string | null;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  blockedReasonCategory?: WorkOrderBlockReasonCategory | null;
  blockedReasonDetail?: string | null;
  assignedToUserId?: string | null;
  appendChecklistItems?: Array<{ title: string; required?: boolean }>;
};

export class WorkOrderClientError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'WorkOrderClientError';
    this.status = status;
    this.details = details;
  }
}

function normalizeErrorPayload(payload: unknown): { message: string; details?: unknown } {
  const parsed = ErrorPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { message: 'Bilinmeyen API hatası' };
  }
  return {
    message: parsed.data.error || parsed.data.message || 'Bilinmeyen API hatası',
    details: parsed.data.details,
  };
}

async function parseErrorResponse(response: Response): Promise<never> {
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new WorkOrderClientError(`HTTP ${response.status}`, response.status);
  }

  const payload = await response.json();
  const normalized = normalizeErrorPayload(payload);
  throw new WorkOrderClientError(normalized.message, response.status, normalized.details);
}

function buildQueryString(query: ListWorkOrdersQuery): string {
  const params = new URLSearchParams();

  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.status) params.set('status', query.status);
  if (query.priority) params.set('priority', query.priority);
  if (query.assignedToUserId) params.set('assignedToUserId', query.assignedToUserId);
  if (query.search) params.set('search', query.search);
  if (query.includeClosed !== undefined) {
    params.set('includeClosed', query.includeClosed ? 'true' : 'false');
  }

  return params.toString();
}

async function requestJson<T>(
  input: string,
  schema: z.ZodSchema<T>,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    await parseErrorResponse(response);
  }

  const payload = await response.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new WorkOrderClientError('API yanıt formatı geçersiz', 500, z.flattenError(parsed.error));
  }

  return parsed.data;
}

export async function listWorkOrders(query: ListWorkOrdersQuery = {}) {
  const queryString = buildQueryString(query);
  const endpoint = queryString ? `/api/work-orders?${queryString}` : '/api/work-orders';
  const response = await requestJson(endpoint, WorkOrderListResponseSchema);
  return {
    data: response.data,
    pagination: response.pagination,
  };
}

export async function getWorkOrderSummary(): Promise<WorkOrderSummary> {
  const response = await requestJson('/api/work-orders/summary', WorkOrderSummaryResponseSchema);
  return response.data;
}

export async function getWorkOrderDetails(workOrderId: string): Promise<WorkOrderDetails> {
  const response = await requestJson(
    `/api/work-orders/${workOrderId}`,
    WorkOrderDetailResponseSchema
  );
  return response.data;
}

export async function createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrder> {
  const response = await requestJson('/api/work-orders', WorkOrderSingleResponseSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function updateWorkOrder(
  workOrderId: string,
  input: UpdateWorkOrderInput
): Promise<WorkOrder> {
  const response = await requestJson(
    `/api/work-orders/${workOrderId}`,
    WorkOrderSingleResponseSchema,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    }
  );
  return response.data;
}

export async function addWorkOrderComment(
  workOrderId: string,
  body: string
): Promise<WorkOrderComment> {
  const response = await requestJson(
    `/api/work-orders/${workOrderId}/comments`,
    WorkOrderCommentResponseSchema,
    {
      method: 'POST',
      body: JSON.stringify({ body }),
    }
  );
  return response.data;
}

export async function toggleWorkOrderChecklistItem(
  workOrderId: string,
  itemId: string,
  completed: boolean
): Promise<WorkOrderChecklistItem> {
  const response = await requestJson(
    `/api/work-orders/${workOrderId}/checklist/${itemId}/toggle`,
    WorkOrderChecklistToggleResponseSchema,
    {
      method: 'POST',
      body: JSON.stringify({ completed }),
    }
  );
  return response.data;
}

export async function listTenantMembers(): Promise<TenantMember[]> {
  const response = await requestJson('/api/tenant/members', TenantMembersResponseSchema);
  return response.members;
}
