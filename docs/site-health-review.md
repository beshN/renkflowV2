# Public site health review — 2026-10-09

Base: `bbc2825` (main). Scope: public website, responsive navigation, demo/contact flow and anonymous authentication entry points.

## Findings and changes

- At 768 px the live header had 803 px of content, overlapping the brand and clipping the right action. Desktop navigation now starts at 1024 px. The mobile dialog closes on same-page navigation and when resized to desktop.
- Demo links led to a mail-only contact page whose closing demo action linked back to itself. A themed, accessible request form now submits to the existing contact API; the redundant closing section is omitted on this page.
- Contact could report success after database failure and treated a configured email provider as successful delivery. Acceptance now requires a persisted ticket. Email errors do not turn a saved ticket into a retry prompt, and delivery reflects the actual provider response.
- The public contact endpoint ignores client-supplied tenant/user IDs. Private-pilot middleware permits this exact public endpoint; business APIs remain protected.
- Failed submissions preserve the draft. Success focuses the confirmation so it remains visible to mobile and keyboard users.
- Includes the previously requested removal of the landing hero industry chip and its extra margin.

## Verification

Live read-only inspection: 390, 768, 1024 and 1440 px; 16 routes including contact, pricing, features, integrations, security, docs, FAQ, blog, status, legal pages, login, signup, password recovery and dashboard. Public/auth entry pages returned 200; anonymous dashboard navigation redirected to login with its callback preserved. No page-level JavaScript exceptions were observed.

Local checks: tenant/backend/environment guards, TypeScript, ESLint, all 574 tests in the initial full run, one additional private-pilot proxy regression test, and production build. Six new contact API tests cover persistence failure, provider rejection/transport failure, accepted delivery, untrusted identities, validation and throttling.

Chromium against the production build verified all four widths, theme switching, same-page menu closure, dismissal on desktop resize, draft preservation after a simulated 503, and a real browser → API → isolated PostgreSQL ticket → success response. Test mail delivery was disabled; the test ticket was removed afterwards. The public form was exercised with private-pilot restrictions enabled.

## Limits

No real messages were sent through the live contact form. Production email delivery and authenticated customer workflows were not exercised with a real account. Changes require the PR to be merged and deployed before they affect the live site.
