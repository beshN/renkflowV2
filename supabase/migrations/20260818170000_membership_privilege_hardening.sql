-- Owners cannot be downgraded through the generic membership update policy.
alter policy members_admin_update on public.organization_members
using (
  role <> 'owner'
  and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[])
)
with check (
  role <> 'owner'
  and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[])
);

-- Accepting a duplicate invitation must never replace an existing membership role.
create or replace function public.accept_organization_invite(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.organization_invites%rowtype;
  current_email text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;

  select lower(email) into current_email from auth.users where id = auth.uid();
  select * into invite_row
  from public.organization_invites
  where token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if invite_row.id is null then raise exception 'invalid_or_expired_invite'; end if;
  if current_email is distinct from invite_row.email then raise exception 'invite_email_mismatch'; end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (invite_row.organization_id, auth.uid(), invite_row.role)
  on conflict (organization_id, user_id) do nothing;

  update public.organization_invites set accepted_at = now() where id = invite_row.id;
  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (invite_row.organization_id, auth.uid(), 'invite.accepted', 'organization_invite', invite_row.id::text);

  return invite_row.organization_id;
end;
$$;

revoke all on function public.accept_organization_invite(text) from public, anon, authenticated;
grant execute on function public.accept_organization_invite(text) to authenticated;
