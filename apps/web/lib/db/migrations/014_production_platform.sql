-- Additive production platform; never reinterpret legacy height_mm.
ALTER TABLE public.order_items
 ADD COLUMN IF NOT EXISTS color text, ADD COLUMN IF NOT EXISTS width_mm numeric(18,3),
 ADD COLUMN IF NOT EXISTS height_mm numeric(18,3), ADD COLUMN IF NOT EXISTS projection_mm numeric(18,3),
 ADD COLUMN IF NOT EXISTS mounting_height_mm numeric(18,3), ADD COLUMN IF NOT EXISTS motor_type text,
 ADD COLUMN IF NOT EXISTS led_type text, ADD COLUMN IF NOT EXISTS fabric_type text, ADD COLUMN IF NOT EXISTS notes text,
 ADD COLUMN IF NOT EXISTS awning_configuration jsonb, ADD COLUMN IF NOT EXISTS awning_preview text;
ALTER TABLE public.quotation_items
 ADD COLUMN IF NOT EXISTS projection_mm numeric(18,3), ADD COLUMN IF NOT EXISTS mounting_height_mm numeric(18,3),
 ADD COLUMN IF NOT EXISTS awning_configuration jsonb, ADD COLUMN IF NOT EXISTS awning_preview text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id), ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending','new','pending_approval','approved','preparing_materials','ready_for_production','in_production','quality_check','ready','ready_for_shipment','shipped','delivered','completed','on_hold','cancelled'));
