create or replace function public.update_organization_settings(
  target_organization uuid,
  target_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare previous_name text;
begin
  if not public.has_org_role(
    target_organization,
    array['owner','admin']::public.organization_role[]
  ) then raise exception 'Bu işlem için yetkiniz yok.'; end if;
  if char_length(trim(coalesce(target_name, ''))) not between 2 and 120 then
    raise exception 'Şirket adı geçersiz.';
  end if;

  select name into previous_name
  from public.organizations
  where id = target_organization
  for update;
  if not found then raise exception 'Şirket bulunamadı.'; end if;

  update public.organizations
  set name = trim(target_name)
  where id = target_organization;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_type, entity_id,
    metadata
  ) values (
    target_organization,
    auth.uid(),
    'organization.updated',
    'organization',
    target_organization::text,
    jsonb_build_object('previous_name', previous_name, 'new_name', trim(target_name))
  );
end;
$$;

revoke all on function public.update_organization_settings(uuid, text)
  from public, anon, authenticated;
grant execute on function public.update_organization_settings(uuid, text)
  to authenticated;
