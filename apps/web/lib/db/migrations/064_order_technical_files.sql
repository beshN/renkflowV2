-- Additive order files. Legacy orders retain their existing commercial/production history.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quotation_id uuid REFERENCES public.quotations(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS accepted_quotation_revision integer;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS provisional boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_quotation ON public.orders(tenant_id, quotation_id) WHERE quotation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.order_technical_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 order_id uuid NOT NULL REFERENCES public.orders(id), revision integer NOT NULL CHECK(revision > 0),
 family text NOT NULL CHECK(family IN ('makasli','pergola','wind-manual','wind-piston','giyotin','other')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','superseded','blocked')),
 source_name text NOT NULL, source_hash text NOT NULL, document jsonb NOT NULL,
 choices jsonb NOT NULL DEFAULT '{}', technical jsonb NOT NULL DEFAULT '{}', plan jsonb,
 created_by uuid NOT NULL REFERENCES public.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 approved_by uuid REFERENCES public.users(id), approved_at timestamptz,
 UNIQUE(tenant_id,order_id,revision), UNIQUE(tenant_id,order_id,source_hash)
);
CREATE UNIQUE INDEX IF NOT EXISTS order_technical_one_active ON public.order_technical_revisions(tenant_id,order_id) WHERE status='approved';
CREATE INDEX IF NOT EXISTS order_technical_order ON public.order_technical_revisions(tenant_id,order_id,revision DESC);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS technical_revision_id uuid REFERENCES public.order_technical_revisions(id);
CREATE INDEX IF NOT EXISTS work_orders_technical_revision ON public.work_orders(tenant_id,technical_revision_id);

CREATE TABLE IF NOT EXISTS public.product_drilling_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 family text NOT NULL, profile_code text NOT NULL, mechanism text NOT NULL,
 version integer NOT NULL CHECK(version>0), source text NOT NULL CHECK(length(source)>3),
 -- Explicit coordinates from a verified reference face/end, never inferred from a 3D mesh.
 rule jsonb NOT NULL, approved_by uuid NOT NULL REFERENCES public.users(id), approved_at timestamptz NOT NULL DEFAULT now(),
 active boolean NOT NULL DEFAULT true, UNIQUE(tenant_id,family,profile_code,mechanism,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS product_drilling_active ON public.product_drilling_rules(tenant_id,family,profile_code,mechanism) WHERE active;

CREATE TABLE IF NOT EXISTS public.production_parts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 work_order_id uuid NOT NULL REFERENCES public.work_orders(id), technical_revision_id uuid NOT NULL REFERENCES public.order_technical_revisions(id),
 cut_plan_id uuid NOT NULL REFERENCES public.cutting_plans(id), source_lot_id uuid NOT NULL REFERENCES public.stock_lots(id),
 item_id uuid NOT NULL REFERENCES public.inventory_items(id), length_mm numeric NOT NULL CHECK(length_mm>0),
 target_color text, state text NOT NULL DEFAULT 'planned' CHECK(state IN('planned','cut','paint_waiting','paint_sent','paint_returned','scrapped')),
 sequence integer NOT NULL, cut_at timestamptz, paint_sent_at timestamptz, paint_returned_at timestamptz,
 updated_by uuid REFERENCES public.users(id), UNIQUE(cut_plan_id,sequence)
);
CREATE INDEX IF NOT EXISTS production_parts_progress ON public.production_parts(tenant_id,work_order_id,state);
