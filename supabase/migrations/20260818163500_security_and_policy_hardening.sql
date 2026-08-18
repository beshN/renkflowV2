-- Remove Supabase's default function grants before adding the minimum required RPC access.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.is_org_member(uuid) from public, anon, authenticated;
revoke all on function public.has_org_role(uuid, public.organization_role[]) from public, anon, authenticated;
revoke all on function public.create_organization(text) from public, anon, authenticated;
revoke all on function public.accept_organization_invite(text) from public, anon, authenticated;
revoke all on function public.review_analysis(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.activate_rule_set(uuid) from public, anon, authenticated;

grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.accept_organization_invite(text) to authenticated;
grant execute on function public.review_analysis(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.activate_rule_set(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.organization_role[]) to authenticated;

-- Cache auth.uid() once per statement and collapse overlapping permissive policies.
drop policy if exists profiles_self_select on public.profiles;
drop policy if exists profiles_coworkers_select on public.profiles;
create policy profiles_member_select on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1 from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
  )
);

alter policy profiles_self_update on public.profiles
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

alter policy invites_admin_insert on public.organization_invites
with check (
  invited_by = (select auth.uid())
  and role <> 'owner'
  and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[])
);

alter policy orders_office_insert on public.orders
with check (
  created_by = (select auth.uid())
  and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[])
);

alter policy documents_office_insert on public.documents
with check (
  uploaded_by = (select auth.uid())
  and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[])
);

alter policy analyses_office_insert on public.document_analyses
with check (
  created_by = (select auth.uid())
  and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[])
);

alter policy corrections_office_insert on public.analysis_corrections
with check (
  corrected_by = (select auth.uid())
  and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[])
);

drop policy if exists stages_admin_all on public.production_stages;
create policy stages_admin_insert on public.production_stages for insert to authenticated
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy stages_admin_update on public.production_stages for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy stages_admin_delete on public.production_stages for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

alter policy stage_events_production_insert on public.order_stage_events
with check (
  created_by = (select auth.uid())
  and public.has_org_role(organization_id, array['owner','admin','office','production']::public.organization_role[])
);

alter policy rule_sets_admin_insert on public.calculation_rule_sets
with check (
  created_by = (select auth.uid())
  and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[])
);

alter policy calculation_runs_office_insert on public.calculation_runs
with check (
  created_by = (select auth.uid())
  and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[])
);

alter policy audit_logs_member_insert on public.audit_logs
with check (
  actor_id = (select auth.uid())
  and public.is_org_member(organization_id)
);
