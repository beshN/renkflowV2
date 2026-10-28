-- Fair quotes: one request per form submission. The phone sends a submission id with every try, so a
-- retry after a dropped connection returns the first request instead of opening a second quote and lead.
ALTER TABLE fair_quotes ADD COLUMN IF NOT EXISTS submission_id text CHECK (submission_id IS NULL OR submission_id ~ '^[A-Za-z0-9_-]{22}$');
CREATE UNIQUE INDEX IF NOT EXISTS fair_quotes_submission_uq ON fair_quotes (tenant_id, submission_id) WHERE submission_id IS NOT NULL;
