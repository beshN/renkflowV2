-- Keep a single deterministic production rule set active per organization.
with ranked_active as (
  select id, row_number() over (
    partition by organization_id
    order by activated_at desc nulls last, created_at desc, id desc
  ) as active_rank
  from public.calculation_rule_sets
  where status = 'active'
)
update public.calculation_rule_sets as rule_set
set status = 'archived'
from ranked_active
where rule_set.id = ranked_active.id and ranked_active.active_rank > 1;

drop index if exists public.one_active_rule_version_idx;
create unique index one_active_rule_set_per_organization_idx
  on public.calculation_rule_sets (organization_id)
  where status = 'active';

-- Covers the tenant-consistent self-reference used when a previous extraction
-- is reused for another document in the same organization.
create index if not exists analyses_tenant_reused_from_idx
  on public.document_analyses (organization_id, reused_from_analysis_id)
  where reused_from_analysis_id is not null;

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
    and status = 'active'
    and id <> rule_row.id;

  update public.calculation_rule_sets
  set status = 'active', activated_at = clock_timestamp(), activated_by = auth.uid()
  where id = rule_row.id;

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (rule_row.organization_id, auth.uid(), 'rule_set.activated', 'calculation_rule_set', rule_row.id::text);
  return rule_row.id;
end;
$$;

create or replace function public.update_production_stages(
  target_organization uuid,
  stage_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload_count integer;
  matching_count integer;
  current_count integer;
begin
  if not public.has_org_role(
    target_organization,
    array['owner','admin']::public.organization_role[]
  ) then raise exception 'Bu işlem için yetkiniz yok.'; end if;

  if jsonb_typeof(stage_payload) <> 'array' then
    raise exception 'Üretim aşamaları geçersiz.';
  end if;

  payload_count := jsonb_array_length(stage_payload);
  if payload_count < 1 or payload_count > 50 then
    raise exception 'Üretim aşaması sayısı geçersiz.';
  end if;

  perform 1 from public.organizations where id = target_organization for update;
  if not found then raise exception 'Şirket bulunamadı.'; end if;

  select count(*) into current_count
  from public.production_stages where organization_id = target_organization;

  select count(*) into matching_count
  from jsonb_to_recordset(stage_payload) as item(id uuid, name text, color text, position integer)
  join public.production_stages as stage
    on stage.id = item.id and stage.organization_id = target_organization
  where char_length(trim(item.name)) between 1 and 80
    and item.color ~ '^#[0-9a-fA-F]{6}$'
    and item.position between 1 and 50;

  if matching_count <> payload_count or current_count <> payload_count then
    raise exception 'Üretim aşamaları değişti. Sayfayı yenileyip tekrar deneyin.';
  end if;

  if (
    select count(distinct item.id) <> payload_count
      or count(distinct item.position) <> payload_count
      or count(distinct lower(trim(item.name))) <> payload_count
    from jsonb_to_recordset(stage_payload) as item(id uuid, name text, color text, position integer)
  ) then raise exception 'Aşama adı ve sırası benzersiz olmalı.'; end if;

  -- Move unique values out of the way inside the locked transaction so name or
  -- position swaps cannot fail halfway through the single statement update.
  update public.production_stages
  set name = '__renkflow_tmp_' || id::text,
      position = position + 1000
  where organization_id = target_organization;

  update public.production_stages as stage
  set name = trim(item.name), color = lower(item.color), position = item.position
  from jsonb_to_recordset(stage_payload) as item(id uuid, name text, color text, position integer)
  where stage.id = item.id and stage.organization_id = target_organization;

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    target_organization,
    auth.uid(),
    'production_stages.updated',
    'organization',
    target_organization::text,
    jsonb_build_object('stage_count', payload_count)
  );
end;
$$;

