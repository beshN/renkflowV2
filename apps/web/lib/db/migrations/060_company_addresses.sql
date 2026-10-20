-- Addresses remain reserved after renaming, so an old company URL cannot be claimed by another firm.
CREATE TABLE IF NOT EXISTS public.company_address_claims (
 address text PRIMARY KEY,tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_address_claims ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.company_address_claims DROP CONSTRAINT IF EXISTS company_address_claims_tenant_id_fkey;
ALTER TABLE public.company_address_claims ADD CONSTRAINT company_address_claims_tenant_id_fkey FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
-- A separate address reservation preserves existing slugs, membership IDs and business records.
CREATE TABLE IF NOT EXISTS public.company_addresses (
 tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
 address text NOT NULL UNIQUE CHECK(address ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.company_addresses(tenant_id,address)
 SELECT id,slug FROM tenants WHERE slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
 AND slug NOT IN ('www','app','panel','api','admin','auth','login','signup','mail','smtp','imap','pop','ftp','cdn','assets','static','status','support','help','docs','blog','billing','vercel','ns1','ns2')
 ON CONFLICT DO NOTHING;

INSERT INTO public.company_address_claims(address,tenant_id) SELECT address,tenant_id FROM company_addresses ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.rf_seed_company_address() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' AND NEW.slug NOT IN ('www','app','panel','api','admin','auth','login','signup','mail','smtp','imap','pop','ftp','cdn','assets','static','status','support','help','docs','blog','billing','vercel','ns1','ns2') THEN
  INSERT INTO company_address_claims(address,tenant_id) VALUES(NEW.slug,NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO company_addresses(tenant_id,address) SELECT NEW.id,NEW.slug WHERE EXISTS(SELECT 1 FROM company_address_claims WHERE address=NEW.slug AND tenant_id=NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tenants_seed_company_address ON public.tenants;
CREATE TRIGGER tenants_seed_company_address AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.rf_seed_company_address();
