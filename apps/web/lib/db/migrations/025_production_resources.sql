CREATE TABLE IF NOT EXISTS public.production_resources (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 code text NOT NULL, name text NOT NULL, kind text NOT NULL CHECK(kind IN('machine','team','employee')),
 parallel_capacity integer NOT NULL CHECK(parallel_capacity BETWEEN 1 AND 100),
 shift_start text NOT NULL DEFAULT '08:00',shift_end text NOT NULL DEFAULT '17:00',
 work_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],maintenance jsonb NOT NULL DEFAULT '[]'::jsonb,
 user_id uuid REFERENCES public.users(id),member_ids uuid[] NOT NULL DEFAULT '{}',
 work_center_codes text[] NOT NULL DEFAULT '{}',
 revision integer NOT NULL DEFAULT 1,active boolean NOT NULL DEFAULT true,
 UNIQUE(tenant_id,code),CHECK((kind='employee')=(user_id IS NOT NULL)),CHECK(kind<>'employee' OR parallel_capacity=1)
);
ALTER TABLE public.production_resources ADD COLUMN IF NOT EXISTS work_center_codes text[] NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS production_employee_resource ON public.production_resources(tenant_id,user_id) WHERE user_id IS NOT NULL;
ALTER TABLE public.production_operations
 ADD COLUMN IF NOT EXISTS machine_id uuid REFERENCES public.production_resources(id),
 ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.production_resources(id);
ALTER TABLE public.work_centers
 ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS machine_required boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS team_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS material_ready_at timestamptz;
CREATE INDEX IF NOT EXISTS production_machine_running ON public.production_operations(tenant_id,machine_id) WHERE status='running';
CREATE INDEX IF NOT EXISTS production_employee_running ON public.production_operations(tenant_id,assigned_to) WHERE status='running';
