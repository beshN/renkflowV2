-- Preserve original extraction and audited human review separately. Legacy approved rows are unchanged.
ALTER TABLE public.intake_drafts
 ADD COLUMN IF NOT EXISTS reviewed_data jsonb,
 ADD COLUMN IF NOT EXISTS reviewed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
 ADD COLUMN IF NOT EXISTS review_version integer NOT NULL DEFAULT 1 CHECK(review_version>0),
 ADD COLUMN IF NOT EXISTS approval_hash text;
ALTER TABLE public.order_items
 ADD COLUMN IF NOT EXISTS custom_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS quantity_unit text NOT NULL DEFAULT 'adet';
