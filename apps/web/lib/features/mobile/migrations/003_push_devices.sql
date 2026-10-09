-- Provider tokens are private operational data; never returned in mobile DTOs or logs.
CREATE TABLE IF NOT EXISTS public.mobile_push_devices (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL,
  platform text NOT NULL CHECK(platform IN('android','ios')),
  provider_token text,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,user_id,device_id)
);
