# Assistant and private pilot — 4 October 2026

The user explicitly withdrew landing-page and UI redesign work. Landing files are unchanged; transient loading/error/toast redesigns were reverted. New controls only expose assistant capabilities in the existing interface.

## PDF opening

The PDF engine is mounted during loading, rather than waiting for its own completion event before mounting. Closing works while loading, pending loads time out, retry remounts the renderer, and stable file/options references avoid restart loops. `scripts/sync-pdf-worker.cjs` resolves PDF.js **from react-pdf**, which currently uses 4.8.69, rather than the independent extraction dependency (4.9.155) or the stale public worker (5.4.394). Both dev and build synchronize the locally served worker. `camera=(self)` also fixes the browser permission policy that previously disabled factory scanning.

## Automatic assistance

Authenticated `/api/ai/insights` reads current company/role data and produces operational checks for overdue orders, blocked operations, available stock, pending counts, unplaced inventory, shipments, notification failures and missing setup. Links respect route permissions. User/role/path-scoped cache expires after 30 seconds; client refreshes every 90 seconds while visible and online. An automatic GPT-6 Luna review runs at most once per user/role per three minutes per browser session; operational checks remain available without the model. The brief is an advisory explanation, not an autonomous stock mutation.

Chat uses server-verified context for orders, production, inventory, purchasing and, where permitted, finance. Currency totals are separate and order value is not cash collected. Worker context only contains assigned technical jobs and operations. Data absence is explicitly distinguished from an authorization restriction. Responses API `search_workspace` can find records beyond the bounded initial lists. SDK-only `parsed_arguments` is removed from tool-call inputs and encrypted reasoning is included for stateless multi-step calls.

Assistant actions include validated internal navigation, order notes and multi-item order drafts. Notes/drafts are reviewed in an existing confirmation dialog. Drafts enter the existing human-review flow; no confirmed order is created directly by the model. Server authorization, tenant isolation, input validation, same-origin checks and immutable command UUID/payload hashes prevent duplicate writes. Migration 022 extends the draft source allowlist with `assistant`. This does not turn the LLM into an unrestricted SQL or production-rule engine.

## Private access

`PRIVATE_ACCESS_EMAIL` restricts password/ticket/OAuth sign-in and refreshes existing sessions against the live identity. Registration is closed when set; unauthenticated workspace APIs, files and tracking pages are protected. Leave it unset for the normal multi-user product. Private pilot credentials exist only in ignored `.data/preview-test-account.json`; they are not bundled or shown on the login page. The custom-domain release remains a Hobby pilot using its isolated Preview data/storage; no paid-plan activation or live factory migration occurs.

## Verification

Run `npm run type-check`, `npm run lint`, `npm test -- --runInBand`, and `npm run build`. `RUN_REAL_AI=1 npx node@22 scripts/verify-assistant-browser.cjs` uses local `renkflow_test` exclusively, tests actual PDF canvas rendering on desktop/mobile, automatic suggestions, draft review/approval, note idempotency, changed-payload rejection and a real model response. It requires the existing warehouse test fixture, local PostgreSQL, Chrome and a build. Reports stay ignored in `.data`.
