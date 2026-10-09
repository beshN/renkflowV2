-- Finance foundation (gece 2, Tur 4): invoices drafted from orders (partial allowed) and collection
-- details on the existing payments. Only adds tables, indexes and nullable columns; no data is
-- rewritten. Idempotent: every statement can run again. No e-invoice integration: every invoice
-- carries e_invoice_status = 'not_connected' and nothing is sent to GİB.

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- The firm's own number, given when the invoice is issued (a draft has none).
  invoice_number text,
  -- NO ACTION (checked at the end of the statement): an order with invoices cannot be deleted on its
  -- own, yet deleting a whole firm (which cascades to both) still works.
  order_id uuid NOT NULL REFERENCES public.orders(id),
  -- The customer as it was on the invoice (the card can change later).
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_tax_number text,
  customer_tax_office text,
  customer_address text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'cancelled')),
  issued_on date,
  due_on date,
  currency text NOT NULL DEFAULT 'TRY',
  subtotal numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  vat_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (vat_total >= 0),
  total numeric(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes text,
  e_invoice_status text NOT NULL DEFAULT 'not_connected' CHECK (e_invoice_status IN ('not_connected')),
  cancel_reason text,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  issued_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  issued_at timestamptz,
  cancelled_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'draft' OR (invoice_number IS NOT NULL AND issued_on IS NOT NULL AND due_on IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_uq ON public.invoices (tenant_id, invoice_number) WHERE invoice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_order_idx ON public.invoices (tenant_id, order_id);
CREATE INDEX IF NOT EXISTS invoices_open_idx ON public.invoices (tenant_id, status, due_on);
CREATE INDEX IF NOT EXISTS invoices_customer_idx ON public.invoices (tenant_id, customer_id);

CREATE TABLE IF NOT EXISTS public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  -- The order line this invoices (part of); NULL for a free line such as shipping.
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0,
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 300),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(14,4) NOT NULL CHECK (unit_price >= 0),
  vat_percent numeric(5,2) NOT NULL DEFAULT 20 CHECK (vat_percent BETWEEN 0 AND 100),
  net_amount numeric(14,2) NOT NULL,
  vat_amount numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_lines_invoice_idx ON public.invoice_lines (invoice_id, position);
CREATE INDEX IF NOT EXISTS invoice_lines_item_idx ON public.invoice_lines (tenant_id, order_item_id);

-- Collection details on the existing payments (still tied to an order).
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS cheque_due_on date;
CREATE INDEX IF NOT EXISTS payments_tenant_order_idx ON public.payments (tenant_id, order_id);
