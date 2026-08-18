revoke all on function public.audit_business_module_change() from public, anon, authenticated;

create index crm_customers_created_by_idx on public.crm_customers (created_by);
create index suppliers_created_by_idx on public.suppliers (created_by);
create index inventory_items_created_by_idx on public.inventory_items (created_by);
create index financial_records_created_by_idx on public.financial_records (created_by);

drop policy crm_customers_office_insert on public.crm_customers;
create policy crm_customers_office_insert on public.crm_customers for insert to authenticated
with check (created_by = (select auth.uid()) and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]));

drop policy suppliers_office_insert on public.suppliers;
create policy suppliers_office_insert on public.suppliers for insert to authenticated
with check (created_by = (select auth.uid()) and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]));

drop policy inventory_items_office_insert on public.inventory_items;
create policy inventory_items_office_insert on public.inventory_items for insert to authenticated
with check (created_by = (select auth.uid()) and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]));

drop policy financial_records_admin_insert on public.financial_records;
create policy financial_records_admin_insert on public.financial_records for insert to authenticated
with check (created_by = (select auth.uid()) and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
