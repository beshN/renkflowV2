# RenkFlow Product Gap Analysis - 2026-02-10

## Scope

This review compares current RenkFlow backend capabilities to workflow leaders such as Trello (collaboration orchestration) and MaintainX (operations + maintenance execution).

## Implemented in this cycle

1. Tenant activity feed API
- `GET /api/tenant/activity` with pagination and filters (`action`, `entityType`, date range).
- File: `apps/web/app/api/tenant/activity/route.ts`

2. Invite lifecycle hardening
- Invite revocation endpoint: `DELETE /api/tenant/invites/[inviteId]`.
- Paginated invites list endpoint improvements.
- Files: `apps/web/app/api/tenant/invites/[inviteId]/route.ts`, `apps/web/app/api/tenant/invites/route.ts`

3. Multi-tenant safety and provisioning reliability
- Existing-account invite accept flow now supported.
- SSO provisioning and OAuth sign-in made transaction-safe and idempotent.

## Remaining product gaps (priority)

1. Work orchestration depth (P0)
- Need recurring work orders, dependencies, SLA timers, and escalation policies.
- Current system has tenant/member/order base but lacks a full task/work-order orchestration engine.

2. Execution compliance (P0)
- Need checklist templates, required proof artifacts (photo/signature), and immutable completion attestations.
- Current audit/event model is strong but execution workflow objects are missing.

3. Asset-centric operations (P1)
- Need asset registry, preventive maintenance schedules, meter readings, and downtime tracking.
- MaintainX-class operations require asset/work-order coupling.

4. Automation and integrations (P1)
- Need event-triggered automations, webhook subscriptions, and integration recipes (ERP/accounting/chatops).
- Existing backend has API foundations, but no user-facing automation engine.

5. Collaboration UX primitives (P1)
- Need comments with mentions, watchers/subscriptions, and actionable notifications per item.
- Current notification infrastructure exists but requires item-level collaboration models.

## Next implementation pack (decision-ready)

1. `work_orders` domain
- Tables: `work_orders`, `work_order_steps`, `work_order_assignments`, `work_order_events`, `work_order_sla`.
- APIs: create/update/assign/transition/complete/reopen + SLA metrics.

2. Template + recurrence engine
- Tables: `workflow_templates`, `recurrence_rules`, `workflow_instances`.
- Cron/queue execution for schedule expansion.

3. Collaboration layer
- Tables: `item_comments`, `item_watchers`, `item_mentions`.
- Notification fan-out into existing notification service.

4. Operations analytics
- SLA breach rate, MTTR, on-time completion, blocked-step metrics.
- Tenant-level and assignee-level dashboards.
