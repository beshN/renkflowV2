ALTER TABLE public.production_files ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES public.purchase_orders(id);
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id);
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.work_orders(id);
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id);
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS command_id uuid;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS request_hash text;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.material_requests DROP CONSTRAINT IF EXISTS material_requests_status_check;
ALTER TABLE public.material_requests ADD CONSTRAINT material_requests_status_check CHECK(status IN('draft','submitted','approved','ordered','closed','cancelled'));
CREATE UNIQUE INDEX IF NOT EXISTS material_requests_command ON public.material_requests(tenant_id,command_id) WHERE command_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS material_requests_order ON public.material_requests(tenant_id,order_id,status);
ALTER TABLE public.purchase_order_lines ADD COLUMN IF NOT EXISTS material_request_line_id uuid REFERENCES public.material_request_lines(id);

CREATE TABLE IF NOT EXISTS public.receiving_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 file_id uuid NOT NULL REFERENCES public.production_files(id),sha256 text NOT NULL,
 extracted jsonb NOT NULL DEFAULT '[]',created_by uuid NOT NULL REFERENCES public.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,sha256)
);
CREATE TABLE IF NOT EXISTS public.receiving_inspections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id),document_id uuid REFERENCES public.receiving_documents(id),
 status text NOT NULL DEFAULT 'checked' CHECK(status IN('checked','accepted','rejected')),
 checklist jsonb NOT NULL,photos jsonb NOT NULL DEFAULT '[]',notes text NOT NULL DEFAULT '',
 checked_by uuid NOT NULL REFERENCES public.users(id),checked_at timestamptz NOT NULL DEFAULT now(),
 approved_by uuid REFERENCES public.users(id),approved_at timestamptz,receipt_id uuid REFERENCES public.goods_receipts(id),
 version integer NOT NULL DEFAULT 1,command_id uuid NOT NULL,request_hash text NOT NULL,
 UNIQUE(tenant_id,command_id)
);
CREATE INDEX IF NOT EXISTS receiving_inspections_queue ON public.receiving_inspections(tenant_id,status,checked_at);
ALTER TABLE public.goods_receipts ADD COLUMN IF NOT EXISTS inspection_id uuid REFERENCES public.receiving_inspections(id);
CREATE UNIQUE INDEX IF NOT EXISTS goods_receipts_inspection ON public.goods_receipts(tenant_id,inspection_id) WHERE inspection_id IS NOT NULL;
