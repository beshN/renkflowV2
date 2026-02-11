-- ============================================
-- Operational Backbone Improvements
-- - Onboarding activation tracking
-- - Support ticket persistence
-- - Work order block root-cause capture
-- ============================================

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS blocked_reason_category text,
  ADD COLUMN IF NOT EXISTS blocked_reason_detail text,
  ADD COLUMN IF NOT EXISTS blocked_at timestamp with time zone;

ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_blocked_reason_category_check;

ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_blocked_reason_category_check
  CHECK (
    blocked_reason_category IS NULL
    OR blocked_reason_category IN ('material', 'machine', 'planning', 'manpower', 'quality', 'other')
  );

CREATE TABLE IF NOT EXISTS public.onboarding_sessions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL UNIQUE,
  started_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  started_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  activated_at timestamp with time zone,
  last_step_key text,
  progress_percent integer DEFAULT 0 NOT NULL CHECK (progress_percent >= 0 AND progress_percent <= 100),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_tenant
  ON public.onboarding_sessions(tenant_id);

CREATE TABLE IF NOT EXISTS public.onboarding_steps (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  step_key text NOT NULL,
  completed boolean DEFAULT true NOT NULL,
  completed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (tenant_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_tenant
  ON public.onboarding_steps(tenant_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  source text DEFAULT 'contact_form' NOT NULL,
  status text DEFAULT 'open' NOT NULL
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text DEFAULT 'medium' NOT NULL
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  page_path text,
  locale text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_status
  ON public.support_tickets(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_email
  ON public.support_tickets(email, created_at DESC);
