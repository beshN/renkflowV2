-- ============================================
-- Finance Module Tables Migration
-- ============================================
-- This migration adds tables for:
-- 1. Payments (order-linked revenue tracking)
-- 2. Order Documents (invoices, receipts, contracts)
-- 3. Employees (for payroll)
-- 4. Employee Ledger Entries (salary, advances, deductions)
-- ============================================

-- 1. Payments Table
-- Tracks payments received for orders
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text DEFAULT 'TRY' NOT NULL,
  method text NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'card', 'other')),
  paid_at timestamp with time zone NOT NULL DEFAULT NOW(),
  note text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON public.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at);

-- 2. Order Documents Table
-- Stores uploaded documents like invoices, receipts, contracts
CREATE TABLE IF NOT EXISTS public.order_documents (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('invoice', 'delivery_note', 'receipt', 'contract', 'other')),
  file_name text NOT NULL,
  file_url text NOT NULL,
  mime_type text,
  size_bytes integer,
  uploaded_by uuid REFERENCES public.users(id),
  uploaded_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for order_documents
CREATE INDEX IF NOT EXISTS idx_order_documents_tenant_id ON public.order_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_documents_order_id ON public.order_documents(order_id);
CREATE INDEX IF NOT EXISTS idx_order_documents_type ON public.order_documents(type);

-- 3. Employees Table
-- Stores employee information for payroll management
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  title text,
  email text,
  phone text,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for employees
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON public.employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON public.employees(active);

-- 4. Employee Ledger Entries Table
-- Tracks salary, advances, deductions, and payments for employees
-- kind values:
--   'salary'    - Monthly salary payment (expense)
--   'advance'   - Advance payment to employee (creates debt)
--   'deduction' - Deduction from salary (reduces debt)
--   'payment'   - Payment to employee (expense)
CREATE TABLE IF NOT EXISTS public.employee_ledger_entries (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  kind text NOT NULL CHECK (kind IN ('salary', 'advance', 'deduction', 'payment')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text DEFAULT 'TRY' NOT NULL,
  entry_date date NOT NULL,
  note text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for employee_ledger_entries
CREATE INDEX IF NOT EXISTS idx_employee_ledger_tenant_id ON public.employee_ledger_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_ledger_employee_id ON public.employee_ledger_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_ledger_entry_date ON public.employee_ledger_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_employee_ledger_kind ON public.employee_ledger_entries(kind);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on new tables
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_ledger_entries ENABLE ROW LEVEL SECURITY;

-- Payments RLS Policies
CREATE POLICY "Tenant members can view payments"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = payments.tenant_id
      AND tenant_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can insert payments"
  ON public.payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = payments.tenant_id
      AND tenant_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete payments"
  ON public.payments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = payments.tenant_id
      AND tenant_members.user_id = auth.uid()
      AND tenant_members.role IN ('owner', 'admin')
    )
  );

-- Order Documents RLS Policies
CREATE POLICY "Tenant members can view order documents"
  ON public.order_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = order_documents.tenant_id
      AND tenant_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant members can insert order documents"
  ON public.order_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = order_documents.tenant_id
      AND tenant_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete order documents"
  ON public.order_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = order_documents.tenant_id
      AND tenant_members.user_id = auth.uid()
      AND tenant_members.role IN ('owner', 'admin')
    )
  );

-- Employees RLS Policies
CREATE POLICY "Tenant members can view employees"
  ON public.employees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = employees.tenant_id
      AND tenant_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage employees"
  ON public.employees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = employees.tenant_id
      AND tenant_members.user_id = auth.uid()
      AND tenant_members.role IN ('owner', 'admin', 'accountant')
    )
  );

-- Employee Ledger Entries RLS Policies
CREATE POLICY "Tenant members can view ledger entries"
  ON public.employee_ledger_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = employee_ledger_entries.tenant_id
      AND tenant_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Finance roles can manage ledger entries"
  ON public.employee_ledger_entries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = employee_ledger_entries.tenant_id
      AND tenant_members.user_id = auth.uid()
      AND tenant_members.role IN ('owner', 'admin', 'accountant')
    )
  );

-- ============================================
-- Update tenant_members role constraint to include 'accountant'
-- ============================================
ALTER TABLE public.tenant_members 
  DROP CONSTRAINT IF EXISTS tenant_members_role_check;

ALTER TABLE public.tenant_members 
  ADD CONSTRAINT tenant_members_role_check 
  CHECK (role IN ('owner', 'admin', 'accountant', 'office', 'worker', 'member'));

-- Also update invitations table
ALTER TABLE public.invitations 
  DROP CONSTRAINT IF EXISTS invitations_role_check;

ALTER TABLE public.invitations 
  ADD CONSTRAINT invitations_role_check 
  CHECK (role IN ('admin', 'accountant', 'office', 'worker', 'member'));
