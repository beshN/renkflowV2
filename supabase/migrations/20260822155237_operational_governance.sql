create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inventory_item_id uuid not null,
  movement_type text not null check (movement_type in ('receipt', 'consumption', 'increase_adjustment', 'decrease_adjustment')),
  quantity numeric(14,3) not null check (quantity > 0),
  previous_quantity numeric(14,3) not null check (previous_quantity >= 0),
  resulting_quantity numeric(14,3) not null check (resulting_quantity >= 0),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint inventory_movements_tenant_item_fkey
    foreign key (organization_id, inventory_item_id)
    references public.inventory_items (organization_id, id) on delete restrict
);

create index inventory_movements_org_created_idx
  on public.inventory_movements (organization_id, created_at desc);
create index inventory_movements_tenant_item_created_idx
  on public.inventory_movements (organization_id, inventory_item_id, created_at desc);

alter table public.inventory_movements enable row level security;

create policy inventory_movements_member_select
  on public.inventory_movements for select to authenticated
  using ((select public.is_org_member(organization_id)));

grant select on public.inventory_movements to authenticated;
revoke insert, update, delete on public.inventory_movements from anon, authenticated;

create trigger inventory_movements_immutable
before update or delete on public.inventory_movements
for each row execute function public.prevent_immutable_changes();

create or replace function public.guard_inventory_on_hand()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.on_hand is distinct from old.on_hand
    and current_user in ('anon', 'authenticated')
  then
    raise exception 'Stok miktarı yalnızca hareket kaydıyla değiştirilebilir.';
  end if;
  return new;
end;
$$;

create trigger inventory_items_guard_on_hand
before update of on_hand on public.inventory_items
for each row execute function public.guard_inventory_on_hand();

create or replace function public.record_inventory_movement(
  target_organization uuid,
  target_inventory_item uuid,
  target_movement_type text,
  target_quantity numeric,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.inventory_items%rowtype;
  movement_id uuid;
  quantity_delta numeric(14,3);
  next_quantity numeric(14,3);
begin
  if not public.has_org_role(
    target_organization,
    array['owner','admin','office','production']::public.organization_role[]
  ) then raise exception 'Bu işlem için yetkiniz yok.'; end if;

  if target_movement_type not in ('receipt', 'consumption', 'increase_adjustment', 'decrease_adjustment')
    or target_quantity is null
    or target_quantity <= 0
    or target_quantity > 999999999
    or char_length(coalesce(target_notes, '')) > 1000
  then raise exception 'Stok hareketi geçersiz.'; end if;

  select * into item_row
  from public.inventory_items
  where id = target_inventory_item and organization_id = target_organization
  for update;
  if not found then raise exception 'Stok kartı bulunamadı.'; end if;

  quantity_delta := case
    when target_movement_type in ('receipt', 'increase_adjustment') then target_quantity
    else -target_quantity
  end;
  next_quantity := item_row.on_hand + quantity_delta;
  if next_quantity < 0 then raise exception 'Stok miktarı sıfırın altına düşemez.'; end if;

  update public.inventory_items
  set on_hand = next_quantity
  where id = target_inventory_item and organization_id = target_organization;

  insert into public.inventory_movements (
    organization_id, inventory_item_id, movement_type, quantity,
    previous_quantity, resulting_quantity, notes, created_by
  ) values (
    target_organization, target_inventory_item, target_movement_type, target_quantity,
    item_row.on_hand, next_quantity, nullif(trim(target_notes), ''), auth.uid()
  ) returning id into movement_id;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    target_organization,
    auth.uid(),
    'inventory.movement_recorded',
    'inventory_item',
    target_inventory_item::text,
    jsonb_build_object(
      'movement_id', movement_id,
      'movement_type', target_movement_type,
      'quantity', target_quantity,
      'previous_quantity', item_row.on_hand,
      'resulting_quantity', next_quantity
    )
  );
  return movement_id;
end;
$$;

revoke all on function public.record_inventory_movement(uuid, uuid, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.record_inventory_movement(uuid, uuid, text, numeric, text)
  to authenticated;

create or replace function public.manage_organization_member(
  target_organization uuid,
  target_user uuid,
  requested_action text,
  requested_role public.organization_role default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.organization_role;
  target_role public.organization_role;
begin
  select role into actor_role
  from public.organization_members
  where organization_id = target_organization and user_id = auth.uid();
  if actor_role not in ('owner', 'admin') then raise exception 'Bu işlem için yetkiniz yok.'; end if;
  if target_user = auth.uid() then raise exception 'Kendi üyeliğinizi bu ekrandan değiştiremezsiniz.'; end if;

  select role into target_role
  from public.organization_members
  where organization_id = target_organization and user_id = target_user
  for update;
  if not found then raise exception 'Ekip üyesi bulunamadı.'; end if;
  if target_role = 'owner' then raise exception 'Kurucu üyeliği değiştirilemez.'; end if;
  if actor_role = 'admin' and target_role = 'admin' then raise exception 'Yöneticileri yalnızca kurucu değiştirebilir.'; end if;

  if requested_action = 'update_role' then
    if requested_role is null or requested_role = 'owner' then raise exception 'Geçersiz rol.'; end if;
    if actor_role = 'admin' and requested_role = 'admin' then raise exception 'Yönetici atamasını yalnızca kurucu yapabilir.'; end if;
    update public.organization_members
    set role = requested_role
    where organization_id = target_organization and user_id = target_user;
  elsif requested_action = 'remove' then
    delete from public.organization_members
    where organization_id = target_organization and user_id = target_user;
  else
    raise exception 'Geçersiz ekip işlemi.';
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    target_organization,
    auth.uid(),
    case when requested_action = 'remove' then 'member.removed' else 'member.role_updated' end,
    'organization_member',
    target_user::text,
    jsonb_build_object('previous_role', target_role, 'requested_role', requested_role)
  );
end;
$$;

revoke all on function public.manage_organization_member(uuid, uuid, text, public.organization_role)
  from public, anon, authenticated;
grant execute on function public.manage_organization_member(uuid, uuid, text, public.organization_role)
  to authenticated;

create or replace function public.revoke_organization_invite(
  target_organization uuid,
  target_invite uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare invite_email text;
begin
  if not public.has_org_role(
    target_organization,
    array['owner','admin']::public.organization_role[]
  ) then raise exception 'Bu işlem için yetkiniz yok.'; end if;

  update public.organization_invites
  set revoked_at = now()
  where id = target_invite
    and organization_id = target_organization
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  returning email into invite_email;
  if invite_email is null then raise exception 'Aktif davet bulunamadı.'; end if;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    target_organization,
    auth.uid(),
    'invite.revoked',
    'organization_invite',
    target_invite::text,
    jsonb_build_object('email', invite_email)
  );
end;
$$;

revoke all on function public.revoke_organization_invite(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_organization_invite(uuid, uuid)
  to authenticated;