create or replace function public.search_orders(
  target_organization uuid,
  search_term text default null,
  target_status public.order_status default null
)
returns table (
  id uuid,
  order_number text,
  customer_name text,
  project_name text,
  customer_reference text,
  status public.order_status,
  created_at timestamptz,
  document_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    orders.id,
    orders.order_number,
    orders.customer_name,
    orders.project_name,
    orders.customer_reference,
    orders.status,
    orders.created_at,
    (select count(*) from public.documents where documents.order_id = orders.id) as document_count
  from public.orders
  where orders.organization_id = target_organization
    and public.is_org_member(target_organization)
    and (target_status is null or orders.status = target_status)
    and (
      nullif(trim(search_term), '') is null
      or orders.order_number ilike '%' || trim(search_term) || '%'
      or coalesce(orders.customer_name, '') ilike '%' || trim(search_term) || '%'
      or coalesce(orders.project_name, '') ilike '%' || trim(search_term) || '%'
      or coalesce(orders.customer_reference, '') ilike '%' || trim(search_term) || '%'
    )
  order by orders.created_at desc
  limit 500;
$$;

revoke all on function public.activate_rule_set(uuid) from public, anon, authenticated;
revoke all on function public.update_production_stages(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.search_orders(uuid, text, public.order_status) from public, anon, authenticated;
grant execute on function public.activate_rule_set(uuid) to authenticated;
grant execute on function public.update_production_stages(uuid, jsonb) to authenticated;
grant execute on function public.search_orders(uuid, text, public.order_status) to authenticated;

create or replace function public.create_order(
  target_organization uuid,
  target_customer_name text default null,
  target_project_name text default null,
  target_customer_reference text default null,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_order_id uuid;
  new_order_number text;
begin
  if not public.has_org_role(
    target_organization,
    array['owner','admin','office']::public.organization_role[]
  ) then raise exception 'Bu işlem için yetkiniz yok.'; end if;

  if char_length(coalesce(target_customer_name, '')) > 160
    or char_length(coalesce(target_project_name, '')) > 160
    or char_length(coalesce(target_customer_reference, '')) > 120
    or char_length(coalesce(target_notes, '')) > 5000
  then raise exception 'Sipariş bilgileri geçersiz.'; end if;

  new_order_id := gen_random_uuid();
  new_order_number := 'RF-' || extract(year from current_date)::integer::text || '-'
    || upper(substring(replace(new_order_id::text, '-', '') from 1 for 8));

  insert into public.orders (
    id, organization_id, order_number, customer_name, project_name,
    customer_reference, notes, created_by
  ) values (
    new_order_id,
    target_organization,
    new_order_number,
    nullif(trim(target_customer_name), ''),
    nullif(trim(target_project_name), ''),
    nullif(trim(target_customer_reference), ''),
    nullif(trim(target_notes), ''),
    auth.uid()
  );

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (target_organization, auth.uid(), 'order.created', 'order', new_order_id::text);

  return new_order_id;
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, text) to authenticated;

create or replace function public.update_order_details(
  target_organization uuid,
  target_order uuid,
  target_customer_name text default null,
  target_project_name text default null,
  target_customer_reference text default null,
  target_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.orders%rowtype;
begin
  if not public.has_org_role(
    target_organization,
    array['owner','admin','office']::public.organization_role[]
  ) then raise exception 'Bu işlem için yetkiniz yok.'; end if;

  select * into current_order from public.orders
  where id = target_order and organization_id = target_organization
  for update;
  if not found then raise exception 'Sipariş bulunamadı.'; end if;
  if current_order.status not in ('draft', 'awaiting_review', 'approved') then
    raise exception 'Üretime alınmış veya kapanmış sipariş düzenlenemez.';
  end if;

  if char_length(coalesce(target_customer_name, '')) > 160
    or char_length(coalesce(target_project_name, '')) > 160
    or char_length(coalesce(target_customer_reference, '')) > 120
    or char_length(coalesce(target_notes, '')) > 5000
  then raise exception 'Sipariş bilgileri geçersiz.'; end if;

  update public.orders set
    customer_name = nullif(trim(target_customer_name), ''),
    project_name = nullif(trim(target_project_name), ''),
    customer_reference = nullif(trim(target_customer_reference), ''),
    notes = nullif(trim(target_notes), '')
  where id = target_order and organization_id = target_organization;

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (target_organization, auth.uid(), 'order.updated', 'order', target_order::text);
end;
$$;

create or replace function public.cancel_order(target_organization uuid, target_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.orders%rowtype;
begin
  if not public.has_org_role(
    target_organization,
    array['owner','admin','office']::public.organization_role[]
  ) then raise exception 'Bu işlem için yetkiniz yok.'; end if;

  select * into current_order from public.orders
  where id = target_order and organization_id = target_organization
  for update;
  if not found then raise exception 'Sipariş bulunamadı.'; end if;
  if current_order.status not in ('draft', 'awaiting_review', 'approved') then
    raise exception 'Üretime alınmış veya kapanmış sipariş iptal edilemez.';
  end if;

  update public.orders set status = 'cancelled'
  where id = target_order and organization_id = target_organization;

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (target_organization, auth.uid(), 'order.cancelled', 'order', target_order::text);
end;
$$;

revoke all on function public.update_order_details(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.cancel_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.update_order_details(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.cancel_order(uuid, uuid) to authenticated;
