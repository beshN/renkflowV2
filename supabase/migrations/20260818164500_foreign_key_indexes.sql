-- Cover every non-leading foreign key used by joins, deletes and RLS lookups.
create index organization_members_user_idx on public.organization_members (user_id);
create index organization_invites_invited_by_idx on public.organization_invites (invited_by);

create index orders_approved_by_idx on public.orders (approved_by);
create index orders_created_by_idx on public.orders (created_by);

create index documents_order_idx on public.documents (order_id);
create index documents_uploaded_by_idx on public.documents (uploaded_by);

create index analyses_order_idx on public.document_analyses (order_id);
create index analyses_document_idx on public.document_analyses (document_id);
create index analyses_created_by_idx on public.document_analyses (created_by);

create index analysis_generations_org_idx on public.analysis_generations (organization_id);

create index corrections_org_idx on public.analysis_corrections (organization_id);
create index corrections_corrected_by_idx on public.analysis_corrections (corrected_by);

create index order_stage_events_org_idx on public.order_stage_events (organization_id);
create index order_stage_events_stage_idx on public.order_stage_events (stage_id);
create index order_stage_events_created_by_idx on public.order_stage_events (created_by);

create index rule_sets_activated_by_idx on public.calculation_rule_sets (activated_by);
create index rule_sets_created_by_idx on public.calculation_rule_sets (created_by);

create index calculation_runs_org_idx on public.calculation_runs (organization_id);
create index calculation_runs_order_idx on public.calculation_runs (order_id);
create index calculation_runs_rule_set_idx on public.calculation_runs (rule_set_id);
create index calculation_runs_created_by_idx on public.calculation_runs (created_by);

create index audit_logs_actor_idx on public.audit_logs (actor_id);
