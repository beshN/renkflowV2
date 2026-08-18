-- RenkFlow V2: clean Supabase foundation
-- Auth, Postgres, Storage and RLS are the only backend surface.

create extension if not exists pgcrypto with schema extensions;

create type public.organization_role as enum ('owner', 'admin', 'office', 'production');
create type public.order_status as enum ('draft', 'awaiting_review', 'approved', 'in_production', 'ready', 'delivered', 'cancelled');
create type public.analysis_status as enum ('queued', 'running', 'needs_review', 'completed', 'failed');
create type public.rule_set_status as enum ('draft', 'active', 'archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  locale text not null default 'tr' check (locale in ('tr')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  analysis_limit_30d integer not null default 25 check (analysis_limit_30d between 1 and 10000),
  concurrent_analysis_limit integer not null default 2 check (concurrent_analysis_limit between 1 and 20),
  settings jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role not null,
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email = lower(email)),
  role public.organization_role not null check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index organization_invites_pending_email_idx
  on public.organization_invites (organization_id, email)
  where accepted_at is null and revoked_at is null;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_number text not null,
  status public.order_status not null default 'draft',
  customer_name text,
  project_name text,
  customer_reference text,
  notes text,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_number)
);

create index orders_org_status_idx on public.orders (organization_id, status, updated_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  quantity integer not null default 1 check (quantity > 0),
  width_mm numeric(12,2) check (width_mm > 0),
  height_mm numeric(12,2) check (height_mm > 0),
  light_color text,
  profile_type text,
  motor_type text,
  notes text,
  source_page integer check (source_page > 0 and source_page <= 50),
  verified_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, line_number)
);

create index order_items_org_order_idx on public.order_items (organization_id, order_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  original_name text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  page_count integer check (page_count between 1 and 50),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index documents_org_order_idx on public.documents (organization_id, order_id, created_at desc);

create table public.document_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  status public.analysis_status not null default 'queued',
  dedupe_key text not null unique,
  workflow_run_id text,
  model_requested text not null,
  model_used text,
  escalation_model text,
  escalated boolean not null default false,
  prompt_version text not null,
  schema_version text not null,
  raw_output jsonb,
  normalized_output jsonb,
  provider_generation_id text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  reasoning_tokens integer check (reasoning_tokens is null or reasoning_tokens >= 0),
  cost_usd numeric(14,8) check (cost_usd is null or cost_usd >= 0),
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index analyses_org_created_idx on public.document_analyses (organization_id, created_at desc);
create index analyses_active_idx on public.document_analyses (organization_id, status)
  where status in ('queued', 'running');

create table public.analysis_generations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null references public.document_analyses(id) on delete cascade,
  model text not null,
  prompt_version text not null,
  schema_version text not null,
  provider_generation_id text,
  raw_output jsonb,
  normalized_output jsonb,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  reasoning_tokens integer check (reasoning_tokens is null or reasoning_tokens >= 0),
  cost_usd numeric(14,8) check (cost_usd is null or cost_usd >= 0),
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index analysis_generations_analysis_idx
  on public.analysis_generations (analysis_id, created_at);

create table public.analysis_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null references public.document_analyses(id) on delete cascade,
  field_path text not null,
  ai_value jsonb,
  corrected_value jsonb,
  corrected_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index corrections_analysis_idx on public.analysis_corrections (analysis_id, created_at);

create table public.production_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  position integer not null check (position > 0),
  color text not null default '#157347',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, position),
  unique (organization_id, name)
);

create table public.order_stage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  stage_id uuid not null references public.production_stages(id),
  event_type text not null check (event_type in ('started', 'completed', 'reopened', 'note')),
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index order_stage_events_timeline_idx on public.order_stage_events (order_id, created_at);

create table public.calculation_rule_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  version integer not null check (version > 0),
  status public.rule_set_status not null default 'draft',
  input_schema jsonb not null default '{}'::jsonb,
  rules_ast jsonb not null,
  test_cases jsonb not null default '[]'::jsonb,
  activated_at timestamptz,
  activated_by uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, name, version)
);

