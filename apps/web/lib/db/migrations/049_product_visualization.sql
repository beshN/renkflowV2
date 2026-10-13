-- Visual presentation is separate from product_configuration (published recipe, BOM and price).
-- Old schemas keep working: writes with a visual attachment require this migration explicitly.
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_visualization jsonb;
ALTER TABLE public.quotation_items ADD COLUMN IF NOT EXISTS product_visualization jsonb;
