-- Personnel (personel): the employee card gains employment and pay details, a day-by-day attendance
-- sheet (puantaj) is added, and personnel ledger entries can be bonuses and can name the month's pay
-- they belong to. Only adds columns, tables, indexes and a wider kind check; nothing is rewritten.
-- Idempotent: every statement can run again.
--
-- Pay is the agreed net monthly (or daily) amount the firm pays; this is not a legal payroll
-- (bordro): SGK, income tax and stamp duty are computed by the firm's accountant, not here.

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pay_type text NOT NULL DEFAULT 'monthly';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pay_amount numeric(12,2);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pay_currency text NOT NULL DEFAULT 'TRY';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pay_day smallint;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS iban text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS notes text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_pay_type_check') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_pay_type_check CHECK (pay_type IN ('monthly', 'daily'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_pay_amount_check') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_pay_amount_check CHECK (pay_amount IS NULL OR pay_amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_pay_day_check') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_pay_day_check CHECK (pay_day IS NULL OR pay_day BETWEEN 1 AND 31);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_dates_check') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_dates_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);
  END IF;
END $$;

-- Ledger: bonus (prim) joins salary payment / advance / deduction / other payment; "period" is the
-- month's pay the entry belongs to (an advance given on the 28th for next month's pay).
ALTER TABLE public.employee_ledger_entries ADD COLUMN IF NOT EXISTS period text;
ALTER TABLE public.employee_ledger_entries DROP CONSTRAINT IF EXISTS employee_ledger_entries_kind_check;
ALTER TABLE public.employee_ledger_entries ADD CONSTRAINT employee_ledger_entries_kind_check CHECK (kind IN ('salary', 'advance', 'deduction', 'payment', 'bonus'));
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_ledger_entries_period_check') THEN
    ALTER TABLE public.employee_ledger_entries ADD CONSTRAINT employee_ledger_entries_period_check CHECK (period IS NULL OR period ~ '^\d{4}-(0[1-9]|1[0-2])$');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_employee_ledger_period ON public.employee_ledger_entries (tenant_id, employee_id, period);

-- Attendance (puantaj): one row per person per day that was not a normal working day.
CREATE TABLE IF NOT EXISTS public.employee_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('absent', 'half_day', 'sick', 'paid_leave', 'unpaid_leave', 'annual_leave')),
  -- Whether the day is cut from pay; defaults by kind, the firm can change it per day.
  deducted boolean NOT NULL,
  note text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, employee_id, day)
);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_month ON public.employee_attendance (tenant_id, day);
