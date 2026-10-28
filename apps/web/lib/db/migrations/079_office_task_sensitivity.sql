-- AI office: what a task's brief, summary and delivered files may contain, so they are shown only
-- to the person who gave the task, owners/admins and members cleared for it. Additive and idempotent.
-- Markers: 'finance' (firm finance data or finance work: prices, costs, profit), and the field groups
-- 'price', 'cost', 'profit', 'customer_contact' found in the records the task looked up.
-- NULL means "not known" (tasks from before this column): treated as the most sensitive.
ALTER TABLE public.office_tasks ADD COLUMN IF NOT EXISTS sensitivity text[];
