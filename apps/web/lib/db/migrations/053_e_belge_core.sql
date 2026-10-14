-- e-Belge core (docs/superpowers/specs/2026-10-14-e-belge-design.md): the seller's legal identity,
-- GİB-format invoice numbering, document type and status, withholding (tevkifat) and exemption
-- (istisna) per line. Additive and idempotent; existing invoices are not rewritten (readers use
-- coalesce(payable_total, total) for invoices issued before this migration).

-- Seller identity printed on every invoice and required before an e-Belge can be issued.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tax_number text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tax_office text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address_line text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS mersis_no text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS trade_registry_no text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS invoice_email text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS iban text;
-- Series prefixes (three capital letters) for e-Fatura and e-Arşiv numbers.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS e_fatura_prefix text NOT NULL DEFAULT 'RNK';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS e_arsiv_prefix text NOT NULL DEFAULT 'RNA';
DO $$ BEGIN
  ALTER TABLE public.tenants ADD CONSTRAINT tenants_e_belge_prefix_check
    CHECK (e_fatura_prefix ~ '^[A-Z]{3}$' AND e_arsiv_prefix ~ '^[A-Z]{3}$' AND e_fatura_prefix <> e_arsiv_prefix);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Whether the customer is a registered e-Fatura user (cached answer of the provider's query) and
-- its mailbox label.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS e_invoice_registered boolean;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS e_invoice_alias text;

-- Gap-free number counter per firm, prefix and year (taken under a row lock when an invoice is issued).
CREATE TABLE IF NOT EXISTS public.invoice_number_series (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  prefix text NOT NULL CHECK (prefix ~ '^[A-Z]{3}$'),
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2999),
  last_number bigint NOT NULL DEFAULT 0 CHECK (last_number BETWEEN 0 AND 999999999),
  PRIMARY KEY (tenant_id, prefix, year)
);

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS document_type text CHECK (document_type IN ('e_fatura', 'e_arsiv'));
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS profile text CHECK (profile IN ('TEMELFATURA', 'TICARIFATURA', 'EARSIVFATURA'));
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_type_code text NOT NULL DEFAULT 'SATIS' CHECK (invoice_type_code IN ('SATIS', 'TEVKIFAT', 'ISTISNA', 'IADE'));
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS ettn uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS withholding_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (withholding_total >= 0);
-- What the buyer pays the seller: total minus the withheld VAT. NULL on invoices issued before 053.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payable_total numeric(14,2) CHECK (payable_total >= 0);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS exchange_rate numeric(14,6) CHECK (exchange_rate > 0);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS e_invoice_provider text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS e_invoice_provider_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS e_invoice_error text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS e_invoice_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS e_invoice_next_attempt_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS e_invoice_sent_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_ettn_uq ON public.invoices (ettn) WHERE ettn IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_e_invoice_queue_idx ON public.invoices (e_invoice_next_attempt_at) WHERE e_invoice_status IN ('queued', 'sent', 'error');

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_e_invoice_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_e_invoice_status_check
  CHECK (e_invoice_status IN ('not_connected', 'queued', 'sent', 'accepted', 'rejected', 'error', 'cancelled'));

ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS unit_code text NOT NULL DEFAULT 'C62';
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS withholding_code text;
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS withholding_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (withholding_percent BETWEEN 0 AND 100);
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS withholding_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (withholding_amount >= 0);
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS exemption_code text;
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS exemption_reason text;
DO $$ BEGIN
  ALTER TABLE public.invoice_lines ADD CONSTRAINT invoice_lines_withholding_check
    CHECK ((withholding_code IS NULL) = (withholding_percent = 0));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
