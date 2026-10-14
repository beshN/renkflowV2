-- Freeze the unsigned document and its recipient when issued. Historical sent documents cannot
-- be reconstructed faithfully from the current company card, so deliberately do not backfill.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS e_invoice_xml text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS e_invoice_recipient_alias text;
