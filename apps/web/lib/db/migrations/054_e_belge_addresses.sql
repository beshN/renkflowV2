-- e-Belge needs the buyer's city (and district) as separate fields; the invoice keeps a copy as it
-- was when drafted, so a later edit of the customer card does not change an issued invoice.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_city text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_district text;
