ALTER TABLE public.stock_count_documents ADD COLUMN IF NOT EXISTS import_mode text NOT NULL DEFAULT 'opening' CHECK(import_mode IN('opening','technical'));
