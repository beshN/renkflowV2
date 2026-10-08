-- A configured product on a quote line (and the order line made from it): the family, recipe and
-- measures chosen, the bill of materials the recipe gave, and where the price came from (the
-- firm's matrix, or typed by hand because the matrix did not price it).
ALTER TABLE public.quotation_items ADD COLUMN IF NOT EXISTS product_configuration jsonb;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_configuration jsonb;
