CREATE TABLE IF NOT EXISTS public.workspace_views (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, resource text NOT NULL CHECK(resource='orders'),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 80), filters jsonb NOT NULL CHECK(jsonb_typeof(filters)='object'),
 pinned boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_views_unique_name ON workspace_views(tenant_id,user_id,resource,lower(name));
CREATE INDEX IF NOT EXISTS workspace_views_owner ON workspace_views(tenant_id,user_id,resource,pinned,updated_at DESC);
CREATE TABLE IF NOT EXISTS public.workspace_view_commands (
 tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 command_id uuid NOT NULL, request_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,user_id,command_id)
);
-- No order FK: cleanup tasks survive the committed order deletion.
CREATE TABLE IF NOT EXISTS public.storage_cleanup_queue (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),tenant_id uuid NOT NULL REFERENCES tenants(id),order_id uuid NOT NULL,
 file_path text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','done','failed')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), lease_id uuid,
 lease_expires_at timestamptz,last_error text,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
 UNIQUE(tenant_id,file_path)
);
CREATE INDEX IF NOT EXISTS storage_cleanup_pending ON storage_cleanup_queue(next_attempt_at) WHERE status IN('pending','processing');
CREATE TABLE IF NOT EXISTS public.order_transition_commands (
 tenant_id uuid NOT NULL REFERENCES tenants(id), command_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES users(id),
 order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT, request_hash text NOT NULL,result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,command_id)
);