create unique index one_active_rule_version_idx
  on public.calculation_rule_sets (organization_id, name)
  where status = 'active';

create table public.calculation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,
  rule_set_id uuid not null references public.calculation_rule_sets(id),
  rule_set_version integer not null,
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  input_snapshot jsonb not null,
  result_snapshot jsonb not null,
  validation_errors jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (order_item_id, rule_set_id, input_hash)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger organizations_touch_updated_at before update on public.organizations
for each row execute function public.touch_updated_at();
create trigger orders_touch_updated_at before update on public.orders
for each row execute function public.touch_updated_at();
create trigger order_items_touch_updated_at before update on public.order_items
for each row execute function public.touch_updated_at();
create trigger analyses_touch_updated_at before update on public.document_analyses
for each row execute function public.touch_updated_at();
create trigger stages_touch_updated_at before update on public.production_stages
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed_roles public.organization_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.role = any(allowed_roles)
  );
$$;

create or replace function public.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    translate(lower(value), 'çğıöşüâîû', 'cgiosuaiu'),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  base_slug text;
  final_slug text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if char_length(trim(org_name)) < 2 then
    raise exception 'invalid_organization_name';
  end if;

  base_slug := public.slugify(org_name);
  if base_slug = '' then base_slug := 'sirket'; end if;
  final_slug := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.organizations (name, slug, created_by)
  values (trim(org_name), final_slug, auth.uid())
  returning id into org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (org_id, auth.uid(), 'owner');

  insert into public.production_stages (organization_id, name, position, color)
  values
    (org_id, 'Hazırlık', 1, '#64748b'),
    (org_id, 'Kesim', 2, '#0ea5e9'),
    (org_id, 'Montaj', 3, '#8b5cf6'),
    (org_id, 'Motor/LED', 4, '#f59e0b'),
    (org_id, 'Kalite Kontrol', 5, '#ec4899'),
    (org_id, 'Paketleme', 6, '#14b8a6'),
    (org_id, 'Sevke Hazır', 7, '#22c55e'),
    (org_id, 'Teslim', 8, '#157347');

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (org_id, auth.uid(), 'organization.created', 'organization', org_id::text);

  return org_id;
end;
$$;

