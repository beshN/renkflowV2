CREATE TABLE IF NOT EXISTS public.lead_research_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
 command_id uuid NOT NULL,created_by uuid NOT NULL REFERENCES public.users(id),
 fingerprint text NOT NULL,query jsonb NOT NULL,
 status text NOT NULL CHECK(status IN('running','completed','failed','stale')),
 result jsonb,cached_from_id uuid REFERENCES public.lead_research_runs(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,
 UNIQUE(tenant_id,command_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS lead_research_one_running ON public.lead_research_runs(tenant_id,lead_id) WHERE status='running';
CREATE INDEX IF NOT EXISTS lead_research_cache ON public.lead_research_runs(tenant_id,lead_id,fingerprint,finished_at DESC) WHERE status='completed' AND cached_from_id IS NULL;
ALTER TABLE public.lead_research_sources ADD COLUMN IF NOT EXISTS research_run_id uuid REFERENCES public.lead_research_runs(id) ON DELETE SET NULL;
ALTER TABLE public.lead_research_sources ADD COLUMN IF NOT EXISTS evidence jsonb;
ALTER TABLE public.ai_usage ADD COLUMN IF NOT EXISTS web_search_requests integer NOT NULL DEFAULT 0 CHECK(web_search_requests>=0);
ALTER TABLE public.ai_usage ADD COLUMN IF NOT EXISTS tool_cost_usd numeric(12,6) NOT NULL DEFAULT 0 CHECK(tool_cost_usd>=0);
