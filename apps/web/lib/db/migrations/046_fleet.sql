-- Vehicle fleet (gece 2, Tur 3; docs/adr/0003-arac-filosu.md). Faz A: vehicles, documents,
-- maintenance, fuel, assignments. Faz B (infrastructure only): devices, positions, retention.
-- Only adds tables and indexes; no data is rewritten. Idempotent: every statement can run again.

CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plate text NOT NULL CHECK (plate ~ '^[0-9]{2}[A-Z]{1,3}[0-9]{2,4}$'),
  make text,
  model text,
  model_year integer CHECK (model_year IS NULL OR model_year BETWEEN 1950 AND 2100),
  vehicle_type text NOT NULL DEFAULT 'van' CHECK (vehicle_type IN ('van', 'truck', 'pickup', 'car', 'other')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'out_of_service', 'sold')),
  driver_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  odometer_km integer CHECK (odometer_km IS NULL OR odometer_km >= 0),
  notes text,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, plate)
);

CREATE TABLE IF NOT EXISTS public.vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('inspection', 'traffic_insurance', 'casco', 'registration', 'other')),
  number text,
  issued_on date,
  expires_on date,
  amount numeric(14,2) CHECK (amount IS NULL OR amount >= 0),
  -- The scanned document, kept as an attachment of the vehicle record (record platform).
  attachment_id uuid,
  notes text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_on IS NULL OR issued_on IS NULL OR expires_on >= issued_on)
);
CREATE INDEX IF NOT EXISTS vehicle_documents_vehicle_idx ON public.vehicle_documents (tenant_id, vehicle_id, kind, expires_on DESC);

CREATE TABLE IF NOT EXISTS public.vehicle_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  done_on date NOT NULL,
  km integer CHECK (km IS NULL OR km >= 0),
  amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 500),
  vendor text,
  next_due_on date,
  next_due_km integer CHECK (next_due_km IS NULL OR next_due_km >= 0),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_maintenance_vehicle_idx ON public.vehicle_maintenance (tenant_id, vehicle_id, done_on DESC);

CREATE TABLE IF NOT EXISTS public.vehicle_fuel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  filled_on date NOT NULL,
  liters numeric(10,2) NOT NULL CHECK (liters > 0),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  km integer CHECK (km IS NULL OR km >= 0),
  full_tank boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_fuel_vehicle_idx ON public.vehicle_fuel (tenant_id, vehicle_id, filled_on DESC);

-- A vehicle given to a job (an installation, a shipment, or anything else) for a time window.
CREATE TABLE IF NOT EXISTS public.vehicle_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('installation', 'shipment', 'other')),
  installation_id uuid,
  shipment_id uuid,
  title text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  driver_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS vehicle_assignments_window_idx ON public.vehicle_assignments (tenant_id, vehicle_id, starts_at);

-- Faz B: a tracking device; only the SHA-256 of its token is kept (the token is shown once).
CREATE TABLE IF NOT EXISTS public.vehicle_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 80),
  token_hash text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_devices_vehicle_idx ON public.vehicle_devices (tenant_id, vehicle_id);

CREATE TABLE IF NOT EXISTS public.vehicle_positions (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.vehicle_devices(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  speed_kmh real,
  heading real,
  ignition boolean,
  odometer_km integer,
  received_at timestamptz NOT NULL DEFAULT now(),
  -- The same point sent twice is kept once.
  UNIQUE (device_id, recorded_at)
);
CREATE INDEX IF NOT EXISTS vehicle_positions_time_idx ON public.vehicle_positions (tenant_id, vehicle_id, recorded_at DESC);

-- How long positions are kept: days, or NULL for "süresiz". Default 365 days.
CREATE TABLE IF NOT EXISTS public.fleet_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  position_retention_days integer DEFAULT 365 CHECK (position_retention_days IS NULL OR position_retention_days BETWEEN 7 AND 3650),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
