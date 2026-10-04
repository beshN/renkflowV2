CREATE INDEX IF NOT EXISTS production_events_history ON public.production_events(tenant_id,created_at,operation_id) WHERE event_type IN('operation.complete','operation.rework');
