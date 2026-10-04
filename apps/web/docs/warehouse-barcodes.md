# Factory warehouse and barcode operations

The implementation follows event-based traceability, explicit location verification and transaction-backed stock movements. Research references:

- GS1 traceability: https://www.gs1.org/standards/gs1-global-traceability-standard/current-standard
- GS1 logistic labels (human-readable identity, contrast, quiet zones): https://www.gs1.org/standards/gs1-logistic-label-guideline
- Zebra receiving and material movement: https://www.zebra.com/gb/en/resource-library/use-case-library/receiving-and-material-movement-in-manufacturing.html
- Odoo warehouse locations: https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management/use_locations.html
- ZXing browser implementation: https://github.com/zxing-js/browser

## Identification and devices

`/warehouse` manages shelves, pending counts and the latest 100 location ledger movements. `/warehouse/scan` resolves QR/Code 128, manual SKU/lot and shelf codes. `/warehouse/labels` prepares labels for materials, shelves, physical lots/remnants, production orders, cutting packages and finished units. Older production-label links redirect here. Old UUID barcodes and factory QR links are supported; legacy short printed identities require an unambiguous company match.

An internal stable `RF-{kind}-{12 hex digits}` code identifies one record. The barcode and human-readable text encode that same code; the QR contains an authenticated internal link with it. These are **internal Code 128 / QR labels, not GS1-128, GTIN, SSCC or an externally certified GS1 implementation**. GS1 assignments and agreed trading-partner formats are separate requirements for external logistics integration.

A USB/Bluetooth keyboard-wedge scanner should send Enter after a code. A 2D imager reads both QR and Code 128; a 1D reader handles Code 128. A camera is started only after the user asks, uses a lazy ZXing decoder and stops streams on completion, unmount or page hiding. HTTPS and camera permission are required; manual/scanner entry remains available after permission or hardware failure.

## Operational rules

1. Create warehouse types in the production setup, then shelves in the warehouse. A generated `UNASSIGNED` location means stock has not yet been placed; it does not assert a real shelf position.
2. Receive material against the existing receipt/production intake document. The existing receipt, consumption, cutting, rework and shipment ledger automatically updates shelf balances. Opening a label never changes stock.
3. Select/scan material or lot, source shelf and destination shelf. Confirm quantity and submit. Only office/manager roles post movements. Operators can resolve technical labels and assigned jobs; they receive no costs, count review or private movement notes.
4. A physical bar/remnant moves as its complete remaining length. Cutting creates pieces/remnants. Consumable lots support partial transfer into a child lot that retains source batch lineage. Reserved lots cannot be moved; transfers across production, finished-goods or quarantine boundaries must use the corresponding work document. Raw-warehouse transfers protect warehouse reservations. Finished units follow production/shipment documents, rather than arbitrary stock edits.
5. Counts capture a quantity and the shelf snapshot version. Submitting a count does not alter stock. Only a manager approves/rejects with a reason. Intervening movements require a new count. Physical-lot and finished-unit quantity discrepancies must be investigated in their source records; aggregate corrections cannot erase physical traceability.
6. Transfers produce balanced ledger lines and explicit source/destination location events. Production commands serialize per company; command UUID, actor and payload hash prevent repeated requests or reuse with changed content. Old shelf versions are rejected. Corrections retain history: reverse a physical transfer with another verified transfer; resubmit a corrected count for review. No deletion of submitted ledger history.
7. Warehouse writes require an online server response. They are not silently marked complete or queued as offline stock. Existing assigned production operations retain their separate offline queue. An ambiguous network response can be retried with the original command while the current screen is retained; a changed payload is blocked until it is resolved.

## Labels and rollout

Black on white, QR quiet zone of four modules, Code 128 margins of ten modules and matching human-readable identity. A4 sheets use 100×70 mm labels; thermal options are 100×70 mm and 80×50 mm. Print at 100% without browser headers/footers. QR and barcode images must finish rendering before print is enabled. A print-request audit cannot confirm that a physical printer delivered a sticker.

Configure a stable production hostname before printing long-lived factory QR labels. Preview URLs are for testing. Use an industrial 2D reader and suitable adhesive/thermal-transfer media for dust, abrasion and the actual surface. Test contrast, scale, mounting position and reading distance with the selected printer/scanner before mass labeling; do not put labels on hot/exposed surfaces without material-specific validation.

Migration `021_warehouse_barcodes.sql` backfills current warehouse stock into unassigned locations once and preserves later shelf placements on repeat releases. It does not infer shelves for existing inventory. A PostgreSQL trigger mirrors every new existing stock ledger line into shelf balances, including deterministic allocation of unlocated legacy bulk consumption. Physical-lot movements use the lot's current shelf.

Verification commands: `npx tsx --require ./scripts/register-server-only.cjs scripts/test-warehouse.ts`, then a production build and `node scripts/verify-warehouse-browser.cjs`. Fixtures are exclusively on local `renkflow_test`; reports and screenshots are ignored in `.data`. Unit tests cover input validation and handheld/camera fallback. Browser tests exercise real transfer/count/approval and decode rendered QR and Code 128, rather than only checking image presence. Hardware read performance and physical adhesive durability require the pilot device test above.

Verified on 2026-10-03: 50 suites / 300 unit tests, typecheck, lint and production build; isolated PostgreSQL warehouse invariants and existing production regressions; 31 existing authenticated screens and worker/offline workflows. Browser tests verify 390 px mobile layouts, camera-denied fallback, offline stock-write protection, printed QR/Code 128 equality at 203 DPI, exact 100×70 / 80×50 mm PDF sizes, one thermal label per page, two thermal copies on two pages and two A4 labels on one page.
