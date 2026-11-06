-- Supplier returns only; no customer RMA or subcontract processing tables.
CREATE UNIQUE INDEX IF NOT EXISTS goods_receipt_lines_tenant_id_id ON public.goods_receipt_lines(tenant_id,id);
CREATE TABLE IF NOT EXISTS public.supplier_returns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 return_number text NOT NULL,
 supplier_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','closed')),
 idempotency_key text NOT NULL,
 stock_entry_id uuid REFERENCES public.stock_entries(id),
 created_by uuid NOT NULL REFERENCES public.users(id),
 updated_by uuid NOT NULL REFERENCES public.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz, closed_at timestamptz,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,return_number), UNIQUE(tenant_id,idempotency_key),
 FOREIGN KEY(tenant_id,supplier_id) REFERENCES public.suppliers(tenant_id,id),
 CHECK ((status='draft' AND stock_entry_id IS NULL AND sent_at IS NULL AND closed_at IS NULL)
 OR (status='sent' AND stock_entry_id IS NOT NULL AND sent_at IS NOT NULL AND closed_at IS NULL)
 OR (status='closed' AND stock_entry_id IS NOT NULL AND sent_at IS NOT NULL AND closed_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS public.supplier_return_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 supplier_return_id uuid NOT NULL, goods_receipt_line_id uuid NOT NULL,
 quantity numeric(18,6) NOT NULL CHECK(quantity>0), uom text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,supplier_return_id) REFERENCES public.supplier_returns(tenant_id,id),
 FOREIGN KEY(tenant_id,goods_receipt_line_id) REFERENCES public.goods_receipt_lines(tenant_id,id),
 UNIQUE(tenant_id,supplier_return_id,goods_receipt_line_id)
);
CREATE INDEX IF NOT EXISTS supplier_return_lines_source ON public.supplier_return_lines(tenant_id,goods_receipt_line_id);
CREATE INDEX IF NOT EXISTS supplier_returns_supplier ON public.supplier_returns(tenant_id,supplier_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS supplier_returns_stock_once ON public.stock_entries(tenant_id,reference_id)
 WHERE reference_type='supplier_return';
