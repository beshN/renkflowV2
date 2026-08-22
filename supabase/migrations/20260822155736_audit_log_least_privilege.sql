drop policy if exists audit_logs_member_select on public.audit_logs;
create policy audit_logs_admin_select
  on public.audit_logs for select to authenticated
  using (
    (select public.has_org_role(
      organization_id,
      array['owner','admin']::public.organization_role[]
    ))
  );

drop policy if exists audit_logs_member_insert on public.audit_logs;
revoke insert, update, delete on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
