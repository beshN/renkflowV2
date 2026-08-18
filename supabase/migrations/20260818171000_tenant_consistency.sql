-- Composite tenant keys prevent cross-organization references even when a user
-- legitimately belongs to more than one organization.
alter table public.orders
  add constraint orders_organization_id_id_key unique (organization_id, id);
alter table public.order_items
  add constraint order_items_organization_id_order_id_id_key unique (organization_id, order_id, id);
alter table public.documents
  add constraint documents_organization_id_order_id_id_key unique (organization_id, order_id, id);
alter table public.document_analyses
  add constraint document_analyses_organization_id_id_key unique (organization_id, id);
alter table public.production_stages
  add constraint production_stages_organization_id_id_key unique (organization_id, id);
alter table public.calculation_rule_sets
  add constraint calculation_rule_sets_organization_id_id_key unique (organization_id, id);

alter table public.order_items
  add constraint order_items_tenant_order_fk
  foreign key (organization_id, order_id)
  references public.orders (organization_id, id)
  on delete cascade;

alter table public.documents
  add constraint documents_tenant_order_fk
  foreign key (organization_id, order_id)
  references public.orders (organization_id, id)
  on delete cascade;

alter table public.document_analyses
  add constraint analyses_tenant_order_fk
  foreign key (organization_id, order_id)
  references public.orders (organization_id, id)
  on delete cascade,
  add constraint analyses_tenant_document_fk
  foreign key (organization_id, order_id, document_id)
  references public.documents (organization_id, order_id, id)
  on delete cascade;

alter table public.analysis_generations
  add constraint analysis_generations_tenant_analysis_fk
  foreign key (organization_id, analysis_id)
  references public.document_analyses (organization_id, id)
  on delete cascade;

alter table public.analysis_corrections
  add constraint analysis_corrections_tenant_analysis_fk
  foreign key (organization_id, analysis_id)
  references public.document_analyses (organization_id, id)
  on delete cascade;

alter table public.order_stage_events
  add constraint order_stage_events_tenant_order_fk
  foreign key (organization_id, order_id)
  references public.orders (organization_id, id)
  on delete cascade,
  add constraint order_stage_events_tenant_stage_fk
  foreign key (organization_id, stage_id)
  references public.production_stages (organization_id, id);

alter table public.calculation_runs
  add constraint calculation_runs_tenant_order_fk
  foreign key (organization_id, order_id)
  references public.orders (organization_id, id)
  on delete cascade,
  add constraint calculation_runs_tenant_item_fk
  foreign key (organization_id, order_id, order_item_id)
  references public.order_items (organization_id, order_id, id)
  on delete cascade,
  add constraint calculation_runs_tenant_rule_set_fk
  foreign key (organization_id, rule_set_id)
  references public.calculation_rule_sets (organization_id, id);
