-- ============================================
-- Accounting Journal (General Ledger) Tables
-- Enterprise-grade yevmiye ve büyük defter altyapısı
-- ============================================

-- 1) Journal entries (header)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  entry_number text NOT NULL,
  entry_date timestamp with time zone NOT NULL,
  type text NOT NULL CHECK (type IN ('invoice', 'payment', 'expense', 'salary', 'adjustment', 'opening', 'closing', 'transfer')),
  description text NOT NULL,
  total_debit numeric(12,2) NOT NULL DEFAULT 0,
  total_credit numeric(12,2) NOT NULL DEFAULT 0,
  attachments text[],
  period text NOT NULL,
  created_by uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT chk_journal_totals_nonnegative CHECK (total_debit >= 0 AND total_credit >= 0),
  CONSTRAINT chk_journal_balanced CHECK (abs(total_debit - total_credit) < 0.01),
  CONSTRAINT uq_journal_entry_number UNIQUE (tenant_id, entry_number)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_period ON public.journal_entries(tenant_id, period);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_date ON public.journal_entries(tenant_id, entry_date DESC);

-- 2) Journal entry lines (detail)
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE CASCADE NOT NULL,
  line_no integer NOT NULL CHECK (line_no > 0),
  account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT NOT NULL,
  debit numeric(12,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(12,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  invoice_id uuid,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT chk_journal_line_non_zero CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
  CONSTRAINT uq_journal_line UNIQUE (journal_entry_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_entry_lines(account_id);

