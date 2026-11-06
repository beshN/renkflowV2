-- Additive only: historical lot identifiers remain NULL.
ALTER TABLE public.stock_lots
  ADD COLUMN IF NOT EXISTS supplier_lot_number text,
  ADD COLUMN IF NOT EXISTS heat_number text;
CREATE INDEX IF NOT EXISTS stock_lots_tenant_heat
  ON public.stock_lots (tenant_id, heat_number) WHERE heat_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_lots_tenant_supplier_lot
  ON public.stock_lots (tenant_id, supplier_lot_number) WHERE supplier_lot_number IS NOT NULL;
