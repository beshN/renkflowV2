-- Indexes for the queries the app runs on every screen. Until now these tables had only their
-- primary key, so a firm's order page, customer list or file view scanned every firm's rows.
-- Each index is backed by queries in the code (see the PR that adds this file). Adds indexes only;
-- no data changes. Idempotent.

-- Order detail, invoices, deliveries: items of an order (order_items has no tenant_id; the order
-- is always loaded with its tenant first).
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items (order_id);

-- Order lists newest first, and a customer's orders.
CREATE INDEX IF NOT EXISTS orders_tenant_created_idx ON public.orders (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_tenant_customer_idx ON public.orders (tenant_id, customer_id);

-- Customer list, lookups and import matching.
CREATE INDEX IF NOT EXISTS customers_tenant_created_idx ON public.customers (tenant_id, created_at);

-- An order's work orders (order page, chain, change requests).
CREATE INDEX IF NOT EXISTS work_orders_tenant_order_idx ON public.work_orders (tenant_id, order_id);

-- Stock: a lot's item and warehouse (cutting plans, physical-profile checks), an entry's lines,
-- a reservation's lines.
CREATE INDEX IF NOT EXISTS stock_lots_tenant_item_wh_idx ON public.stock_lots (tenant_id, item_id, warehouse_id);
CREATE INDEX IF NOT EXISTS stock_entry_lines_entry_idx ON public.stock_entry_lines (stock_entry_id);
CREATE INDEX IF NOT EXISTS stock_reservation_lines_reservation_idx ON public.stock_reservation_lines (reservation_id);

-- Shipments of an order or a work order, and the recent list.
CREATE INDEX IF NOT EXISTS production_shipments_tenant_order_idx ON public.production_shipments (tenant_id, order_id);
CREATE INDEX IF NOT EXISTS production_shipments_tenant_wo_idx ON public.production_shipments (tenant_id, work_order_id);
CREATE INDEX IF NOT EXISTS production_shipments_tenant_created_idx ON public.production_shipments (tenant_id, created_at DESC);

-- Files: an order's documents, and the ownership check on every file view / storage cleanup.
CREATE INDEX IF NOT EXISTS documents_tenant_order_idx ON public.documents (tenant_id, order_id);
CREATE INDEX IF NOT EXISTS documents_file_path_idx ON public.documents (file_path);
CREATE INDEX IF NOT EXISTS order_documents_file_url_idx ON public.order_documents (file_url);