create or replace function public.accept_organization_invite(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.organization_invites%rowtype;
  current_email text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;

  select lower(email) into current_email from auth.users where id = auth.uid();
  select * into invite_row
  from public.organization_invites
  where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if invite_row.id is null then raise exception 'invalid_or_expired_invite'; end if;
  if current_email is distinct from invite_row.email then raise exception 'invite_email_mismatch'; end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (invite_row.organization_id, auth.uid(), invite_row.role)
  on conflict (organization_id, user_id) do update set role = excluded.role;

  update public.organization_invites set accepted_at = now() where id = invite_row.id;
  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (invite_row.organization_id, auth.uid(), 'invite.accepted', 'organization_invite', invite_row.id::text);

  return invite_row.organization_id;
end;
$$;

create or replace function public.prevent_immutable_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% records are immutable', tg_table_name;
end;
$$;

create or replace function public.review_analysis(
  target_analysis uuid,
  verified_output jsonb,
  corrections jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  analysis_row public.document_analyses%rowtype;
  item jsonb;
  correction jsonb;
  item_index integer := 0;
begin
  select * into analysis_row
  from public.document_analyses
  where id = target_analysis
  for update;

  if analysis_row.id is null then raise exception 'analysis_not_found'; end if;
  if not public.has_org_role(
    analysis_row.organization_id,
    array['owner','admin','office']::public.organization_role[]
  ) then raise exception 'permission_denied'; end if;
  if analysis_row.status <> 'needs_review' then raise exception 'analysis_not_reviewable'; end if;
  if jsonb_typeof(verified_output -> 'items') <> 'array' then raise exception 'invalid_verified_output'; end if;

  delete from public.order_items where order_id = analysis_row.order_id;
  for item in select * from jsonb_array_elements(verified_output -> 'items')
  loop
    item_index := item_index + 1;
    insert into public.order_items (
      organization_id, order_id, line_number, quantity, width_mm, height_mm,
      light_color, profile_type, motor_type, notes, source_page, verified_data
    ) values (
      analysis_row.organization_id,
      analysis_row.order_id,
      item_index,
      coalesce((item #>> '{quantity,value}')::integer, 1),
      (item #>> '{widthMm,value}')::numeric,
      (item #>> '{heightMm,value}')::numeric,
      item #>> '{lightColor,value}',
      item #>> '{profileType,value}',
      item #>> '{motorType,value}',
      item #>> '{notes,value}',
      coalesce(
        (item #>> '{widthMm,sourcePage}')::integer,
        (item #>> '{heightMm,sourcePage}')::integer
      ),
      item
    );
  end loop;

  for correction in select * from jsonb_array_elements(corrections)
  loop
    insert into public.analysis_corrections (
      organization_id, analysis_id, field_path, ai_value, corrected_value, corrected_by
    ) values (
      analysis_row.organization_id,
      analysis_row.id,
      correction ->> 'fieldPath',
      correction -> 'aiValue',
      correction -> 'correctedValue',
      auth.uid()
    );
  end loop;

  update public.orders set
    customer_name = verified_output #>> '{customerName,value}',
    project_name = verified_output #>> '{projectName,value}',
    customer_reference = verified_output #>> '{orderReference,value}',
    notes = verified_output #>> '{notes,value}',
    status = 'approved',
    approved_at = now(),
    approved_by = auth.uid()
  where id = analysis_row.order_id;

  update public.document_analyses set
    status = 'completed',
    normalized_output = verified_output,
    completed_at = now()
  where id = analysis_row.id;

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    analysis_row.organization_id,
    auth.uid(),
    'analysis.reviewed',
    'document_analysis',
    analysis_row.id::text,
    jsonb_build_object('correction_count', jsonb_array_length(corrections))
  );

  return analysis_row.order_id;
end;
$$;

create or replace function public.activate_rule_set(target_rule_set uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule_row public.calculation_rule_sets%rowtype;
begin
  select * into rule_row from public.calculation_rule_sets where id = target_rule_set for update;
  if rule_row.id is null then raise exception 'rule_set_not_found'; end if;
  if not public.has_org_role(
    rule_row.organization_id,
    array['owner','admin']::public.organization_role[]
  ) then raise exception 'permission_denied'; end if;

  update public.calculation_rule_sets
  set status = 'archived'
  where organization_id = rule_row.organization_id
    and name = rule_row.name
    and status = 'active'
    and id <> rule_row.id;

  update public.calculation_rule_sets
  set status = 'active', activated_at = now(), activated_by = auth.uid()
  where id = rule_row.id;

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (rule_row.organization_id, auth.uid(), 'rule_set.activated', 'calculation_rule_set', rule_row.id::text);
  return rule_row.id;
end;
$$;

create trigger calculation_runs_immutable
before update or delete on public.calculation_runs
for each row execute function public.prevent_immutable_changes();
create trigger audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function public.prevent_immutable_changes();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.documents enable row level security;
alter table public.document_analyses enable row level security;
alter table public.analysis_generations enable row level security;
alter table public.analysis_corrections enable row level security;
alter table public.production_stages enable row level security;
alter table public.order_stage_events enable row level security;
alter table public.calculation_rule_sets enable row level security;
alter table public.calculation_runs enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated
using (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_coworkers_select on public.profiles for select to authenticated
using (exists (
  select 1 from public.organization_members mine
  join public.organization_members theirs on theirs.organization_id = mine.organization_id
  where mine.user_id = auth.uid() and theirs.user_id = profiles.id
));

create policy organizations_member_select on public.organizations for select to authenticated
using (public.is_org_member(id));
create policy organizations_admin_update on public.organizations for update to authenticated
using (public.has_org_role(id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(id, array['owner','admin']::public.organization_role[]));

create policy members_member_select on public.organization_members for select to authenticated
using (public.is_org_member(organization_id));
create policy members_admin_insert on public.organization_members for insert to authenticated
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy members_admin_update on public.organization_members for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (role <> 'owner');
create policy members_owner_delete on public.organization_members for delete to authenticated
using (public.has_org_role(organization_id, array['owner']::public.organization_role[]) and role <> 'owner');

create policy invites_admin_select on public.organization_invites for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy invites_admin_insert on public.organization_invites for insert to authenticated
with check (
  invited_by = auth.uid()
  and role <> 'owner'
  and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[])
);
create policy invites_admin_update on public.organization_invites for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy orders_member_select on public.orders for select to authenticated
using (public.is_org_member(organization_id));
create policy orders_office_insert on public.orders for insert to authenticated
with check (
  created_by = auth.uid()
  and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[])
);
create policy orders_office_update on public.orders for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]))
with check (public.is_org_member(organization_id));
create policy orders_admin_delete on public.orders for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy order_items_member_select on public.order_items for select to authenticated
using (public.is_org_member(organization_id));
create policy order_items_office_insert on public.order_items for insert to authenticated
with check (public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]));
create policy order_items_office_update on public.order_items for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]));
create policy order_items_admin_delete on public.order_items for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy documents_member_select on public.documents for select to authenticated
using (public.is_org_member(organization_id));
create policy documents_office_insert on public.documents for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[])
);
create policy documents_admin_delete on public.documents for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy analyses_member_select on public.document_analyses for select to authenticated
using (public.is_org_member(organization_id));
create policy analyses_office_insert on public.document_analyses for insert to authenticated
with check (
  created_by = auth.uid()
  and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[])
);
create policy analyses_office_update on public.document_analyses for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]));

