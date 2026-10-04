-- Shelf balances mirror the existing ledger, including manufacturing and procurement.
CREATE TABLE IF NOT EXISTS warehouse_locations (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 warehouse_id uuid NOT NULL REFERENCES warehouses(id), code text NOT NULL, name text NOT NULL,
 location_type text NOT NULL DEFAULT 'shelf' CHECK(location_type IN('shelf','receiving','packing','unassigned')),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,warehouse_id,code)
);
INSERT INTO warehouse_locations(tenant_id,warehouse_id,code,name,location_type)
 SELECT tenant_id,id,'UNASSIGNED','Yerleştirme bekliyor','unassigned' FROM warehouses
 ON CONFLICT DO NOTHING;
ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES warehouse_locations(id);
CREATE TABLE IF NOT EXISTS warehouse_location_balances (
 tenant_id uuid NOT NULL REFERENCES tenants(id), item_id uuid NOT NULL REFERENCES inventory_items(id),
 location_id uuid NOT NULL REFERENCES warehouse_locations(id), quantity numeric(18,6) NOT NULL DEFAULT 0 CHECK(quantity>=0),
 version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,item_id,location_id)
);
-- Backfill only once; repeat releases do not reconstruct or overwrite shelf assignments.
INSERT INTO warehouse_location_balances(tenant_id,item_id,location_id,quantity)
 SELECT b.tenant_id,b.item_id,l.id,b.on_hand_qty FROM stock_balances b
 JOIN warehouse_locations l ON l.tenant_id=b.tenant_id AND l.warehouse_id=b.warehouse_id AND l.location_type='unassigned'
 WHERE NOT EXISTS(SELECT 1 FROM warehouse_location_balances x JOIN warehouse_locations xl ON xl.id=x.location_id
 WHERE x.tenant_id=b.tenant_id AND x.item_id=b.item_id AND xl.warehouse_id=b.warehouse_id)
 ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS warehouse_location_moves (
 id bigserial PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id),
 stock_entry_line_id uuid NOT NULL REFERENCES stock_entry_lines(id), location_id uuid NOT NULL REFERENCES warehouse_locations(id),
 quantity_delta numeric(18,6) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS warehouse_moves_tenant_recent ON warehouse_location_moves(tenant_id,id DESC);
