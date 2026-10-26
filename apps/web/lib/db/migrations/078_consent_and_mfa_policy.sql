-- Legal consent records (KVKK) and the firm's two-step sign-in policy. Additive and idempotent.

-- When and which version of the Kullanım Koşulları the user accepted, when they acknowledged the
-- Gizlilik ve KVKK Aydınlatma Metni, and from which address (versions: lib/core/legal-content.ts).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS privacy_notice_ack_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS privacy_notice_version text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS terms_accepted_ip text;

-- Owners and admins must set up two-step sign-in before they can use the workspace.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS require_mfa_for_admins boolean NOT NULL DEFAULT false;
