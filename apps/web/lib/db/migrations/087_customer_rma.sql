-- Customer RMA is separate from supplier returns. No inventory posting in this slice.
CREATE UNIQUE INDEX IF NOT EXISTS order_items_order_id_id ON public.order_items(order_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_id_id ON public.orders(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS service_tickets_tenant_id_id ON public.service_tickets(tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS work_orders_tenant_id_id ON public.work_orders(tenant_id,id);
CREATE TABLE IF NOT EXISTS public.customer_rmas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 return_number text NOT NULL, order_id uuid NOT NULL, service_ticket_id uuid,
 decision text NOT NULL DEFAULT 'pending' CHECK(decision IN ('pending','repair','replace','reject')),
 replacement_work_order_id uuid, replacement_approved_by uuid REFERENCES public.users(id), replacement_approved_at timestamptz,
 idempotency_key text NOT NULL, created_by uuid NOT NULL REFERENCES public.users(id), updated_by uuid NOT NULL REFERENCES public.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,return_number), UNIQUE(tenant_id,idempotency_key), UNIQUE(tenant_id,id,order_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES public.orders(tenant_id,id),
 FOREIGN KEY(tenant_id,service_ticket_id) REFERENCES public.service_tickets(tenant_id,id),
 FOREIGN KEY(tenant_id,replacement_work_order_id) REFERENCES public.work_orders(tenant_id,id),
 CHECK((decision='replace')=(replacement_work_order_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS public.customer_rma_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 rma_id uuid NOT NULL, order_id uuid NOT NULL, order_item_id uuid NOT NULL,
 quantity numeric(18,6) NOT NULL CHECK(quantity>0), uom text NOT NULL, reason text NOT NULL CHECK(length(trim(reason))>0),
 photo_attachment_id uuid REFERENCES public.record_attachments(id),
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL REFERENCES public.users(id),
 FOREIGN KEY(tenant_id,rma_id,order_id) REFERENCES public.customer_rmas(tenant_id,id,order_id),
 FOREIGN KEY(order_id,order_item_id) REFERENCES public.order_items(order_id,id),
 UNIQUE(tenant_id,rma_id,order_item_id)
);
CREATE INDEX IF NOT EXISTS customer_rma_lines_source ON public.customer_rma_lines(tenant_id,order_item_id);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS customer_rma_approval_pending boolean NOT NULL DEFAULT false CHECK (NOT customer_rma_approval_pending OR status IN ('blocked','cancelled'));
