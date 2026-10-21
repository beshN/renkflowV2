CREATE TABLE IF NOT EXISTS public.station_devices (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,
 kind text NOT NULL CHECK(kind IN('warehouse','cutting','assembly','packing')),
 checklist_labels jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(checklist_labels)='array'),work_center_code text,warehouse_id uuid REFERENCES warehouses(id),instruction_ids uuid[] NOT NULL DEFAULT '{}',
 version integer NOT NULL DEFAULT 1,created_by uuid NOT NULL REFERENCES users(id),
 token_hash text UNIQUE,pairing_hash text UNIQUE,pairing_expires_at timestamptz,expires_at timestamptz,revoked_at timestamptz,
 last_seen_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,work_center_code) REFERENCES work_centers(tenant_id,code),
 CHECK((kind='warehouse' AND warehouse_id IS NOT NULL AND work_center_code IS NULL) OR (kind<>'warehouse' AND work_center_code IS NOT NULL AND warehouse_id IS NULL))
);
CREATE INDEX IF NOT EXISTS station_devices_company ON station_devices(tenant_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.station_checklist_checks (
 tenant_id uuid NOT NULL REFERENCES tenants(id),operation_id uuid NOT NULL REFERENCES production_operations(id),
 check_key text NOT NULL,checked boolean NOT NULL,device_id uuid NOT NULL,
 version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,operation_id,check_key),FOREIGN KEY(tenant_id,device_id) REFERENCES station_devices(tenant_id,id)
);
