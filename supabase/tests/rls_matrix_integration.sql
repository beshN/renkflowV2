begin;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000001', 'owner-a@example.test', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000002', 'owner-b@example.test', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000003', 'production-a@example.test', '{}'::jsonb);

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-0000-0000-000000000001', 'Test A', 'test-a', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'Test B', 'test-b', '00000000-0000-0000-0000-000000000002');

insert into public.organization_members (organization_id, user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'production'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'owner');

insert into public.orders (id, organization_id, order_number, status, created_by)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A-1', 'approved', '00000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'B-1', 'approved', '00000000-0000-0000-0000-000000000002');

insert into public.production_stages (id, organization_id, name, position)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Aşama A', 1),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Aşama A2', 2),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Aşama B', 1);

insert into storage.objects (bucket_id, name)
values
  ('order-documents', '10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/a.pdf'),
  ('order-documents', '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/b.pdf');

insert into public.organization_invites (
  id, organization_id, email, role, token_hash, invited_by, expires_at
)
values (
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'owner-a@example.test',
  'admin',
  encode(extensions.digest('owner-must-stay-owner', 'sha256'), 'hex'),
  '00000000-0000-0000-0000-000000000001',
  now() + interval '1 day'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

do $$
begin
  if (select count(*) from public.orders) <> 1 then
    raise exception 'rls_order_isolation_failed';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'order-documents') <> 1 then
    raise exception 'rls_storage_isolation_failed';
  end if;

  begin
    insert into public.orders (organization_id, order_number, created_by)
    values (
      '10000000-0000-0000-0000-000000000002',
      'B-UNAUTHORIZED',
      '00000000-0000-0000-0000-000000000001'
    );
    raise exception 'cross_tenant_order_insert_was_allowed';
  exception when insufficient_privilege then
    null;
  end;

  update public.organization_members
  set role = 'admin'
  where organization_id = '10000000-0000-0000-0000-000000000001'
    and user_id = '00000000-0000-0000-0000-000000000001';
  if found then
    raise exception 'owner_role_was_mutable';
  end if;
end;
$$;

select public.accept_organization_invite('owner-must-stay-owner');

do $$
begin
  if (
    select role from public.organization_members
    where organization_id = '10000000-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-000000000001'
  ) <> 'owner' then
    raise exception 'duplicate_invite_downgraded_owner';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);

do $$
begin
  begin
    insert into public.orders (organization_id, order_number, created_by)
    values (
      '10000000-0000-0000-0000-000000000001',
      'A-PRODUCTION-UNAUTHORIZED',
      '00000000-0000-0000-0000-000000000003'
    );
    raise exception 'production_order_insert_was_allowed';
  exception when insufficient_privilege then
    null;
  end;

  perform public.advance_order_stage(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'started',
    null
  );

  begin
    perform public.advance_order_stage(
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000003',
      'started',
      null
    );
    raise exception 'production_stage_skip_was_allowed';
  exception when raise_exception then
    if sqlerrm = 'production_stage_skip_was_allowed' then
      raise;
    end if;
    if sqlerrm <> 'Üretim sırası değişti. Sayfayı yenileyip tekrar deneyin.' then
      raise;
    end if;
  end;

  perform public.advance_order_stage(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'completed',
    null
  );

  if (select status from public.orders where id = '20000000-0000-0000-0000-000000000001') <> 'ready' then
    raise exception 'penultimate_stage_did_not_mark_order_ready';
  end if;

  perform public.advance_order_stage(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000003',
    'started',
    null
  );

  perform public.advance_order_stage(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000003',
    'completed',
    null
  );

  if (select status from public.orders where id = '20000000-0000-0000-0000-000000000001') <> 'delivered' then
    raise exception 'final_stage_did_not_mark_order_delivered';
  end if;

  begin
    insert into public.order_stage_events (
      organization_id, order_id, stage_id, event_type, created_by
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000001',
      'started',
      '00000000-0000-0000-0000-000000000003'
    );
    raise exception 'cross_tenant_stage_event_was_allowed';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

reset role;
select 'rls_matrix_passed' as result;
rollback;
