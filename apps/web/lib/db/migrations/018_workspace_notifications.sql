CREATE TABLE IF NOT EXISTS public.notifications (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb,
  channels jsonb NOT NULL DEFAULT '["in_app"]'::jsonb,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON public.notifications(tenant_id,user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_unread ON public.notifications(tenant_id,user_id) WHERE read=false;
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email jsonb DEFAULT '{}'::jsonb,
  push jsonb DEFAULT '{}'::jsonb,
  in_app jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
