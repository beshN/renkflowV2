-- Faz 2 stock model. An item is a profile code + size + processed state (painted, unpainted, drilled,
-- ready-made are separate items); every physical bar (lot) carries its colour and length. Counted
-- pieces keep their piece length on the item. Units are explicit.
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS profile_code text;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS size_label text;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS processed_states text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS piece_length_mm integer;

DO $$ BEGIN
  ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_piece_length_positive CHECK (piece_length_mm IS NULL OR piece_length_mm > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_states_known
    CHECK (processed_states <@ ARRAY['boyali', 'boyasiz', 'hazir', 'delikli', 'galvanizli']::text[]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- NOT VALID: rows written before this migration are left as they are; every new or changed row is checked.
DO $$ BEGIN
  ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_stock_uom_known
    CHECK (stock_uom IN ('m', 'adet', 'takim', 'boy', 'kg', 'm2')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The same profile code, size, states and piece length is one item per firm.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_identity_idx ON public.inventory_items
  (tenant_id, lower(profile_code), lower(coalesce(size_label, '')), processed_states, coalesce(piece_length_mm, 0))
  WHERE profile_code IS NOT NULL;

-- Stock never goes below zero, also at the database (the posting service already checks it). A
-- trigger rather than a CHECK: a balance that is already negative from before may still be raised
-- towards zero by a receipt; only a decrease into negative stock is refused.
ALTER TABLE public.stock_balances DROP CONSTRAINT IF EXISTS stock_balances_not_negative;
CREATE OR REPLACE FUNCTION public.rf_stock_balance_not_negative() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.on_hand_qty < 0 AND (TG_OP = 'INSERT' OR NEW.on_hand_qty < OLD.on_hand_qty) THEN
    RAISE EXCEPTION 'stock_balances_not_negative: stok negatife düşemez (kalem %, depo %)', NEW.item_id, NEW.warehouse_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rf_stock_balance_not_negative ON public.stock_balances;
CREATE TRIGGER rf_stock_balance_not_negative BEFORE INSERT OR UPDATE OF on_hand_qty ON public.stock_balances
  FOR EACH ROW EXECUTE FUNCTION public.rf_stock_balance_not_negative();

-- Every movement says where it came from (order/work order, cutting plan, count, receipt, manual ...).
DO $$ BEGIN
  ALTER TABLE public.stock_entries ADD CONSTRAINT stock_entries_source_required CHECK (reference_type IS NOT NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
