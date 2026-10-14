-- Purchase invoices and expenses as the source of deductible VAT (indirilecek KDV): the rate and
-- the supplier's document number. `amount` is the amount before VAT, `tax_amount` the VAT on it.
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS vat_percent numeric(5,2) CHECK (vat_percent BETWEEN 0 AND 100);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS document_number text CHECK (length(document_number) <= 60);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_document ON public.expenses (tenant_id, vendor, document_number) WHERE document_number IS NOT NULL;
