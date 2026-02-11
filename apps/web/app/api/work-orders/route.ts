import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  CreateWorkOrderInputSchema,
  createWorkOrder,
  listWorkOrders,
  ListWorkOrdersQuerySchema,
} from '@/lib/features/work-orders/service';
import {
  requireWorkOrderActor,
  requireWorkOrderPermission,
  WorkOrderApiError,
} from '@/lib/features/work-orders/security';

function parseListQuery(request: NextRequest) {
  return ListWorkOrdersQuerySchema.safeParse({
    page: request.nextUrl.searchParams.get('page') || '1',
    pageSize: request.nextUrl.searchParams.get('pageSize') || '25',
    status: request.nextUrl.searchParams.get('status') || undefined,
    priority: request.nextUrl.searchParams.get('priority') || undefined,
    assignedToUserId: request.nextUrl.searchParams.get('assignedToUserId') || undefined,
    search: request.nextUrl.searchParams.get('search') || undefined,
    includeClosed: request.nextUrl.searchParams.get('includeClosed') || 'true',
  });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'view');

    const parsed = parseListQuery(request);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const result = await listWorkOrders(actor.tenantId, parsed.data);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Work orders list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireWorkOrderActor();
    requireWorkOrderPermission(actor, 'create');

    const body = await request.json();
    const parsed = CreateWorkOrderInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const workOrder = await createWorkOrder(actor, parsed.data);
    return NextResponse.json({ success: true, data: workOrder }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkOrderApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Work order create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
