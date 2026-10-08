-- Which recipes (by code, every version) build which configured product family, so a quote for a
-- pergola offers only the pergola recipes. Kept apart from production_recipes so recipes saved in
-- the recipe screen are untouched.
CREATE TABLE IF NOT EXISTS public.product_family_recipes (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipe_code text NOT NULL,
  family text NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, recipe_code)
);
CREATE INDEX IF NOT EXISTS product_family_recipes_family_idx ON public.product_family_recipes (tenant_id, family);
