# Work Orders API (Multi-Tenant, Production Ready)

## Overview

This module adds a maintenance / operations execution core for factory and office workflows:
- Work order lifecycle (`open -> in_progress -> blocked -> done/cancelled`)
- Checklist execution
- Threaded operational comments (flat timeline)
- Assignment and SLA-oriented summary metrics
- Tenant-level authorization and role-based permissions

## Endpoints

1. `GET /api/work-orders`
- List with filters and pagination.
- Query params: `page`, `pageSize`, `status`, `priority`, `assignedToUserId`, `search`, `includeClosed`.

2. `POST /api/work-orders`
- Create work order with optional checklist.

3. `GET /api/work-orders/[workOrderId]`
- Get work order details with checklist + comments.

4. `PATCH /api/work-orders/[workOrderId]`
- Update title/description/priority/assignee/status/checklist additions.
- Status transitions are validated server-side.

5. `GET /api/work-orders/[workOrderId]/comments`
- List comments for a work order.

6. `POST /api/work-orders/[workOrderId]/comments`
- Add comment.

7. `POST /api/work-orders/[workOrderId]/checklist/[itemId]/toggle`
- Toggle checklist completion state.

8. `GET /api/work-orders/summary`
- Operational summary: overdue, due today, status split, throughput, avg resolution time.

## Security model

- Session + tenant membership verification on every endpoint.
- Role-based permissions:
  - `owner/admin`: full control
  - `office`: operational management
  - `worker`: execution and status/comment/checklist
  - `member`: view/comment/checklist
  - `accountant`: view/create/comment/checklist

## Storage model

Migration: `apps/web/lib/db/migrations/010_work_orders.sql`

Tables:
- `work_orders`
- `work_order_checklist_items`
- `work_order_comments`
- `work_order_events`

## Notes

- `apps/web/scripts/ensure-backend-schema.ts` now also applies:
  - `009_bank_reconciliation_tables.sql`
  - `010_work_orders.sql`
- All writes are transaction-safe (`withTransaction`) and event-logged (`work_order_events`).
