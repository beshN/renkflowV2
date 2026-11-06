-- Composite keys enforce tenant boundaries even outside the command API.
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_tenant_id_id ON public.suppliers(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS production_parts_tenant_id_id ON public.production_parts(tenant_id,id);
CREATE TABLE IF NOT EXISTS public.paint_dispatches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 dispatch_number bigint NOT NULL CHECK(dispatch_number>0),
 supplier_id uuid NOT NULL,
 target_color text NOT NULL CHECK(length(trim(target_color))>0),
 sent_at timestamptz NOT NULL DEFAULT now(),
 expected_return_date date,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','partially_returned','closed')),
 note text, created_by uuid NOT NULL REFERENCES public.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,dispatch_number), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,supplier_id) REFERENCES public.suppliers(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.paint_dispatch_parts (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 dispatch_id uuid NOT NULL, part_id uuid NOT NULL,
 outcome text NOT NULL DEFAULT 'sent' CHECK(outcome IN ('sent','returned','rejected')),
 reject_reason text, returned_at timestamptz,
 PRIMARY KEY(tenant_id,dispatch_id,part_id),
 FOREIGN KEY(tenant_id,dispatch_id) REFERENCES public.paint_dispatches(tenant_id,id),
 FOREIGN KEY(tenant_id,part_id) REFERENCES public.production_parts(tenant_id,id),
 CHECK ((outcome='sent' AND returned_at IS NULL AND reject_reason IS NULL)
 OR (outcome='returned' AND returned_at IS NOT NULL AND reject_reason IS NULL)
 OR (outcome='rejected' AND returned_at IS NOT NULL AND length(trim(reject_reason))>0 AND reject_reason IS NOT NULL))
);
-- A pending outcome is the open membership; resolved rows retain their history.
CREATE UNIQUE INDEX IF NOT EXISTS paint_dispatch_parts_one_open ON public.paint_dispatch_parts(tenant_id,part_id) WHERE outcome='sent';
CREATE INDEX IF NOT EXISTS paint_dispatches_status ON public.paint_dispatches(tenant_id,status,sent_at);
