-- Keep original cuts, consumption and costs; a revision disposes of them with new movements.
ALTER TABLE public.production_parts DROP CONSTRAINT IF EXISTS production_parts_state_check;
ALTER TABLE public.production_parts ADD CONSTRAINT production_parts_state_check CHECK(state IN('planned','cut','paint_waiting','paint_sent','paint_returned','assembled','scrapped','returned_to_stock'));
CREATE TABLE IF NOT EXISTS public.technical_material_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 technical_revision_id uuid NOT NULL REFERENCES public.order_technical_revisions(id),
 command_id uuid NOT NULL, input jsonb NOT NULL, result jsonb NOT NULL,
 approved_by uuid NOT NULL REFERENCES public.users(id), approved_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,command_id), UNIQUE(tenant_id,technical_revision_id)
);
