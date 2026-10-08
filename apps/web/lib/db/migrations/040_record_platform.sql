-- Record platform (Tur A): one chatter, tags, checklist, planned activities, followers and
-- simple rules for every main record (order, quotation, customer, work order, stock item, supplier).
-- Records are addressed by (entity_type, entity_id); the audit trail stays in activity_logs.
-- Idempotent: every statement can run again.

CREATE TABLE IF NOT EXISTS public.record_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  mentions uuid[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS record_comments_entity_idx ON public.record_comments (tenant_id, entity_type, entity_id, created_at);

CREATE TABLE IF NOT EXISTS public.record_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  comment_id uuid REFERENCES public.record_comments(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  storage_key text NOT NULL,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS record_attachments_entity_idx ON public.record_attachments (tenant_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS public.record_followers (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, entity_type, entity_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.record_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
  name_key text NOT NULL,
  color text NOT NULL DEFAULT 'slate',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name_key)
);

CREATE TABLE IF NOT EXISTS public.record_tag_links (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.record_tags(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  PRIMARY KEY (tag_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS record_tag_links_entity_idx ON public.record_tag_links (tenant_id, entity_type, entity_id);

-- Owner and due date for records that have none of their own (orders keep delivery_date).
CREATE TABLE IF NOT EXISTS public.record_meta (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  assignee_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  due_on date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS public.record_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  position integer NOT NULL DEFAULT 0,
  done_at timestamptz,
  done_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS record_checklist_entity_idx ON public.record_checklist_items (tenant_id, entity_type, entity_id, position);

CREATE TABLE IF NOT EXISTS public.record_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('call', 'email', 'measure', 'delivery', 'production', 'feedback', 'todo')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  due_on date NOT NULL,
  assignee_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  done_at timestamptz,
  done_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  rule_key text,
  -- The day the assignee was last reminded (one reminder a day while it is due).
  notified_on date,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS record_activities_due_idx ON public.record_activities (tenant_id, done_at, due_on);
CREATE INDEX IF NOT EXISTS record_activities_entity_idx ON public.record_activities (tenant_id, entity_type, entity_id);

-- Rules: on/off per firm (code defines what each rule does), and one run per rule and record.
CREATE TABLE IF NOT EXISTS public.record_rules (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, rule_key)
);
CREATE TABLE IF NOT EXISTS public.record_rule_runs (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, rule_key, entity_type, entity_id)
);
