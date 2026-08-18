create index analysis_corrections_tenant_analysis_idx
  on public.analysis_corrections (organization_id, analysis_id);
create index analysis_generations_tenant_analysis_idx
  on public.analysis_generations (organization_id, analysis_id);

create index calculation_runs_tenant_order_idx
  on public.calculation_runs (organization_id, order_id);
create index calculation_runs_tenant_item_idx
  on public.calculation_runs (organization_id, order_id, order_item_id);
create index calculation_runs_tenant_rule_set_idx
  on public.calculation_runs (organization_id, rule_set_id);

create index analyses_tenant_order_idx
  on public.document_analyses (organization_id, order_id);
create index analyses_tenant_document_idx
  on public.document_analyses (organization_id, order_id, document_id);

create index order_stage_events_tenant_order_idx
  on public.order_stage_events (organization_id, order_id);
create index order_stage_events_tenant_stage_idx
  on public.order_stage_events (organization_id, stage_id);
