# PDF manufacturing sheet to order: deployment fix

Production requests to `/api/v1/orders/foy` failed before reading the document because `pdfjs-dist/legacy/build/pdf.worker.mjs` was absent from the function bundle. Source-only tests had the worker in their local node_modules, so they did not reproduce the deployed failure.

Next.js now explicitly includes this one dynamic asset in API function traces. Shared AI/inbound APIs also reach the same reader, so the asset covers those entry points. A postbuild check scans every API trace containing the PDF reader and requires its worker in the trace and standalone output. It then imports the deployable reader and extracts real embedded Turkish text from a synthetic PDF. The old build fails this check; the corrected build passes.

A real two-system manufacturing-sheet PDF is covered by isolated Postgres integration tests: reading does not create an order; approval persists two order lines; 701 cm becomes 7010 mm and 400 cm becomes 4000 mm; source PDF attachment and tenant/worker permission checks pass. The source file has no prices, so the application preserves zero prices for manual commercial review.

The browser was tested against the actual standalone output: file chooser upload, review of two systems and the five cut rows, approval, created order link and two persisted product lines. Failed reads can be retried without choosing the file again. The order detail displays width, projection, height and mounting height separately when present, eliminating the former blank `width × mm` display.
