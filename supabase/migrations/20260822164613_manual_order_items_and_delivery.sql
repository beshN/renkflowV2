alter table public.orders
  add column delivered_at timestamptz,
  add column delivered_by uuid references public.profiles(id),
  add column delivery_note text check (char_length(delivery_note) <= 1000);

-- Earlier production progression marked the penultimate stage as ready and the
-- final stage as delivered. Reconcile those machine-generated states before the
-- new explicit delivery confirmation becomes active.
update public.orders
set status = 'ready'
where status = 'delivered' and delivered_at is null;

update public.orders target_order
set status = 'in_production'
where target_order.status = 'ready'
  and exists (
    select 1
    from public.production_stages stage
    where stage.organization_id = target_order.organization_id
      and stage.is_active
      and not exists (
        select 1
        from public.order_stage_events event
        where event.organization_id = target_order.organization_id
          and event.order_id = target_order.id
          and event.stage_id = stage.id
          and event.event_type = 'completed'
      )
  );

drop policy if exists order_items_office_insert on public.order_items;
drop policy if exists order_items_office_update on public.order_items;
drop policy if exists order_items_admin_delete on public.order_items;

create or replace function public.save_manual_order_items(
  target_organization uuid,
  target_order uuid,
  item_payload jsonb,
  approve_order boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_order public.orders%rowtype;
  item jsonb;
  item_index integer;
  quantity_value integer;
  width_value numeric(12,2);
  height_value numeric(12,2);
begin
  if actor_id is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  if not public.has_org_role(
    target_organization,
    array['owner', 'admin', 'office']::public.organization_role[]
  ) then
    raise exception 'Bu işlem için yetkiniz yok.';
  end if;

  if jsonb_typeof(item_payload) <> 'array'
    or jsonb_array_length(item_payload) < 1
    or jsonb_array_length(item_payload) > 250 then
    raise exception 'Siparişte 1 ile 250 arasında ürün satırı olmalıdır.';
  end if;

  select *
  into current_order
  from public.orders
  where id = target_order and organization_id = target_organization
  for update;

  if not found then
    raise exception 'Sipariş bulunamadı.';
  end if;

  if current_order.status not in ('draft', 'awaiting_review', 'approved') then
    raise exception 'Üretime alınmış veya kapanmış sipariş değiştirilemez.';
  end if;

  if current_order.status = 'approved' and not approve_order then
    raise exception 'Onaylı siparişteki değişiklikler yeniden onaylanmalıdır.';
  end if;

  if approve_order and exists (
    select 1
    from public.document_analyses
    where organization_id = target_organization
      and order_id = target_order
      and status in ('queued', 'running')
  ) then
    raise exception 'Çalışan PDF analizinin tamamlanmasını bekleyin.';
  end if;

  for item, item_index in
    select value, ordinality::integer
    from jsonb_array_elements(item_payload) with ordinality
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Ürün satırı biçimi geçersiz.';
    end if;

    if coalesce(item ->> 'quantity', '') !~ '^[1-9][0-9]*$' then
      raise exception '%. satırın adedi geçersiz.', item_index;
    end if;
    quantity_value := (item ->> 'quantity')::integer;
    if quantity_value > 1000000 then
      raise exception '%. satırın adedi çok yüksek.', item_index;
    end if;

    if nullif(item ->> 'widthMm', '') is not null then
      if item ->> 'widthMm' !~ '^[0-9]+([.][0-9]{1,2})?$' then
        raise exception '%. satırın genişliği geçersiz.', item_index;
      end if;
      width_value := (item ->> 'widthMm')::numeric;
      if width_value <= 0 or width_value > 9999999999.99 then
        raise exception '%. satırın genişliği geçersiz.', item_index;
      end if;
    else
      width_value := null;
    end if;

    if nullif(item ->> 'heightMm', '') is not null then
      if item ->> 'heightMm' !~ '^[0-9]+([.][0-9]{1,2})?$' then
        raise exception '%. satırın yüksekliği geçersiz.', item_index;
      end if;
      height_value := (item ->> 'heightMm')::numeric;
      if height_value <= 0 or height_value > 9999999999.99 then
        raise exception '%. satırın yüksekliği geçersiz.', item_index;
      end if;
    else
      height_value := null;
    end if;

    if char_length(coalesce(item ->> 'lightColor', '')) > 120
      or char_length(coalesce(item ->> 'profileType', '')) > 120
      or char_length(coalesce(item ->> 'motorType', '')) > 120
      or char_length(coalesce(item ->> 'notes', '')) > 2000 then
      raise exception '%. satırdaki metin alanlarından biri çok uzun.', item_index;
    end if;
  end loop;

  delete from public.order_items
  where organization_id = target_organization and order_id = target_order;

  for item, item_index in
    select value, ordinality::integer
    from jsonb_array_elements(item_payload) with ordinality
  loop
    insert into public.order_items (
      organization_id,
      order_id,
      line_number,
      quantity,
      width_mm,
      height_mm,
      light_color,
      profile_type,
      motor_type,
      notes,
      source_page,
      verified_data
    ) values (
      target_organization,
      target_order,
      item_index,
      (item ->> 'quantity')::integer,
      nullif(item ->> 'widthMm', '')::numeric,
      nullif(item ->> 'heightMm', '')::numeric,
      nullif(trim(item ->> 'lightColor'), ''),
      nullif(trim(item ->> 'profileType'), ''),
      nullif(trim(item ->> 'motorType'), ''),
      nullif(trim(item ->> 'notes'), ''),
      null,
      jsonb_build_object(
        'source', 'manual',
        'verifiedBy', actor_id,
        'verifiedAt', now()
      )
    );
  end loop;

  if approve_order then
    update public.document_analyses
    set
      status = 'failed',
      error_message = 'Manuel sipariş girişi tercih edildi; AI sonucu uygulanmadı.',
      completed_at = now()
    where organization_id = target_organization
      and order_id = target_order
      and status = 'needs_review';

    update public.orders
    set status = 'approved', approved_at = now(), approved_by = actor_id
    where id = target_order and organization_id = target_organization;
  end if;

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    target_organization,
    actor_id,
    case when approve_order then 'order.manually_approved' else 'order.manual_items_saved' end,
    'order',
    target_order,
    jsonb_build_object('item_count', jsonb_array_length(item_payload))
  );
