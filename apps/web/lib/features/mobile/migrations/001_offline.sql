-- Mobile-only additive schema. Apply explicitly; no DDL is run by request handlers.
CREATE TABLE IF NOT EXISTS public.mobile_receipts (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  command_id uuid NOT NULL,
  request_hash text NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,user_id,command_id)
);
CREATE TABLE IF NOT EXISTS public.mobile_uploads (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  name text NOT NULL,
  size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 10485760),
  sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
  received_bytes integer NOT NULL DEFAULT 0,
  final_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,user_id,id)
);
CREATE TABLE IF NOT EXISTS public.mobile_upload_chunks (
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  upload_id uuid NOT NULL,
  byte_offset integer NOT NULL CHECK(byte_offset>=0),
  size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 262144),
  sha256 text NOT NULL,
  storage_key text NOT NULL,
  PRIMARY KEY(tenant_id,user_id,upload_id,byte_offset),
  FOREIGN KEY(tenant_id,user_id,upload_id) REFERENCES mobile_uploads(tenant_id,user_id,id) ON DELETE CASCADE
);
