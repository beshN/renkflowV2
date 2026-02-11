-- ============================================
-- Work Orders and Operational Execution Tables
-- Factory / office maintenance and workflow execution core
-- ============================================

CREATE TABLE IF NOT EXISTS public.work_orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'blocked', 'done', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  location text,
  asset_tag text,
  due_at timestamp with time zone,
  completed_at timestamp with time zone,
  estimated_minutes integer CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
  actual_minutes integer CHECK (actual_minutes IS NULL OR actual_minutes >= 0),
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'recurring', 'imported', 'integration')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_status
  ON public.work_orders(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_priority
  ON public.work_orders(tenant_id, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_due
  ON public.work_orders(tenant_id, due_at);

CREATE INDEX IF NOT EXISTS idx_work_orders_assigned
  ON public.work_orders(tenant_id, assigned_to);

CREATE TABLE IF NOT EXISTS public.work_order_checklist_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  required boolean DEFAULT true NOT NULL,
  completed boolean DEFAULT false NOT NULL,
  completed_at timestamp with time zone,
  completed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  position integer DEFAULT 0 NOT NULL CHECK (position >= 0),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_order_checklist_order
  ON public.work_order_checklist_items(work_order_id, position);

CREATE INDEX IF NOT EXISTS idx_work_order_checklist_tenant
  ON public.work_order_checklist_items(tenant_id, work_order_id);

CREATE TABLE IF NOT EXISTS public.work_order_comments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_order_comments_order
  ON public.work_order_comments(work_order_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.work_order_events (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_order_events_order
  ON public.work_order_events(work_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_order_events_tenant
  ON public.work_order_events(tenant_id, created_at DESC);
