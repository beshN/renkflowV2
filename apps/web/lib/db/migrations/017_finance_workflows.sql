ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
-- The UI has always offered credit cards and cheques; retain legacy card records too.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check CHECK(method IN('cash','bank_transfer','card','credit_card','check','other'));