CREATE TABLE IF NOT EXISTS factory_labels (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 kind text NOT NULL CHECK(kind IN('item','location','lot','job','cut','product')),
 record_id uuid NOT NULL, code text NOT NULL UNIQUE, created_by uuid NOT NULL REFERENCES users(id),
 print_count integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), last_printed_at timestamptz,
 UNIQUE(tenant_id,kind,record_id)
);
CREATE TABLE IF NOT EXISTS warehouse_counts (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id uuid NOT NULL REFERENCES tenants(id),
 item_id uuid NOT NULL REFERENCES inventory_items(id), location_id uuid NOT NULL REFERENCES warehouse_locations(id),
 expected_qty numeric(18,6) NOT NULL, counted_qty numeric(18,6) NOT NULL CHECK(counted_qty>=0),
 balance_version integer NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
 reason text NOT NULL, counted_by uuid NOT NULL REFERENCES users(id), reviewed_by uuid REFERENCES users(id),
 review_note text, stock_entry_id uuid REFERENCES stock_entries(id), created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS warehouse_counts_pending ON warehouse_counts(tenant_id,status,created_at DESC);
CREATE OR REPLACE FUNCTION rf_sync_location_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE loc uuid; qty numeric; rest numeric; take numeric; b record;
BEGIN
 INSERT INTO warehouse_locations(tenant_id,warehouse_id,code,name,location_type)
 VALUES(NEW.tenant_id,NEW.warehouse_id,'UNASSIGNED','Yerleştirme bekliyor','unassigned') ON CONFLICT DO NOTHING;
 IF NEW.metadata->>'locationId' IS NOT NULL THEN loc := (NEW.metadata->>'locationId')::uuid;
 ELSIF NEW.lot_id IS NOT NULL THEN
 SELECT location_id INTO loc FROM stock_lots WHERE tenant_id=NEW.tenant_id AND id=NEW.lot_id;
 END IF;
 IF loc IS NOT NULL AND NOT EXISTS(SELECT 1 FROM warehouse_locations WHERE id=loc AND tenant_id=NEW.tenant_id AND warehouse_id=NEW.warehouse_id AND active) THEN
 RAISE EXCEPTION 'Raf depoya veya firmaya ait değil';
 END IF;
 IF NEW.quantity_delta>0 OR loc IS NOT NULL THEN
 IF loc IS NULL THEN SELECT id INTO loc FROM warehouse_locations WHERE tenant_id=NEW.tenant_id AND warehouse_id=NEW.warehouse_id AND location_type='unassigned'; END IF;
 INSERT INTO warehouse_location_balances(tenant_id,item_id,location_id,quantity) VALUES(NEW.tenant_id,NEW.item_id,loc,0) ON CONFLICT DO NOTHING;
 SELECT quantity INTO qty FROM warehouse_location_balances WHERE tenant_id=NEW.tenant_id AND item_id=NEW.item_id AND location_id=loc FOR UPDATE;
 IF qty+NEW.quantity_delta<0 THEN RAISE EXCEPTION 'Rafta yeterli stok yok'; END IF;
 UPDATE warehouse_location_balances SET quantity=quantity+NEW.quantity_delta,version=version+1,updated_at=now() WHERE tenant_id=NEW.tenant_id AND item_id=NEW.item_id AND location_id=loc;
 INSERT INTO warehouse_location_moves(tenant_id,stock_entry_line_id,location_id,quantity_delta) VALUES(NEW.tenant_id,NEW.id,loc,NEW.quantity_delta);
 ELSE
 -- Legacy bulk consumption is allocated deterministically; explicit scanned transfers name the shelf.
 rest := -NEW.quantity_delta;
 FOR b IN SELECT x.location_id,x.quantity FROM warehouse_location_balances x JOIN warehouse_locations l ON l.id=x.location_id
 WHERE x.tenant_id=NEW.tenant_id AND x.item_id=NEW.item_id AND l.warehouse_id=NEW.warehouse_id AND x.quantity>0
 ORDER BY (l.location_type='unassigned') DESC,l.code,l.id FOR UPDATE OF x LOOP
 take := LEAST(rest,b.quantity);
 UPDATE warehouse_location_balances SET quantity=quantity-take,version=version+1,updated_at=now() WHERE tenant_id=NEW.tenant_id AND item_id=NEW.item_id AND location_id=b.location_id;
 INSERT INTO warehouse_location_moves(tenant_id,stock_entry_line_id,location_id,quantity_delta) VALUES(NEW.tenant_id,NEW.id,b.location_id,-take);
 rest := rest-take; EXIT WHEN rest=0;
 END LOOP;
 IF rest>0 THEN RAISE EXCEPTION 'Raf bakiyeleri depo bakiyesiyle uyuşmuyor'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rf_location_ledger ON stock_entry_lines;
CREATE TRIGGER rf_location_ledger AFTER INSERT ON stock_entry_lines FOR EACH ROW EXECUTE FUNCTION rf_sync_location_ledger();
CREATE OR REPLACE FUNCTION rf_default_warehouse_location() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO warehouse_locations(tenant_id,warehouse_id,code,name,location_type)
 VALUES(NEW.tenant_id,NEW.id,'UNASSIGNED','Yerleştirme bekliyor','unassigned') ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rf_warehouse_location ON warehouses;
CREATE TRIGGER rf_warehouse_location AFTER INSERT ON warehouses FOR EACH ROW EXECUTE FUNCTION rf_default_warehouse_location();
