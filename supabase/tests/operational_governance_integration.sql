begin;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('01000000-0000-0000-0000-000000000001', 'governance-owner-a@example.test', '{}'::jsonb),
  ('01000000-0000-0000-0000-000000000002', 'governance-owner-b@example.test', '{}'::jsonb),
  ('01000000-0000-0000-0000-000000000003', 'governance-production@example.test', '{}'::jsonb);

insert into public.organizations (id, name, slug, created_by)
values
  ('11000000-0000-0000-0000-000000000001', 'Governance A', 'governance-a', '01000000-0000-0000-0000-000000000001'),
  ('11000000-0000-0000-0000-000000000002', 'Governance B', 'governance-b', '01000000-0000-0000-0000-000000000002');

insert into public.organization_members (organization_id, user_id, role)
values
  ('11000000-0000-0000-0000-000000000001', '01000000-0000-0000-0000-000000000001', 'owner'),
  ('11000000-0000-0000-0000-000000000001', '01000000-0000-0000-0000-000000000003', 'production'),
  ('11000000-0000-0000-0000-000000000002', '01000000-0000-0000-0000-000000000002', 'owner');

insert into public.inventory_items (
  id, organization_id, sku, name, unit, on_hand, reorder_level, created_by
) values
  ('51000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'A-STOCK', 'A Stoğu', 'adet', 10, 2, '01000000-0000-0000-0000-000000000001'),
  ('51000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'B-STOCK', 'B Stoğu', 'adet', 25, 2, '01000000-0000-0000-0000-000000000002');

insert into public.organization_invites (
  id, organization_id, email, role, token_hash, invited_by, expires_at
) values (
  '41000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'pending@example.test',
  'office',
  repeat('a', 64),
  '01000000-0000-0000-0000-000000000001',
  now() + interval '1 day'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '01000000-0000-0000-0000-000000000003', true);

select public.record_inventory_movement(
  '11000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  'consumption',
  3,
  'Üretim tüketim testi'
);

do $$
begin
  if (
    select on_hand from public.inventory_items
    where id = '51000000-0000-0000-0000-000000000001'
  ) <> 7 then raise exception 'inventory_balance_not_updated'; end if;
  if (
    select count(*) from public.inventory_movements
    where inventory_item_id = '51000000-0000-0000-0000-000000000001'
  ) <> 1 then raise exception 'movement_not_recorded'; end if;
  if (select count(*) from public.audit_logs) <> 0 then
    raise exception 'production_role_could_read_audit_logs';
  end if;

  update public.inventory_items set on_hand = 99
  where id = '51000000-0000-0000-0000-000000000001';
  if found then raise exception 'direct_inventory_update_was_allowed'; end if;
  if (
    select on_hand from public.inventory_items
    where id = '51000000-0000-0000-0000-000000000001'
  ) <> 7 then raise exception 'direct_inventory_update_changed_balance'; end if;

  begin
    insert into public.inventory_movements (
      organization_id, inventory_item_id, movement_type, quantity,
      previous_quantity, resulting_quantity, created_by
    ) values (
      '11000000-0000-0000-0000-000000000001',
      '51000000-0000-0000-0000-000000000001',
      'receipt', 1, 7, 8,
      '01000000-0000-0000-0000-000000000003'
    );
    raise exception 'direct_movement_insert_was_allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.audit_logs (
      organization_id, actor_id, action, entity_type
    ) values (
      '11000000-0000-0000-0000-000000000001',
      '01000000-0000-0000-0000-000000000003',
      'forged.event',
      'forged'
    );
    raise exception 'forged_audit_log_was_allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.record_inventory_movement(
      '11000000-0000-0000-0000-000000000001',
      '51000000-0000-0000-0000-000000000001',
      'consumption', 100, null
    );
    raise exception 'negative_inventory_was_allowed';
  exception when raise_exception then
    if sqlerrm = 'negative_inventory_was_allowed' then raise; end if;
  end;

  begin
    perform public.record_inventory_movement(
      '11000000-0000-0000-0000-000000000002',
      '51000000-0000-0000-0000-000000000002',
      'receipt', 1, null
    );
    raise exception 'cross_tenant_movement_was_allowed';
  exception when raise_exception then
    if sqlerrm = 'cross_tenant_movement_was_allowed' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '01000000-0000-0000-0000-000000000001', true);

select public.update_organization_settings(
  '11000000-0000-0000-0000-000000000001',
  'Governance A Güncel'
);

select public.manage_organization_member(
  '11000000-0000-0000-0000-000000000001',
  '01000000-0000-0000-0000-000000000003',
  'update_role',
  'office'
);

select set_config('request.jwt.claim.sub', '01000000-0000-0000-0000-000000000003', true);

do $$
begin
  begin
    update public.inventory_items set on_hand = 99
    where id = '51000000-0000-0000-0000-000000000001';
    raise exception 'office_direct_balance_update_was_allowed';
  exception when raise_exception then
    if sqlerrm = 'office_direct_balance_update_was_allowed' then raise; end if;
  end;
  if (
    select on_hand from public.inventory_items
    where id = '51000000-0000-0000-0000-000000000001'
  ) <> 7 then raise exception 'office_direct_balance_update_changed_balance'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', '01000000-0000-0000-0000-000000000001', true);

select public.revoke_organization_invite(
  '11000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000001'
);

do $$
begin
  if (
    select role from public.organization_members
    where organization_id = '11000000-0000-0000-0000-000000000001'
      and user_id = '01000000-0000-0000-0000-000000000003'
  ) <> 'office' then raise exception 'member_role_not_updated'; end if;
  if (
    select name from public.organizations
    where id = '11000000-0000-0000-0000-000000000001'
  ) <> 'Governance A Güncel' then raise exception 'organization_name_not_updated'; end if;
  if not exists (
    select 1 from public.organization_invites
    where id = '41000000-0000-0000-0000-000000000001'
      and revoked_at is not null
  ) then raise exception 'invite_not_revoked'; end if;
  if (select count(*) from public.inventory_movements) <> 1 then
    raise exception 'inventory_movement_tenant_isolation_failed';
  end if;
  if (select count(*) from public.audit_logs) < 3 then
    raise exception 'owner_could_not_read_audit_logs';
  end if;

  begin
    perform public.manage_organization_member(
      '11000000-0000-0000-0000-000000000001',
      '01000000-0000-0000-0000-000000000001',
      'update_role',
      'admin'
    );
    raise exception 'owner_self_change_was_allowed';
  exception when raise_exception then
    if sqlerrm = 'owner_self_change_was_allowed' then raise; end if;
  end;
end;
$$;

select public.manage_organization_member(
  '11000000-0000-0000-0000-000000000001',
  '01000000-0000-0000-0000-000000000003',
  'remove',
  null
);

do $$
begin
  if exists (
    select 1 from public.organization_members
    where organization_id = '11000000-0000-0000-0000-000000000001'
      and user_id = '01000000-0000-0000-0000-000000000003'
  ) then raise exception 'member_not_removed'; end if;
end;
$$;

rollback;
