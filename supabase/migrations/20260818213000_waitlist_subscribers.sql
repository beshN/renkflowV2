create table public.waitlist_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and char_length(email) between 3 and 254),
  source text not null default 'coming-soon',
  created_at timestamptz not null default now()
);

alter table public.waitlist_subscribers enable row level security;

-- Public clients receive no table policy. Signups go through the validated server route
-- with the server-only Supabase secret key, preventing list reads or direct browser writes.
revoke all on table public.waitlist_subscribers from anon, authenticated;
