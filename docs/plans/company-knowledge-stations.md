# Company workspaces, knowledge and station tablets

Baseline: main 8dc9efd3, 2026-10-16. Existing modules are retained.

## Existing foundations

- AppleSidebar + NavigationGroup share permission-filtered dashboard-nav with mobile navigation. Existing brand assets support both themes.
- Auth.js JWT sessions select a tenant membership, revalidated by member-access. No request-host binding exists. Tenants already have unique slugs.
- Private Vercel Blob storage uses stable keys and authenticated content routes; production files/order documents have their own authorization.
- FactoryWorkspace and production operations already implement start/pause/complete, versioned idempotent commands, quality checks and rework. There is no independently enrolled station device.
- No general company knowledge/category/document revision service exists.

## Stages and completion evidence

1. Navigation: quiet styling, thin icons, persisted member/company-scoped groups, keyboard access, reduced motion, mobile regression.
2. Subdomains: strict hostname parser; unique company address reservation; host-bound login/session and API actor checks; host-only cookies; root/preview compatibility; no client-selected tenant. Test unknown/reserved hosts, multi-membership login, session mismatch, header spoofing and revoked membership. Verify real Vercel domain + HTTPS separately.
3. Knowledge: categories, searched metadata, private documents and immutable numbered revisions with optimistic concurrency; document visibility (company or office) enforced on lists, detail and bytes. Use existing storage, validate types/sizes, audit changes. Test tenant/role isolation, concurrent revisions, preview and downloads.
4. Stations: admin-enrolled and revocable device cookie, separate from member sessions; assignment to warehouse or exact work-center; least-privilege technical payloads, no customer/price data. Read-only warehouse stock/movements plus safe operational checklist actions; existing operation transition engine retained. No per-task staff PIN. Test cross-station/tenant operations, expiry/revocation, replay/concurrency and touch UI.

Migrations are additive and first exercised on a disposable database. Each stage requires typecheck, lint, meaningful tests; final gate also includes production build and browser evidence. A passing narrow test never proves all four stages complete.
