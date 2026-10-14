-- Additive only: old attendance keeps its original one-day calculation until deliberately edited.
CREATE TABLE IF NOT EXISTS public.personnel_attendance_settings (
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 rules jsonb NOT NULL CHECK (jsonb_typeof(rules) = 'object'),
 updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_attendance ADD COLUMN IF NOT EXISTS deduction_snapshot jsonb;

ALTER TABLE public.employee_ledger_entries ADD COLUMN IF NOT EXISTS payroll_snapshot jsonb;
ALTER TABLE public.employee_ledger_entries ADD COLUMN IF NOT EXISTS command_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS employee_ledger_command_key ON public.employee_ledger_entries(tenant_id, command_id) WHERE command_id IS NOT NULL;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='attendance_snapshot_object') THEN
  ALTER TABLE public.employee_attendance ADD CONSTRAINT attendance_snapshot_object CHECK(deduction_snapshot IS NULL OR jsonb_typeof(deduction_snapshot)='object') NOT VALID;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payroll_snapshot_object') THEN
  ALTER TABLE public.employee_ledger_entries ADD CONSTRAINT payroll_snapshot_object CHECK(payroll_snapshot IS NULL OR jsonb_typeof(payroll_snapshot)='object') NOT VALID;
 END IF;
END $$;
