# Personnel, product selection and live 3D

Product names suggest the twelve supported 3D products from two characters, with Turkish/ASCII search, arrow keys and Enter. Selecting a different product invalidates the former technical configuration while retaining quantity, price and discount. Selecting the same configured product retains its dimensions.

Settings → Çalışanlar defines absence, unpaid leave and half-day coefficients. New defaults are 1.5, 1 and 0.5; paid annual leave remains paid. Each new attendance entry records the rule version, rate, currency and calculation basis. Note-only edits and retries retain this snapshot. Existing rows retain their old calculation. Salary payments store the calculation used at payment time and support command replay without duplicate payments. Missing saved rates and currency conflicts require review. This is the agreed net-pay draft, not statutory tax/SGK payroll; extra wage deductions require accountant review.

Warehouse opens on Depolar. Depo ekle requests name and purpose; the code can be generated automatically. A successful creation selects the warehouse so Raf ekle starts in the correct place. Scanning, labels, transfers and counts retain their existing routes and security.

Assistant model labels come from server configuration, and successful replies expose the actual Anthropic response model. Claude Sonnet 5.5 remains the active provider. The assistant can locate permitted employee/warehouse records and prepare validated internal review forms; tenant membership, roles and hidden-field rules remain enforced.

Both configurators synchronize externally restored/template values without resetting local intermediate edits on unrelated renders. Valid edits update on the next animation frame. Product geometry edits preserve camera orientation. Powder-coated profile materials use physical shading; the awning has environment reflections and improved shadows. Resources remain disposed on unmount; 3D appearance remains independent from deterministic production calculations.

## Validation

- 154 Jest suites, 1,131 tests; typecheck and production build pass.
- Lint has zero errors (three pre-existing unused-disable warnings); tenant guard passes.
- Real local Postgres integration covers rule changes, paid leave protection, rate snapshots, receipt history, payment replay, duplicate warehouse codes and tenant isolation.
- Real browser → API → database checks cover warehouse/shelf creation, multi-line quote save/reopen, preserved prices, independent projection/mounting height, settings and payroll review, AI form preparation and foreign employee rejection.
- Rendered WebGL images change on appearance edits for both awning and guillotine glass. Mobile dialogs have no horizontal overflow; no browser exceptions or local server 5xx in the complete run.
- Additive migration 059 was replayed twice on a dedicated Neon verification branch before production. Existing attendance and payment row counts are unchanged.
