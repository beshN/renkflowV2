# Work-order Kanban

The /kanban board uses the existing work-order APIs and server business rules.
Previously moves only changed React state, empty columns were not droppable,
every drop reported index zero, only the first 25 jobs loaded, and cancelled
jobs appeared completed.

Cards now persist status and shared order; empty columns, keyboard navigation
and a separate 44px touch drag handle are supported. The board loads all
pages, keeps cancelled jobs separate and offers text/assignee/priority/deadline
filters. Card dialogs create/edit jobs and manage assignees, deadlines,
checklists and comments without leaving the board.

Mutation failure restores the board and reloads server state. Revision checks
prevent stale edits; an advisory tenant lock serializes board placement.
Neighbours must belong to the same tenant and destination column. The server
calculates positions and rebases tight gaps. Existing stock and quantity data
are never changed by reordering. Material-backed job status changes use the
production workflow, rather than bypassing its stock transfers.

Apply lib/db/migrations/050_work_order_kanban.sql before releasing this code.
It adds board_position, backfills the initial order and creates a board index;
reruns leave existing positions and all business fields unchanged.

The work-order API returns capabilities from live membership and custom
access. Operators see only assigned jobs; another operator's detail, comments,
edits and checklist are rejected.

Verification: 129 Jest suites / 884 tests; TypeScript, lint and production build
passed. scripts/test-kanban.ts checks real PostgreSQL persistence, concurrent
revision conflicts, tenant/worker scope, checklist/comment counts, 108-job
pagination and migration idempotence. Actual credential login and HTTP API
round trips were verified on the isolated local database. Component tests
cover empty-column drops, order indexes, rollback, block reasons, filters,
read-only access and preserving unsaved text during checklist changes.

Local PostgreSQL for these scripts uses port 55439 and renkflow_kanban_test.
With that isolated cluster running, run scripts/setup-kanban-test-db.ts then
tsx --require ./scripts/register-server-only.cjs scripts/test-kanban.ts.
They never read a supplied production DATABASE_URL.

Fresh visual browser verification was unavailable: Browser Use refused access
because its admin-enforced policy could not be verified. No browser controls
were bypassed.