create policy analysis_generations_member_select on public.analysis_generations for select to authenticated
using (public.is_org_member(organization_id));

create policy corrections_member_select on public.analysis_corrections for select to authenticated
using (public.is_org_member(organization_id));
create policy corrections_office_insert on public.analysis_corrections for insert to authenticated
with check (
  corrected_by = auth.uid()
  and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[])
);

create policy stages_member_select on public.production_stages for select to authenticated
using (public.is_org_member(organization_id));
create policy stages_admin_all on public.production_stages for all to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy stage_events_member_select on public.order_stage_events for select to authenticated
using (public.is_org_member(organization_id));
create policy stage_events_production_insert on public.order_stage_events for insert to authenticated
with check (
  created_by = auth.uid()
  and public.has_org_role(organization_id, array['owner','admin','office','production']::public.organization_role[])
);

create policy rule_sets_member_select on public.calculation_rule_sets for select to authenticated
using (public.is_org_member(organization_id));
create policy rule_sets_admin_insert on public.calculation_rule_sets for insert to authenticated
with check (
  created_by = auth.uid()
  and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[])
);
create policy rule_sets_admin_update on public.calculation_rule_sets for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy calculation_runs_member_select on public.calculation_runs for select to authenticated
using (public.is_org_member(organization_id));
create policy calculation_runs_office_insert on public.calculation_runs for insert to authenticated
with check (
  created_by = auth.uid()
  and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[])
);

create policy audit_logs_member_select on public.audit_logs for select to authenticated
using (public.is_org_member(organization_id));
create policy audit_logs_member_insert on public.audit_logs for insert to authenticated
with check (actor_id = auth.uid() and public.is_org_member(organization_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-documents', 'order-documents', false, 26214400, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy order_documents_member_read on storage.objects for select to authenticated
using (
  bucket_id = 'order-documents'
  and public.is_org_member((storage.foldername(name))[1]::uuid)
);
create policy order_documents_office_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'order-documents'
  and public.has_org_role(
    (storage.foldername(name))[1]::uuid,
    array['owner','admin','office']::public.organization_role[]
  )
);
create policy order_documents_admin_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'order-documents'
  and public.has_org_role(
    (storage.foldername(name))[1]::uuid,
    array['owner','admin']::public.organization_role[]
  )
);

grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.accept_organization_invite(text) to authenticated;
grant execute on function public.review_analysis(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.activate_rule_set(uuid) to authenticated;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, public.organization_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.organization_role[]) to authenticated;
