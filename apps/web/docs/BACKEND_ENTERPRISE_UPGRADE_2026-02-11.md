# RenkFlow Backend Enterprise Upgrade - 2026-02-11

## Scope

This iteration adds production-grade backend upgrades focused on onboarding activation, support traceability, and operational execution reliability.

## Added capabilities

1. Onboarding activation backend
- New endpoint: `GET /api/onboarding/session`
- New endpoint: `POST /api/onboarding/session` with body:
  - `stepKey`: `tenant_profile | workstation_setup | first_order_created | first_operator_invited | first_work_order_assigned`
  - `metadata` (optional key/value)
- Tenant-scoped session and step completion tracking with idempotent upsert behavior.

2. Work order root-cause enforcement for blocked state
- `PATCH /api/work-orders/[workOrderId]` now supports:
  - `blockedReasonCategory`
  - `blockedReasonDetail`
- Transition or update to `blocked` now fails unless both reason fields are provided and valid.
- Leaving `blocked` automatically clears block-reason fields.

3. Support request persistence with context
- `POST /api/contact` now persists a support ticket record in DB.
- Captured context:
  - `tenantId`, `userId` (if provided)
  - `pagePath`, `locale`, `userAgent`, request metadata
- Email delivery is attempted via Resend when configured; request is still persisted if email transport is unavailable.
- Tenant support operations API:
  - `GET /api/support/tickets`
  - `POST /api/support/tickets`
  - `GET /api/support/tickets/[ticketId]`
  - `PATCH /api/support/tickets/[ticketId]`

4. Dashboard KPI extension
- `GET /api/analytics/summary` now includes:
  - `onTimeDeliveryRate`
  - `avgWipAgeDays`

5. Delay warning heuristics API
- New endpoint: `GET /api/analytics/delay-warnings?limit=30`
- Returns proactive risk buckets for pending/in-production orders:
  - `on_track | at_risk | delayed`
  - predicted delay day estimate
  - recommendation text for quick mitigation

## Database changes

Migration added: `apps/web/lib/db/migrations/011_onboarding_support_blocking.sql`

### New/updated schema
- `work_orders`
  - `blocked_reason_category`
  - `blocked_reason_detail`
  - `blocked_at`
- `onboarding_sessions` (new)
- `onboarding_steps` (new)
- `support_tickets` (new)

`apps/web/scripts/ensure-backend-schema.ts` now applies migration `011_onboarding_support_blocking.sql`.

## Operational notes

- All new backend writes are tenant-aware and transaction-safe where applicable.
- API contracts are backward compatible for existing clients.
- New event taxonomy constants are defined in `apps/web/lib/analytics/event-schema.ts`.
