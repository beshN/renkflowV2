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
  if actor_id is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  if not public.has_org_role(
    target_organization,
    array['owner', 'admin', 'office', 'production']::public.organization_role[]
  ) then
    raise exception 'Bu işlem için yetkiniz yok.';
  end if;

  select *
  into current_order
  from public.orders
  where id = target_order and organization_id = target_organization
  for update;

  if not found then
    raise exception 'Sipariş bulunamadı.';
  end if;

  if current_order.status not in ('approved', 'in_production', 'ready') then
    raise exception 'Sipariş üretime ilerletilebilecek durumda değil.';
  end if;

  select *
  into requested_stage
  from public.production_stages
  where id = target_stage and organization_id = target_organization;

  if not found then
    raise exception 'Üretim aşaması bulunamadı.';
  end if;

  select *
  into latest_event
  from public.order_stage_events
  where organization_id = target_organization
    and order_id = target_order
    and event_type <> 'note'
  order by created_at desc, id desc
  limit 1;

  if not found then
    select *
    into expected_stage
    from public.production_stages
    where organization_id = target_organization and is_active
    order by position
    limit 1;

    if not found then
      raise exception 'Etkin üretim aşaması bulunamadı.';
    end if;

    expected_event := 'started';
  elsif latest_event.event_type in ('started', 'reopened') then
    select *
    into expected_stage
    from public.production_stages
    where id = latest_event.stage_id and organization_id = target_organization;
    expected_event := 'completed';
  elsif latest_event.event_type = 'completed' then
    select position
    into latest_stage_position
    from public.production_stages
    where id = latest_event.stage_id and organization_id = target_organization;

    select *
    into expected_stage
    from public.production_stages
    where organization_id = target_organization
      and is_active
      and position > latest_stage_position
    order by position
    limit 1;

    if not found then
      raise exception 'Üretim süreci zaten tamamlandı.';
    end if;

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
    organization_id,
    order_id,
    stage_id,
    event_type,
    note,
    created_by
  ) values (
    target_organization,
    target_order,
    target_stage,
    requested_event,
    nullif(trim(event_note), ''),
    actor_id
  );

  if requested_event = 'started' then
    if current_order.status = 'approved' then
      update public.orders
      set status = 'in_production'
      where id = target_order and organization_id = target_organization;
    end if;
  else
    select count(*)
    into remaining_stage_count
    from public.production_stages
    where organization_id = target_organization
      and is_active
      and position > requested_stage.position;

    update public.orders
    set status = case
      when remaining_stage_count = 0 then 'delivered'::public.order_status
      when remaining_stage_count = 1 then 'ready'::public.order_status
      else 'in_production'::public.order_status
    end
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
    'order.production_stage_' || requested_event,
    'order',
    target_order,
    jsonb_build_object('stage_id', target_stage, 'stage_name', requested_stage.name)
  );
end;
$$;

revoke all on function public.advance_order_stage(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.advance_order_stage(uuid, uuid, uuid, text, text) to authenticated;
