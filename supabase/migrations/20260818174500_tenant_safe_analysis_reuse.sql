alter table public.document_analyses
  drop constraint if exists document_analyses_dedupe_key_key;

alter table public.document_analyses
  add column if not exists reused_from_analysis_id uuid;

alter table public.document_analyses
  add constraint analyses_tenant_reused_from_fk
  foreign key (organization_id, reused_from_analysis_id)
  references public.document_analyses (organization_id, id)
  on delete set null (reused_from_analysis_id);

create unique index analyses_document_dedupe_unique
  on public.document_analyses (organization_id, document_id, dedupe_key);

create index analyses_reuse_lookup_idx
  on public.document_analyses (organization_id, dedupe_key, created_at desc)
  where status in ('needs_review', 'completed');
