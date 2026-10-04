-- Purchasing headers are versioned; physical profile specifications stay with each line.
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS expected_at date;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.purchase_order_lines ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_order_lines ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.goods_receipt_lines ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.goods_receipts ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.goods_receipts DROP CONSTRAINT IF EXISTS goods_receipts_status_check;
ALTER TABLE public.goods_receipts ADD CONSTRAINT goods_receipts_status_check CHECK(status IN('draft','submitted','reversed'));
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_procurement_receipt_po ON public.goods_receipts(tenant_id,purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_procurement_lines_po ON public.purchase_order_lines(tenant_id,purchase_order_id,position);