end;
$$;

revoke all on function public.save_manual_order_items(uuid, uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.save_manual_order_items(uuid, uuid, jsonb, boolean) to authenticated;

create or replace function public.mark_order_delivered(
  target_organization uuid,
  target_order uuid,
  delivery_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_order public.orders%rowtype;
begin
  if actor_id is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  if not public.has_org_role(
    target_organization,
    array['owner', 'admin', 'office']::public.organization_role[]
  ) then
    raise exception 'Teslim işlemi için yetkiniz yok.';
  end if;

  if char_length(coalesce($3, '')) > 1000 then
    raise exception 'Teslim notu en fazla 1000 karakter olabilir.';
  end if;

  select *
  into current_order
  from public.orders
  where id = target_order and organization_id = target_organization
  for update;

  if not found then
    raise exception 'Sipariş bulunamadı.';
  end if;

  if current_order.status <> 'ready' then
    raise exception 'Yalnızca üretimi tamamlanmış sipariş teslim edilebilir.';
  end if;

  if exists (
    select 1
    from public.production_stages stage
    where stage.organization_id = target_organization
      and stage.is_active
      and not exists (
        select 1
        from public.order_stage_events event
        where event.organization_id = target_organization
          and event.order_id = target_order
          and event.stage_id = stage.id
          and event.event_type = 'completed'
      )
  ) then
    raise exception 'Tüm üretim aşamaları tamamlanmadan teslim kaydı oluşturulamaz.';
  end if;

  update public.orders
  set
    status = 'delivered',
    delivered_at = now(),
    delivered_by = actor_id,
    delivery_note = nullif(trim($3), '')
  where id = target_order and organization_id = target_organization;

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    target_organization,
    actor_id,
    'order.delivered',
    'order',
    target_order,
    jsonb_build_object('note', nullif(trim($3), ''))
  );
end;
$$;

revoke all on function public.mark_order_delivered(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.mark_order_delivered(uuid, uuid, text) to authenticated;

create or replace function public.advance_order_stage(
  target_organization uuid,
  target_order uuid,
  target_stage uuid,
  requested_event text,
  event_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_order public.orders%rowtype;
  requested_stage public.production_stages%rowtype;
  latest_event public.order_stage_events%rowtype;
  latest_stage_position integer;
  expected_stage public.production_stages%rowtype;
  expected_event text;
  remaining_stage_count integer;
begin
  if actor_id is null then raise exception 'Oturum bulunamadı.'; end if;
  if not public.has_org_role(
    target_organization,
    array['owner', 'admin', 'office', 'production']::public.organization_role[]
  ) then raise exception 'Bu işlem için yetkiniz yok.'; end if;

  select * into current_order
  from public.orders
  where id = target_order and organization_id = target_organization
  for update;
  if not found then raise exception 'Sipariş bulunamadı.'; end if;
  if current_order.status not in ('approved', 'in_production', 'ready') then
    raise exception 'Sipariş üretime ilerletilebilecek durumda değil.';
  end if;

  select * into requested_stage
  from public.production_stages
  where id = target_stage and organization_id = target_organization;
  if not found then raise exception 'Üretim aşaması bulunamadı.'; end if;

  select * into latest_event
  from public.order_stage_events
  where organization_id = target_organization
    and order_id = target_order
    and event_type <> 'note'
  order by created_at desc, id desc
  limit 1;

  if not found then
    select * into expected_stage
    from public.production_stages
    where organization_id = target_organization and is_active
    order by position
    limit 1;
    if not found then raise exception 'Etkin üretim aşaması bulunamadı.'; end if;
    expected_event := 'started';
  elsif latest_event.event_type in ('started', 'reopened') then
    select * into expected_stage
    from public.production_stages
    where id = latest_event.stage_id and organization_id = target_organization;
    expected_event := 'completed';
  elsif latest_event.event_type = 'completed' then
    select position into latest_stage_position
    from public.production_stages
    where id = latest_event.stage_id and organization_id = target_organization;

    select * into expected_stage
    from public.production_stages
    where organization_id = target_organization
      and is_active
      and position > latest_stage_position
    order by position
    limit 1;
    if not found then raise exception 'Üretim süreci zaten tamamlandı.'; end if;
    expected_event := 'started';
  else
    raise exception 'Üretim zaman çizelgesi geçersiz durumda.';
  end if;

  if requested_event <> expected_event or target_stage <> expected_stage.id then
    raise exception 'Üretim sırası değişti. Sayfayı yenileyip tekrar deneyin.';
  end if;
  if expected_event = 'started' and not expected_stage.is_active then
    raise exception 'Bu üretim aşaması etkin değil.';
  end if;

  insert into public.order_stage_events (
    organization_id, order_id, stage_id, event_type, note, created_by
  ) values (
    target_organization, target_order, target_stage, requested_event,
    nullif(trim(event_note), ''), actor_id
  );

  if requested_event = 'started' then
    if current_order.status = 'approved' then
      update public.orders set status = 'in_production'
      where id = target_order and organization_id = target_organization;
    end if;
  else
    select count(*) into remaining_stage_count
    from public.production_stages
    where organization_id = target_organization
      and is_active
      and position > requested_stage.position;

    update public.orders
    set status = case
      when remaining_stage_count = 0 then 'ready'::public.order_status
      else 'in_production'::public.order_status
    end
    where id = target_order and organization_id = target_organization;
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    target_organization, actor_id,
    'order.production_stage_' || requested_event,
    'order', target_order,
    jsonb_build_object('stage_id', target_stage, 'stage_name', requested_stage.name)
  );
end;
$$;

revoke all on function public.advance_order_stage(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.advance_order_stage(uuid, uuid, uuid, text, text) to authenticated;
