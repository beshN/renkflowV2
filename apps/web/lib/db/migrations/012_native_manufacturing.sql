-- RenkFlow native inventory, procurement and manufacturing core.
-- Additive by design: legacy inventory tables remain available during the pilot.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'raw_material',
  ADD COLUMN IF NOT EXISTS stock_uom text NOT NULL DEFAULT 'adet',
  ADD COLUMN IF NOT EXISTS profile_section text,
  ADD COLUMN IF NOT EXISTS standard_length_m numeric(18,6),
  ADD COLUMN IF NOT EXISTS weight_per_meter_kg numeric(18,6),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.inventory_items
    ADD CONSTRAINT inventory_items_item_type_check
    CHECK (item_type IN ('raw_material', 'finished_good', 'reusable_remnant', 'scrap', 'consumable'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  warehouse_type text NOT NULL
    CHECK (warehouse_type IN ('RAW', 'WIP', 'FINISHED', 'REUSABLE_REMNANTS', 'SCRAP', 'REJECTED')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.stock_lots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  lot_number text NOT NULL,
  original_qty numeric(18,6) NOT NULL CHECK (original_qty > 0),
  remaining_qty numeric(18,6) NOT NULL CHECK (remaining_qty >= 0),
  length_m numeric(18,6),
  weight_kg numeric(18,6),
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'consumed', 'scrapped')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, lot_number)
);

CREATE TABLE IF NOT EXISTS public.stock_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_number text NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN (
    'MATERIAL_RECEIPT', 'MATERIAL_TRANSFER', 'MATERIAL_ISSUE',
    'MANUFACTURE', 'STOCK_RECONCILIATION', 'REVERSAL'
  )),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  reference_type text,
  reference_id uuid,
  reversal_of_id uuid REFERENCES public.stock_entries(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  note text,
  submitted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entry_number),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (tenant_id, reversal_of_id)
);