CREATE TABLE IF NOT EXISTS public.production_recipes (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 code text NOT NULL, name text NOT NULL, version integer NOT NULL CHECK(version>0),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published','archived')),
 finished_item_id uuid NOT NULL REFERENCES inventory_items(id), rules jsonb NOT NULL, operations jsonb NOT NULL,
 limits jsonb NOT NULL, examples jsonb NOT NULL DEFAULT '[]', created_by uuid REFERENCES users(id),
 published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,code,version)
);
ALTER TABLE public.work_orders
 ADD COLUMN IF NOT EXISTS order_item_id uuid REFERENCES order_items(id),
 ADD COLUMN IF NOT EXISTS recipe_id uuid REFERENCES production_recipes(id),
 ADD COLUMN IF NOT EXISTS configuration jsonb, ADD COLUMN IF NOT EXISTS bom_snapshot jsonb,
 ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS public.production_operations (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 work_order_id uuid NOT NULL REFERENCES work_orders(id), position integer NOT NULL, name text NOT NULL,
 work_center_code text NOT NULL, planned_minutes numeric NOT NULL CHECK(planned_minutes>0),
 status text NOT NULL DEFAULT 'waiting' CHECK(status IN('waiting','ready','running','paused','blocked','done','cancelled')),
 assigned_to uuid REFERENCES users(id), planned_qty numeric NOT NULL CHECK(planned_qty>0), completed_qty numeric NOT NULL DEFAULT 0 CHECK(completed_qty>=0),
 attempt integer NOT NULL DEFAULT 1, version integer NOT NULL DEFAULT 1,
 started_at timestamptz, active_since timestamptz, completed_at timestamptz,
 active_seconds numeric NOT NULL DEFAULT 0, ready_at timestamptz, reason text, photos jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(work_order_id,position), CHECK(completed_qty<=planned_qty)
);
CREATE INDEX IF NOT EXISTS production_operations_queue ON production_operations(tenant_id,status,work_center_code);
CREATE TABLE IF NOT EXISTS public.production_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
 work_order_id uuid REFERENCES work_orders(id), operation_id uuid REFERENCES production_operations(id),
 event_type text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', actor_id uuid REFERENCES users(id),
 command_id text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,command_id)
);
CREATE INDEX IF NOT EXISTS production_events_feed ON production_events(tenant_id,id);
CREATE TABLE IF NOT EXISTS public.production_rework (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 work_order_id uuid NOT NULL REFERENCES work_orders(id), from_operation_id uuid NOT NULL REFERENCES production_operations(id),
 target_operation_id uuid NOT NULL REFERENCES production_operations(id), reason_code text NOT NULL,
 reason text NOT NULL, affected_qty numeric NOT NULL CHECK(affected_qty>0),
 additional_materials jsonb NOT NULL DEFAULT '[]', photos jsonb NOT NULL DEFAULT '[]',
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cutting_plans (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','approved','completed','cancelled')),
 version integer NOT NULL DEFAULT 1, work_order_ids uuid[] NOT NULL,
 demand jsonb NOT NULL, parameters jsonb NOT NULL, result jsonb NOT NULL,
 actual jsonb, created_by uuid NOT NULL REFERENCES users(id), approved_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz, completed_at timestamptz,
 idempotency_key text NOT NULL, UNIQUE(tenant_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS public.cutting_plan_sources (
 tenant_id uuid NOT NULL REFERENCES tenants(id), plan_id uuid NOT NULL REFERENCES cutting_plans(id),
 lot_id uuid NOT NULL REFERENCES stock_lots(id), work_order_id uuid REFERENCES work_orders(id),
 consumed boolean NOT NULL DEFAULT false, PRIMARY KEY(plan_id,lot_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS cutting_sources_exclusive ON cutting_plan_sources(tenant_id,lot_id) WHERE consumed=false;
CREATE TABLE IF NOT EXISTS public.work_centers (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id), code text NOT NULL,
 name text NOT NULL, parallel_capacity integer NOT NULL DEFAULT 1 CHECK(parallel_capacity>0),
 shift_start text NOT NULL DEFAULT '08:00', shift_end text NOT NULL DEFAULT '17:00',
 work_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5], maintenance jsonb NOT NULL DEFAULT '[]', active boolean NOT NULL DEFAULT true,
 UNIQUE(tenant_id,code)
);
CREATE TABLE IF NOT EXISTS public.production_schedules (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published','superseded')),
 starts_at timestamptz NOT NULL, tasks jsonb NOT NULL, inputs jsonb NOT NULL, created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.customer_tracking_links (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id), order_id uuid NOT NULL REFERENCES orders(id),
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.notification_outbox (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id), order_id uuid REFERENCES orders(id),
 event_key text NOT NULL, channel text NOT NULL CHECK(channel IN('email','whatsapp')), recipient text NOT NULL,
 payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','sending','sent','delivered','failed','uncertain','suppressed')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), leased_at timestamptz,
 provider_id text, last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,event_key,channel,recipient)
);
CREATE INDEX IF NOT EXISTS notification_outbox_pending ON notification_outbox(status,next_attempt_at);
CREATE TABLE IF NOT EXISTS public.intake_drafts (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 source text NOT NULL CHECK(source IN('upload','email','whatsapp')), source_id text,
 status text NOT NULL DEFAULT 'needs_review' CHECK(status IN('needs_review','approved','rejected','failed')),
 extracted_data jsonb NOT NULL, documents jsonb NOT NULL DEFAULT '[]', warnings jsonb NOT NULL DEFAULT '[]',
 order_id uuid REFERENCES orders(id), created_by uuid REFERENCES users(id), reviewed_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz, UNIQUE(tenant_id,source,source_id)
);
CREATE TABLE IF NOT EXISTS public.inbound_messages (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 provider text NOT NULL, provider_message_id text NOT NULL, payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','review','failed')),
 draft_id uuid REFERENCES intake_drafts(id), attempts integer NOT NULL DEFAULT 0,
 last_error text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,provider_message_id)
);
CREATE TABLE IF NOT EXISTS public.manufacturing_preferences (
 tenant_id uuid PRIMARY KEY REFERENCES tenants(id), kerf_mm numeric NOT NULL DEFAULT 3 CHECK(kerf_mm>=0),
 trim_start_mm numeric NOT NULL DEFAULT 0 CHECK(trim_start_mm>=0), trim_end_mm numeric NOT NULL DEFAULT 0 CHECK(trim_end_mm>=0),
 minimum_remnant_mm numeric NOT NULL DEFAULT 500 CHECK(minimum_remnant_mm>=0),
 email_enabled boolean NOT NULL DEFAULT false, whatsapp_enabled boolean NOT NULL DEFAULT false,
 whatsapp_template text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.production_commands (
 tenant_id uuid NOT NULL REFERENCES tenants(id), command_id text NOT NULL, actor_id uuid NOT NULL REFERENCES users(id),
 request_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,command_id)
);
CREATE TABLE IF NOT EXISTS public.cutting_losses (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 plan_id uuid NOT NULL REFERENCES cutting_plans(id), lot_id uuid NOT NULL REFERENCES stock_lots(id),
 length_mm numeric NOT NULL CHECK(length_mm>=0), weight_kg numeric NOT NULL CHECK(weight_kg>=0), cost numeric NOT NULL CHECK(cost>=0),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.manufacturing_preferences ADD COLUMN IF NOT EXISTS cutting_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE public.production_rework ADD COLUMN IF NOT EXISTS snapshot jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS public.production_shipments (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 order_id uuid NOT NULL REFERENCES orders(id), work_order_id uuid NOT NULL REFERENCES work_orders(id),
 quantity numeric NOT NULL CHECK(quantity>0), carrier text, tracking_number text,
 stock_entry_id uuid NOT NULL REFERENCES stock_entries(id), created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS cut_plan_id uuid REFERENCES cutting_plans(id);
CREATE TABLE IF NOT EXISTS public.production_files (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 work_order_id uuid REFERENCES work_orders(id), created_by uuid NOT NULL REFERENCES users(id),
 name text NOT NULL, mime text NOT NULL, body bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inbound_messages ADD COLUMN IF NOT EXISTS processing_at timestamptz;
CREATE TABLE IF NOT EXISTS public.production_units (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 work_order_id uuid NOT NULL REFERENCES work_orders(id), serial integer NOT NULL CHECK(serial>0),
 production_run_id uuid NOT NULL REFERENCES production_runs(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(work_order_id,serial)
);
CREATE TABLE IF NOT EXISTS public.notification_attempts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, notification_id uuid NOT NULL REFERENCES notification_outbox(id),
 attempt integer NOT NULL, status text NOT NULL CHECK(status IN('sent','failed','uncertain')),
 provider_id text, error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.notification_delivery_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, provider text NOT NULL, event_id text NOT NULL,
 provider_message_id text NOT NULL, status text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider,event_id)
);
ALTER TABLE public.production_shipments
 ADD COLUMN IF NOT EXISTS erp_shipment_id uuid REFERENCES shipments(id),
 ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'shipped' CHECK(status IN('shipped','delivered')),
 ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE public.intake_drafts ADD COLUMN IF NOT EXISTS source_text text;

ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS creation_key uuid;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS creation_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS quotations_creation_key ON public.quotations(tenant_id,creation_key) WHERE creation_key IS NOT NULL;

ALTER TABLE public.production_rework
 ADD COLUMN IF NOT EXISTS profile_cuts jsonb NOT NULL DEFAULT '[]',
 ADD COLUMN IF NOT EXISTS profile_status text NOT NULL DEFAULT 'none' CHECK(profile_status IN('none','pending','approved','completed')),
 ADD COLUMN IF NOT EXISTS cut_plan_id uuid REFERENCES cutting_plans(id),
 ADD COLUMN IF NOT EXISTS profile_cost numeric NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS profile_scrap_kg numeric NOT NULL DEFAULT 0;
ALTER TABLE public.cutting_plans ADD COLUMN IF NOT EXISTS rework_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.inbound_messages ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS inbound_messages_pending ON public.inbound_messages(status,next_attempt_at);
