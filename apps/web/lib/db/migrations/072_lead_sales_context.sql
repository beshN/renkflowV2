ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sales_profile jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority_override jsonb;
CREATE TABLE IF NOT EXISTS public.lead_research_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
 category text NOT NULL CHECK(category IN('activity','product_fit','location','projects','branches','contact','buying_signal')),
 url text NOT NULL,title text NOT NULL,findings text NOT NULL,
 status text NOT NULL DEFAULT 'reported' CHECK(status IN('reported','verified','rejected')),
 checked_at timestamptz NOT NULL,created_by uuid NOT NULL REFERENCES public.users(id),
 command_id uuid NOT NULL,
 updated_by uuid REFERENCES public.users(id),
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_research_lookup ON public.lead_research_sources(tenant_id,lead_id,checked_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS lead_research_command ON public.lead_research_sources(tenant_id,command_id);
CREATE TABLE IF NOT EXISTS public.lead_quotation_links (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
 quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
 created_by uuid NOT NULL REFERENCES public.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,lead_id,quotation_id)
);