CREATE TABLE IF NOT EXISTS public.stock_entry_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stock_entry_id uuid NOT NULL REFERENCES public.stock_entries(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  lot_id uuid REFERENCES public.stock_lots(id) ON DELETE RESTRICT,
  quantity_delta numeric(18,6) NOT NULL CHECK (quantity_delta <> 0),
  uom text NOT NULL,
  unit_cost numeric(18,6),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_balances (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  on_hand_qty numeric(18,6) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, item_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'consumed', 'released', 'cancelled')),
  idempotency_key text NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (order_id IS NOT NULL OR work_order_id IS NOT NULL),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.stock_reservation_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.stock_reservations(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  lot_id uuid REFERENCES public.stock_lots(id) ON DELETE RESTRICT,
  reserved_qty numeric(18,6) NOT NULL CHECK (reserved_qty > 0),
  consumed_qty numeric(18,6) NOT NULL DEFAULT 0 CHECK (consumed_qty >= 0),
  released_qty numeric(18,6) NOT NULL DEFAULT 0 CHECK (released_qty >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (consumed_qty + released_qty <= reserved_qty)
);

CREATE TABLE IF NOT EXISTS public.boms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bom_code text NOT NULL,
  finished_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  output_qty numeric(18,6) NOT NULL DEFAULT 1 CHECK (output_qty > 0),
  output_uom text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, bom_code, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS boms_one_default_per_item
  ON public.boms(tenant_id, finished_item_id) WHERE is_default = true AND is_active = true;

CREATE TABLE IF NOT EXISTS public.bom_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bom_id uuid NOT NULL REFERENCES public.boms(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity numeric(18,6) NOT NULL CHECK (quantity > 0),
  uom text NOT NULL,
  source_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  scrap_rate numeric(9,6) NOT NULL DEFAULT 0 CHECK (scrap_rate >= 0 AND scrap_rate < 1),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS bom_id uuid REFERENCES public.boms(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS production_item_id uuid REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS planned_qty numeric(18,6),
  ADD COLUMN IF NOT EXISTS produced_qty numeric(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_uom text,
  ADD COLUMN IF NOT EXISTS source_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS wip_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS target_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS scrap_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reservation_status text NOT NULL DEFAULT 'not_reserved',
  ADD COLUMN IF NOT EXISTS manufacturing_idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS work_orders_manufacturing_idempotency_idx
  ON public.work_orders(tenant_id, manufacturing_idempotency_key)
  WHERE manufacturing_idempotency_key IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.work_orders
    ADD CONSTRAINT work_orders_reservation_status_check
    CHECK (reservation_status IN ('not_reserved', 'partial', 'reserved', 'transferred', 'consumed', 'released'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.work_order_materials (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE RESTRICT,
  bom_item_id uuid REFERENCES public.bom_items(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  source_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  required_qty numeric(18,6) NOT NULL CHECK (required_qty > 0),
  reserved_qty numeric(18,6) NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  transferred_qty numeric(18,6) NOT NULL DEFAULT 0 CHECK (transferred_qty >= 0),
  consumed_qty numeric(18,6) NOT NULL DEFAULT 0 CHECK (consumed_qty >= 0),
  uom text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, work_order_id, item_id, source_warehouse_id)
);

CREATE TABLE IF NOT EXISTS public.production_runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE RESTRICT,
  run_number integer NOT NULL CHECK (run_number > 0),
  produced_qty numeric(18,6) NOT NULL CHECK (produced_qty > 0),
  stock_entry_id uuid NOT NULL REFERENCES public.stock_entries(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  completed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, work_order_id, run_number),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.scrap_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  production_run_id uuid NOT NULL REFERENCES public.production_runs(id) ON DELETE RESTRICT,
  source_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  scrap_item_id uuid REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  length_m numeric(18,6) NOT NULL CHECK (length_m >= 0),
  weight_per_meter_kg numeric(18,6) NOT NULL CHECK (weight_per_meter_kg >= 0),
  weight_kg numeric(18,6) NOT NULL CHECK (weight_kg >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.material_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  request_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'ordered', 'closed', 'cancelled')),
  required_by date,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, request_number)
);

CREATE TABLE IF NOT EXISTS public.material_request_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  material_request_id uuid NOT NULL REFERENCES public.material_requests(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  quantity numeric(18,6) NOT NULL CHECK (quantity > 0),
  uom text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchase_order_number text NOT NULL,
  supplier_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'partially_received', 'received', 'cancelled')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, purchase_order_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  material_request_line_id uuid REFERENCES public.material_request_lines(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  ordered_qty numeric(18,6) NOT NULL CHECK (ordered_qty > 0),
  received_qty numeric(18,6) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  uom text NOT NULL,
  unit_price numeric(18,6)
);

CREATE TABLE IF NOT EXISTS public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  stock_entry_id uuid REFERENCES public.stock_entries(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  received_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, receipt_number),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.goods_receipt_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goods_receipt_id uuid NOT NULL REFERENCES public.goods_receipts(id) ON DELETE RESTRICT,
  purchase_order_line_id uuid REFERENCES public.purchase_order_lines(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  accepted_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  rejected_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  accepted_qty numeric(18,6) NOT NULL DEFAULT 0 CHECK (accepted_qty >= 0),
  rejected_qty numeric(18,6) NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0),
  uom text NOT NULL,
  CHECK (accepted_qty + rejected_qty > 0)
);

CREATE TABLE IF NOT EXISTS public.document_extractions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'needs_review', 'approved', 'rejected', 'failed')),
  schema_version integer NOT NULL DEFAULT 1,
  extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_entries_reference_idx
  ON public.stock_entries(tenant_id, reference_type, reference_id);
CREATE INDEX IF NOT EXISTS stock_entry_lines_lookup_idx
  ON public.stock_entry_lines(tenant_id, item_id, warehouse_id, created_at);
CREATE INDEX IF NOT EXISTS stock_reservation_lines_lookup_idx
  ON public.stock_reservation_lines(tenant_id, item_id, warehouse_id);
CREATE INDEX IF NOT EXISTS work_order_materials_work_order_idx
  ON public.work_order_materials(tenant_id, work_order_id);

CREATE OR REPLACE FUNCTION public.protect_submitted_stock_entry()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status = 'submitted' THEN
    RAISE EXCEPTION 'Submitted stock entries are immutable; create a reversal';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN
    RAISE EXCEPTION 'Submitted stock entries are immutable; create a reversal';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_submitted_stock_entry ON public.stock_entries;
CREATE TRIGGER trg_protect_submitted_stock_entry
BEFORE UPDATE OR DELETE ON public.stock_entries
FOR EACH ROW EXECUTE FUNCTION public.protect_submitted_stock_entry();

CREATE OR REPLACE FUNCTION public.protect_submitted_stock_entry_line()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.stock_entries
    WHERE id = CASE
      WHEN TG_OP = 'DELETE' THEN OLD.stock_entry_id
      ELSE NEW.stock_entry_id
    END
      AND status = 'submitted'
  ) THEN
    RAISE EXCEPTION 'Submitted stock entry lines are immutable; create a reversal';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_submitted_stock_entry_line ON public.stock_entry_lines;
CREATE TRIGGER trg_protect_submitted_stock_entry_line
BEFORE UPDATE OR DELETE ON public.stock_entry_lines
FOR EACH ROW EXECUTE FUNCTION public.protect_submitted_stock_entry_line();
