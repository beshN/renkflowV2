-- Inventory stock cache for fast queries
-- Keeps current_stock per item updated on each stock_movement insert.
-- Semantics: current_stock = sum(IN) - sum(OUT) + sum(ADJUST) (ADJUST is delta).

CREATE TABLE IF NOT EXISTS public.inventory_item_stocks (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  current_stock numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_item_stocks_tenant_id
  ON public.inventory_item_stocks(tenant_id);

CREATE INDEX IF NOT EXISTS idx_inventory_item_stocks_updated_at
  ON public.inventory_item_stocks(updated_at DESC);

-- Backfill for existing items
INSERT INTO public.inventory_item_stocks (tenant_id, item_id, current_stock, updated_at)
SELECT
  i.tenant_id,
  i.id as item_id,
  COALESCE(v.current_stock, 0) as current_stock,
  now() as updated_at
FROM public.inventory_items i
LEFT JOIN public.inventory_item_stock_view v
  ON v.item_id = i.id
  AND v.tenant_id = i.tenant_id
ON CONFLICT (tenant_id, item_id) DO NOTHING;

-- Ensure new inventory items get a stock row
CREATE OR REPLACE FUNCTION public.ensure_inventory_item_stock_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.inventory_item_stocks (tenant_id, item_id, current_stock, updated_at)
  VALUES (NEW.tenant_id, NEW.id, 0, now())
  ON CONFLICT (tenant_id, item_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_items_ensure_stock_row ON public.inventory_items;
CREATE TRIGGER trg_inventory_items_ensure_stock_row
AFTER INSERT ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.ensure_inventory_item_stock_row();

-- Update stock cache on movement insert
CREATE OR REPLACE FUNCTION public.apply_stock_movement_to_cache()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  delta numeric;
BEGIN
  IF NEW.type = 'IN' THEN
    delta := NEW.quantity;
  ELSIF NEW.type = 'OUT' THEN
    delta := -NEW.quantity;
  ELSIF NEW.type = 'ADJUST' THEN
    delta := NEW.quantity;
  ELSE
    delta := 0;
  END IF;

  INSERT INTO public.inventory_item_stocks (tenant_id, item_id, current_stock, updated_at)
  VALUES (NEW.tenant_id, NEW.item_id, delta, now())
  ON CONFLICT (tenant_id, item_id)
  DO UPDATE SET
    current_stock = public.inventory_item_stocks.current_stock + EXCLUDED.current_stock,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_movements_apply_cache ON public.stock_movements;
CREATE TRIGGER trg_stock_movements_apply_cache
AFTER INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.apply_stock_movement_to_cache();

