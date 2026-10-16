# Company workspaces, knowledge and station tablets

The existing Auth.js, private storage and production-command services remain in use.

- Navigation keeps the RenkFlow lockup and mobile routes, with thin icons, quiet transitions, reduced-motion support and collapsible groups remembered per member/company.
- Company addresses are reserved independently of legacy tenant slugs. The actual Host selects the company for password/ticket authentication, web sessions and bearer/mobile actors. Unknown hosts fail closed; host-only cookies remain isolated. Renamed or deleted company addresses cannot be reclaimed by a different company.
- `/knowledge` provides categories, search, text and private attachments, company/office/manager visibility, immutable numbered revisions, optimistic concurrency, archive/restore and permission-checked preview/download. Shareable document links require an authenticated permitted user. Uploads use existing storage validation and cleanup accounting.
- Settings → İstasyon tabletleri enrolls a device in an exact work center or warehouse using a one-use, ten-minute pairing code. The device receives a separate 90-day HttpOnly host-only cookie. Administrators can reassign or revoke it; inactive enrollment administrators invalidate access. Routine station work requires no staff PIN.
- `/station` shows warehouse locations/movements or production queues, technical configurations/drawings, assigned knowledge instructions and mandatory cutting/accessory checks. Large touch controls use existing production transitions and stock/quality invariants. Devices never receive customer or price fields. In-flight uncertain commands retain their command ID; offline completion is not presented as accepted.

## Evidence

- 160 Jest suites / 1,158 tests passed, plus the latest hostname redirect cases. Typecheck, lint and standalone production build passed.
- All 44 isolated PostgreSQL integration scripts passed. Additional station checks validate searched warehouse balances/movements and required packing accessories against actual WIP consumption, with exact replay producing one manufacturing entry.
- Actual tablet-sized browser → API → database verification covers text document creation/revision/history, administrator pairing, operation start, mandatory checks and successful completion. Company-host password sign-in/sign-out stays on the company address. Authenticated PDF.js preview renders both pages of the technical drawing; browser-dependent PDF iframes have been replaced in the new workspaces. Screenshots are local QA artifacts, not production data.
- PDF attachment persistence, visibility and bytes are integration-tested. Browser file selection is pending the user's Chrome extension file-URL permission; it is not claimed as verified.
- Migrations 060–062 ran twice on the existing production-derived `verify-attendance-policy-20261014` Neon verification branch (`br-long-sky-b2c5crey`); ledger is 68/68. Tenant/user/order counts remained 1/3/2. This branch and current production had identical pre-change migration ledgers. The account's branch limit prevented a new verification branch; no old backups were deleted. The independent Vercel Preview database is also migrated and reports 68/68.

## Release prerequisites still open

- A fresh production backup branch is required before production migrations, in accordance with `docs/runbooks/backup-restore.md`. The Neon branch limit must be resolved without silently deleting backups. Production migrations run from the merged current main checkout.
- `*.renkflow.com` is associated with the Vercel project, but external DNS and wildcard TLS are not yet configured. Hostinger login is pending. Existing mail and verification records must be preserved when connecting DNS.
- Company-host OAuth has not been end-to-end verified; the existing central Google callback registration remains unchanged. Do not claim it is validated by password-login tests.

## Additional station audit

- A new pairing link now takes precedence over an existing station cookie, including hash navigation and late responses from the former assignment. Three component regression tests also cover an old-device response arriving after the replacement device has paired successfully.
- Browser QA at 1024×768 created a station from Settings, assigned a work center, custom checklist and knowledge instruction, paired it without a staff PIN, and opened the technical PDF. The same device was reassigned to warehouse and packing through Settings; stock search/location/movements and the order's two-piece accessory check were verified. Revocation returned the existing device to the pairing screen with no job data.
- Station integration checks now read a real PDF stream and verify that an instruction changed to office-only immediately disappears from station lists and its old file link is denied. Unassigned devices cannot read it.
- Preview commit `afe82375` passed the complete web validation gate and all isolated integration scripts; its deployed `/api/health/ready` reports ready. Unauthenticated knowledge and station API requests both return application HTTP 401 after Vercel authentication. These cloud checks do not prove wildcard DNS/TLS.
