-- Inventory / Stock MVP
-- ADJUST movements are treated as DELTA values:
-- current_stock = sum(IN) - sum(OUT) + sum(ADJUST)

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sku text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'adet',
  min_stock numeric NOT NULL DEFAULT 0,
  location text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_items_tenant_sku_unique UNIQUE (tenant_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_id ON public.inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_active ON public.inventory_items(active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON public.inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON public.inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_name ON public.inventory_items(tenant_id, name);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUST')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  note text,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_id ON public.stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON public.stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order_id ON public.stock_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_item_created
  ON public.stock_movements(tenant_id, item_id, created_at DESC);

CREATE OR REPLACE VIEW public.inventory_item_stock_view AS
SELECT
  i.id AS item_id,
  i.tenant_id,
  COALESCE(
    SUM(
      CASE
        WHEN sm.type = 'IN' THEN sm.quantity
        WHEN sm.type = 'OUT' THEN -sm.quantity
        WHEN sm.type = 'ADJUST' THEN sm.quantity
        ELSE 0
      END
    ),
    0
  ) AS current_stock
FROM public.inventory_items i
LEFT JOIN public.stock_movements sm
  ON sm.item_id = i.id
  AND sm.tenant_id = i.tenant_id
GROUP BY i.id, i.tenant_id;
