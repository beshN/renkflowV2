alter table public.orders add column if not exists planned_delivery_date date;
create index if not exists idx_orders_org_planned_delivery on public.orders (organization_id, planned_delivery_date) where planned_delivery_date is not null;

drop function if exists public.create_order(uuid, text, text, text, text);
create function public.create_order(
  target_organization uuid,
  target_customer_name text default null,
  target_project_name text default null,
  target_customer_reference text default null,
  target_notes text default null,
  target_planned_delivery_date date default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_order_id uuid; new_order_number text;
begin
  if not public.has_org_role(target_organization, array['owner','admin','office']::public.organization_role[]) then raise exception 'Bu işlem için yetkiniz yok.'; end if;
  if char_length(coalesce(target_customer_name, '')) > 160 or char_length(coalesce(target_project_name, '')) > 160 or char_length(coalesce(target_customer_reference, '')) > 120 or char_length(coalesce(target_notes, '')) > 5000 then raise exception 'Sipariş bilgileri geçersiz.'; end if;
  new_order_id := gen_random_uuid();
  new_order_number := 'RF-' || extract(year from current_date)::integer::text || '-' || upper(substring(replace(new_order_id::text, '-', '') from 1 for 8));
  insert into public.orders (id, organization_id, order_number, customer_name, project_name, customer_reference, notes, planned_delivery_date, created_by)
  values (new_order_id, target_organization, new_order_number, nullif(trim(target_customer_name), ''), nullif(trim(target_project_name), ''), nullif(trim(target_customer_reference), ''), nullif(trim(target_notes), ''), target_planned_delivery_date, auth.uid());
  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id) values (target_organization, auth.uid(), 'order.created', 'order', new_order_id::text);
  return new_order_id;
end;
$$;
revoke all on function public.create_order(uuid, text, text, text, text, date) from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, text, text, text, date) to authenticated;

drop function if exists public.update_order_details(uuid, uuid, text, text, text, text);
create function public.update_order_details(
  target_organization uuid,
  target_order uuid,
  target_customer_name text default null,
  target_project_name text default null,
  target_customer_reference text default null,
  target_notes text default null,
  target_planned_delivery_date date default null
) returns void language plpgsql security definer set search_path = '' as $$
declare current_order public.orders%rowtype;
begin
  if not public.has_org_role(target_organization, array['owner','admin','office']::public.organization_role[]) then raise exception 'Bu işlem için yetkiniz yok.'; end if;
  select * into current_order from public.orders where id = target_order and organization_id = target_organization for update;
  if not found then raise exception 'Sipariş bulunamadı.'; end if;
  if current_order.status not in ('draft', 'awaiting_review', 'approved') then raise exception 'Üretime alınmış veya kapanmış sipariş düzenlenemez.'; end if;
  if char_length(coalesce(target_customer_name, '')) > 160 or char_length(coalesce(target_project_name, '')) > 160 or char_length(coalesce(target_customer_reference, '')) > 120 or char_length(coalesce(target_notes, '')) > 5000 then raise exception 'Sipariş bilgileri geçersiz.'; end if;
  update public.orders set customer_name = nullif(trim(target_customer_name), ''), project_name = nullif(trim(target_project_name), ''), customer_reference = nullif(trim(target_customer_reference), ''), notes = nullif(trim(target_notes), ''), planned_delivery_date = target_planned_delivery_date where id = target_order and organization_id = target_organization;
  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id) values (target_organization, auth.uid(), 'order.updated', 'order', target_order::text);
end;
$$;
revoke all on function public.update_order_details(uuid, uuid, text, text, text, text, date) from public, anon, authenticated;
grant execute on function public.update_order_details(uuid, uuid, text, text, text, text, date) to authenticated;
