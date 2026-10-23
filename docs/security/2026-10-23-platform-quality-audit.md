# Platform quality and security follow-up — 23 October 2026

Continues [the authentication/office audit](2026-10-23-web-audit.md) on the existing manufacturing architecture. The repository inventory contains 98 page entry points and 215 API route files; this inventory is **not** a claim that every page/control received an interactive test. Landing/theme work, published production recipes, live customer data and production schema are unchanged.

## Confirmed defects corrected

| Flow | Evidence and resulting behaviour |
| --- | --- |
| New order → document extraction | The model returns `DocumentExtraction.items`, but the page expected old Turkish/English flat keys, discarded line items and substituted a generic product. Both upload entry points now use `extractIntake`, which preserves all lines, source documents and evidence. The page opens the persisted review; approval remains explicit and idempotent. |
| Document upload access | The old endpoint trusted a session role and had no shared request throttle. It now resolves current membership and the narrowed order-create permission, checks Origin, validates its request and shares the PostgreSQL-backed assistant rate policy. Reading/approving intake drafts uses the same order-create boundary in service and proxy. |
| Long document requests | The client gave up after 65 seconds despite the route's 300-second budget. It now permits 270 seconds, cancels its request on navigation, prevents overlapping uploads and offers a capability retry. It no longer manufactures a single-product form from a failed mapping. |
| PDF evidence | The intake page used an embedded browser PDF iframe. It now opens the existing lazy, authenticated PDF.js viewer. Evidence links request a page, clamped to the loaded PDF. A real-browser check also exposed missing scroll navigation in continuous mode: toolbar/evidence changes now scroll to their virtual row, old observer callbacks cannot undo the request, and natural scrolling updates the toolbar without jumping back. Modal focus/Escape behaviour and engine cleanup are retained. Product-dialog labels describe the actual line instead of calling every product an awning. |
| Actual request size | Header-only limits could be bypassed by absent/understated Content-Length. A shared streaming JSON reader caps real UTF-8 bytes, cancels oversized streams, releases locks and rejects broken JSON, invalid UTF-8 and deceptive media types. Field/mobile requests retain their 64 KB default. Adopted on critical order/quote/customer/AI/intake/office/production and push writes; not claimed for every historical request parser. |
| Browser write Origin | Five legacy manufacturing handlers now use the common guard. The proxy also refuses foreign-Origin writes with a valid member cookie before older authenticated API handlers execute. Existing Auth.js/SAML, station and public-token protocol branches retain their own checks; this does not replace bearer authentication or one-time callback state. |
| Push subscription ownership | DELETE previously accepted an endpoint without a user constraint; endpoint-conflict UPSERT could replace another user's encryption keys. Both are scoped to the authenticated user. Concurrent claims have one owner and one 409 response. Missing own subscriptions delete idempotently. |
| Push request destination | Registration and delivery permit HTTPS browser push endpoints for Google, Mozilla, Apple and Microsoft only; localhost, metadata IPs, arbitrary domains, deceptive hostnames, credentials, fragments and alternate ports are rejected. Old unsupported rows are not contacted. Endpoint/key sizes are validated. Custom/self-hosted push providers need explicit future support. |
| CSV exports | Order/customer and analytics exporters escaped separators but did not neutralize formula-leading user text. A shared serializer protects cells and headers, including leading whitespace/control characters and full-width prefixes. Audit exports reuse it. Typed numeric negative amounts remain numeric. CSV is for spreadsheet viewing, not a lossless backup; spreadsheet re-saving can alter escaping, and this is not a universal spreadsheet security guarantee. |
| Workspace accessibility | Twenty-two dashboard pages nested a second `main` landmark inside the shared layout. Their inner wrappers are now neutral `div` elements; classes, handlers and visible styling are unchanged. |
| Finance filter errors | A malformed employee UUID produced 503. It now returns a useful 400 after authentication and before finance queries. Responses remain private/no-store. |

## Validation

- Local validation (full validate, followed by the final PDF/accessibility typecheck, lint, Jest and build checks): backend/tenant/SQL/environment guards, TypeScript, lint (zero errors; three existing unused-suppression warnings), **208 Jest suites / 1,500 tests**, production build and packaged PDF extraction passed.
- The complete disposable PostgreSQL integration run passed **59/59 existing scripts**. It includes production lifecycle, factory concurrency/stress, reservations, stock, partial shipments, quality/rework, sales-to-service, payroll policy, company/station boundaries, office files, OAuth MFA and documents. It does not contact production.
- New `test-push-ownership.ts` additionally passed against an isolated local `renkflow_test`: foreign delete cannot remove a registration, foreign UPSERT cannot change it, same-user renewal works, concurrent claims have one winner, repeat removal succeeds. CI automatically discovers this new script (60 total).
- Regressions exercise multi-line upload routing, capability failure/retry, upload failure, revoked/narrowed membership, 429/Retry-After, actual-byte limits and cancellation failure, production foreign origins, CSV attack payloads, finance error mapping, PDF evidence page bounds and push ownership/provider validation.
- Real local HTTP checks on the production build: a legacy cookie-authenticated tenant write rejects foreign Origin with 403; malformed tenant/quote/filter input returns 400; a chunked office body without Content-Length exceeds the actual-byte cap and returns 413; authenticated PDF bytes return 200, anonymous access 401; metadata-service push URLs are rejected before a provider call.
- Real browser, synthetic local company: two draft lines (awning and pergola) preserve widths, projection and mounting height separately. Approval without required reviews creates zero orders. After review, 2 × 100 and 1 × 250 become two stored lines, three units and a 450 total. The source PDF opens on page 2; previous-page navigation reaches page 1 and the viewer closes normally. At a 390 × 844 viewport, document width equals client width (no horizontal overflow).
- Browser evidence is kept in ignored `.data/quality-pdf-page2-20261023.png`, `.data/quality-intake-mobile-20261023.png`, and the accompanying local HTTP/database JSON proofs. The model result in this browser fixture was seeded; this is not a live-model extraction accuracy claim.
- Exact code-head CI and protected Vercel preview checks are release gates. The PDF fix preview reached READY and its authenticated `/api/health/ready` returned `{"status":"ready"}`; subsequent semantic-only accessibility changes must finish their own checks before merge.

## Limits and release dependencies

No independent penetration-test certification or absolute absence-of-defects claim is made. Real external-model/Google/WhatsApp/e-mail delivery, physical barcode hardware and every mobile OS/device were not all exercised in this follow-up. The nine previously recorded upstream development-tool advisories and pending DNS/TLS/external provider configuration remain separate dependencies.

This follow-up adds no migration. Releasing the branch still includes migrations 078–079 from the preceding audit, which require a fresh production backup and the existing migration/release runbook. No production migration or deployment is claimed here.

## References used in review

- [OWASP REST request validation, limits and status codes](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP upload authorization, signature and size controls](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP CSV injection and spreadsheet-specific limits](https://community.owasp.org/attacks/CSV_Injection)
- [Apple web push endpoints](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [Mozilla Autopush endpoint](https://mozilla-services.github.io/autopush-rs/http.html)
