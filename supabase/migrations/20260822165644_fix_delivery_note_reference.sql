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
