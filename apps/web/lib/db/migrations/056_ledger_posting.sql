-- Automatic ledger entries: each one names the business record it books (invoice:<id>,
-- invoice-cancel:<id>, payment:<id>, payment-delete:<id>), so posting can run again and again
-- without booking anything twice.
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS source_key text;
CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_source_uq ON public.journal_entries (tenant_id, source_key) WHERE source_key IS NOT NULL;

-- An account with entries cannot be deleted, but deleting a whole firm (which cascades to its
-- accounts and its entries) must work. The check is deferred to commit: by then the cascade has
-- removed the entry lines too. (RESTRICT, and even NO ACTION, ran before the cascade reached them.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'journal_entry_lines_account_id_fkey' AND NOT condeferred
  ) THEN
    ALTER TABLE public.journal_entry_lines DROP CONSTRAINT journal_entry_lines_account_id_fkey;
    ALTER TABLE public.journal_entry_lines ADD CONSTRAINT journal_entry_lines_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;
