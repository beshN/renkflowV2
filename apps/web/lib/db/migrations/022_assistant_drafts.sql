-- Assistant drafts use the existing human-review flow; never create a confirmed order directly.
ALTER TABLE public.intake_drafts DROP CONSTRAINT IF EXISTS intake_drafts_source_check;
ALTER TABLE public.intake_drafts ADD CONSTRAINT intake_drafts_source_check CHECK(source IN('upload','email','whatsapp','assistant'));
