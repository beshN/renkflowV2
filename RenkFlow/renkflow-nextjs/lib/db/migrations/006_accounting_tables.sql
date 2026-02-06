-- ============================================
-- Accounting Core Tables Migration
-- Adds minimal tables required by accounting.actions.ts
-- ============================================

-- 1) Accounts (Chart of Accounts)
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  is_bank_account boolean DEFAULT false NOT NULL,
  bank_name text,
  bank_account_number text,
  currency text DEFAULT 'TRY' NOT NULL,
  opening_balance numeric(12,2) DEFAULT 0 NOT NULL,
  current_balance numeric(12,2) DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON public.accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON public.accounts(tenant_id, type);

-- 2) Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text DEFAULT 'TRY' NOT NULL,
  date date NOT NULL,
  receipt_url text,
  vendor text,
  is_recurring boolean DEFAULT false NOT NULL,
  recurring_interval text,
  is_tax_deductible boolean DEFAULT true NOT NULL,
  tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
  created_by uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date ON public.expenses(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_category ON public.expenses(tenant_id, category);

-- 3) Tax Transactions (KDV/Stopaj summary support)
CREATE TABLE IF NOT EXISTS public.tax_transactions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  tax_type text NOT NULL CHECK (tax_type IN ('vat', 'withholding', 'corporate', 'income', 'stamp')),
  type text NOT NULL CHECK (type IN ('input', 'output')),
  rate numeric(6,2) DEFAULT 0 NOT NULL,
  base_amount numeric(12,2) DEFAULT 0 NOT NULL,
  tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
  total_amount numeric(12,2) DEFAULT 0 NOT NULL,
  description text NOT NULL,
  related_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  related_invoice_id uuid,
  period text NOT NULL,
  is_declared boolean DEFAULT false NOT NULL,
  declaration_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tax_transactions_tenant_period ON public.tax_transactions(tenant_id, period);
CREATE INDEX IF NOT EXISTS idx_tax_transactions_tenant_type ON public.tax_transactions(tenant_id, tax_type);

-- 4) Fixed Assets (for depreciation)
CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  category text,
  acquisition_date date NOT NULL,
  cost numeric(12,2) NOT NULL CHECK (cost >= 0),
  residual_value numeric(12,2) DEFAULT 0 NOT NULL,
  useful_life_months integer NOT NULL CHECK (useful_life_months > 0),
  method text DEFAULT 'straight_line' NOT NULL,
  disposed_date date,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_tenant ON public.fixed_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_tenant_active ON public.fixed_assets(tenant_id, is_active);
