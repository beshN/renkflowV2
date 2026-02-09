-- ============================================
-- Bank Reconciliation Tables
-- Statement import, matching and reconciliation governance
-- ============================================

-- 1) Statement lines imported from bank feed or manual upload
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual_import',
  external_id text,
  statement_date date NOT NULL,
  value_date date,
  description text NOT NULL,
  reference text,
  amount numeric(14,2) NOT NULL CHECK (amount <> 0),
  currency text NOT NULL DEFAULT 'TRY',
  reconciliation_status text NOT NULL DEFAULT 'unmatched'
    CHECK (reconciliation_status IN ('unmatched', 'matched', 'ignored')),
  matched_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  matched_expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  matched_at timestamp with time zone,
  note text,
  imported_by uuid REFERENCES public.users(id),
  imported_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT chk_bank_statement_single_match
    CHECK ((matched_payment_id IS NULL) OR (matched_expense_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_statement_external_line
  ON public.bank_statement_lines(tenant_id, account_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_statement_tenant_date
  ON public.bank_statement_lines(tenant_id, statement_date DESC);

CREATE INDEX IF NOT EXISTS idx_bank_statement_tenant_status
  ON public.bank_statement_lines(tenant_id, reconciliation_status, statement_date DESC);

CREATE INDEX IF NOT EXISTS idx_bank_statement_matched_payment
  ON public.bank_statement_lines(matched_payment_id)
  WHERE matched_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_statement_matched_expense
  ON public.bank_statement_lines(matched_expense_id)
  WHERE matched_expense_id IS NOT NULL;

-- 2) Period-level reconciliation status
CREATE TABLE IF NOT EXISTS public.bank_reconciliation_periods (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  period text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'reconciled')),
  statement_ending_balance numeric(14,2) DEFAULT 0 NOT NULL,
  books_ending_balance numeric(14,2) DEFAULT 0 NOT NULL,
  difference numeric(14,2) DEFAULT 0 NOT NULL,
  note text,
  reconciled_by uuid REFERENCES public.users(id),
  reconciled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_bank_reconciliation_tenant_period UNIQUE (tenant_id, period)
);

CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_periods_tenant_period
  ON public.bank_reconciliation_periods(tenant_id, period);

