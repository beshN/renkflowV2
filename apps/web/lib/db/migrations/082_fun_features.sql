-- Preserve existing behaviour for existing and new firms.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS fun_features_enabled boolean NOT NULL DEFAULT true;
