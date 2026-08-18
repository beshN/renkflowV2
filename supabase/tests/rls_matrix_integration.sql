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

insert into public.documents (
  id, organization_id, order_id, original_name, storage_path, size_bytes,
  page_count, sha256, uploaded_by
)
values
  (
    '21000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'a.pdf',
    '10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/a.pdf',
    10,
    1,
    repeat('a', 64),
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'b.pdf',
    '10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000002/b.pdf',
    10,
    1,
    repeat('a', 64),
    '00000000-0000-0000-0000-000000000002'
  );

insert into public.document_analyses (
  id, organization_id, order_id, document_id, dedupe_key, model_requested,
  prompt_version, schema_version, created_by
)
values
  (
    '22000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001',
    repeat('d', 64),
    'test/model',
    'test-prompt',
    'test-schema',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '22000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '21000000-0000-0000-0000-000000000002',
    repeat('d', 64),
    'test/model',
    'test-prompt',
    'test-schema',
    '00000000-0000-0000-0000-000000000002'
  );

do $$
begin
  begin
    insert into public.document_analyses (
      organization_id, order_id, document_id, dedupe_key, model_requested,
      prompt_version, schema_version, created_by
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '21000000-0000-0000-0000-000000000001',
      repeat('d', 64),
      'test/model',
      'test-prompt',
      'test-schema',
      '00000000-0000-0000-0000-000000000001'
    );
    raise exception 'same_document_dedupe_was_allowed';
  exception when unique_violation then
    null;
  end;
end;
$$;

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

  begin
    insert into public.document_analyses (
      organization_id, order_id, document_id, dedupe_key, model_requested,
      prompt_version, schema_version, reused_from_analysis_id, created_by
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      '21000000-0000-0000-0000-000000000001',
      repeat('x', 64),
      'test/model',
      'test-prompt',
      'test-schema',
      '22000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000001'
    );
    raise exception 'cross_tenant_analysis_reuse_was_allowed';
  exception when foreign_key_violation then
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

do $$
begin
  begin
    perform public.update_production_stages(
      '10000000-0000-0000-0000-000000000001',
      '[{"id":"30000000-0000-0000-0000-000000000001","name":"Aşama A","color":"#157347","position":1},{"id":"30000000-0000-0000-0000-000000000003","name":"Aşama A2","color":"#157347","position":2}]'::jsonb
    );
    raise exception 'production_user_updated_stage_settings';
  exception when raise_exception then
    if sqlerrm = 'production_user_updated_stage_settings' then raise; end if;
    if sqlerrm <> 'Bu işlem için yetkiniz yok.' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

do $$
declare
  search_count integer;
  created_order uuid;
begin
  select count(*) into search_count
  from public.search_orders('10000000-0000-0000-0000-000000000001', 'A-1', null);
  if search_count <> 1 then raise exception 'tenant_order_search_failed'; end if;

  created_order := public.create_order(
    '10000000-0000-0000-0000-000000000001',
    'Atomik Müşteri',
    'Atomik Proje',
    null,
    null
  );
  if not exists (
    select 1 from public.audit_logs
    where organization_id = '10000000-0000-0000-0000-000000000001'
      and action = 'order.created' and entity_id = created_order::text
  ) then raise exception 'atomic_order_audit_missing'; end if;

  perform public.update_order_details(
    '10000000-0000-0000-0000-000000000001', created_order,
    'Güncel Müşteri', 'Güncel Proje', null, null
  );
  perform public.cancel_order('10000000-0000-0000-0000-000000000001', created_order);
  if (select status from public.orders where id = created_order) <> 'cancelled' then
    raise exception 'atomic_order_cancel_failed';
  end if;

  perform public.update_production_stages(
    '10000000-0000-0000-0000-000000000001',
    '[{"id":"30000000-0000-0000-0000-000000000001","name":"Hazırlık","color":"#157347","position":1},{"id":"30000000-0000-0000-0000-000000000003","name":"Teslim","color":"#2455aa","position":2}]'::jsonb
  );
end;
$$;

insert into public.calculation_rule_sets (
  id, organization_id, name, version, rules_ast, created_by
)
values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Kural A', 1, '{"version":1,"rules":[]}', '00000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Kural B', 1, '{"version":1,"rules":[]}', '00000000-0000-0000-0000-000000000001');

select public.activate_rule_set('50000000-0000-0000-0000-000000000001');
select public.activate_rule_set('50000000-0000-0000-0000-000000000002');

do $$
begin
  if (
    select count(*) from public.calculation_rule_sets
    where organization_id = '10000000-0000-0000-0000-000000000001' and status = 'active'
  ) <> 1 then raise exception 'multiple_rule_sets_remained_active'; end if;
end;
$$;

reset role;
select 'rls_matrix_passed' as result;
rollback;
