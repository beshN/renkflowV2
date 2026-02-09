-- ============================================
-- Accounting Control Tower Tables
-- Budgeting, period close/lock, governance
-- ============================================

-- 1) Periodic accounting budgets
CREATE TABLE IF NOT EXISTS public.accounting_budgets (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  period text NOT NULL,
  planned_revenue numeric(14,2) NOT NULL DEFAULT 0 CHECK (planned_revenue >= 0),
  planned_cogs numeric(14,2) NOT NULL DEFAULT 0 CHECK (planned_cogs >= 0),
  planned_opex numeric(14,2) NOT NULL DEFAULT 0 CHECK (planned_opex >= 0),
  planned_tax numeric(14,2) NOT NULL DEFAULT 0 CHECK (planned_tax >= 0),
  planned_capex numeric(14,2) NOT NULL DEFAULT 0 CHECK (planned_capex >= 0),
  notes text[] DEFAULT ARRAY[]::text[],
  created_by uuid REFERENCES public.users(id),
  updated_by uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_accounting_budgets_tenant_period UNIQUE (tenant_id, period)
);

CREATE INDEX IF NOT EXISTS idx_accounting_budgets_tenant_period
  ON public.accounting_budgets(tenant_id, period);

-- 2) Period close / lock states
CREATE TABLE IF NOT EXISTS public.accounting_period_closes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  period text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'soft_closed', 'hard_closed')),
  closed_note text,
  checklist_snapshot jsonb DEFAULT '{}'::jsonb,
  closed_by uuid REFERENCES public.users(id),
  closed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_accounting_period_close_tenant_period UNIQUE (tenant_id, period)
);

CREATE INDEX IF NOT EXISTS idx_accounting_period_closes_tenant_period
  ON public.accounting_period_closes(tenant_id, period);

