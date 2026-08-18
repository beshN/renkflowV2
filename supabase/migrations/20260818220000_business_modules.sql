create table public.crm_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 160),
  contact_person text,
  email text check (email is null or email = lower(email)),
  phone text,
  status text not null default 'active' check (status in ('prospect', 'active', 'inactive')),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 160),
  contact_person text,
  email text check (email is null or email = lower(email)),
  phone text,
  material_categories text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'paused', 'inactive')),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku text not null check (char_length(trim(sku)) between 1 and 80),
  name text not null check (char_length(trim(name)) between 2 and 180),
  category text,
  unit text not null default 'adet' check (unit in ('adet', 'metre', 'm2', 'kg', 'kutu')),
  on_hand numeric(14,3) not null default 0 check (on_hand >= 0),
  reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0),
  unit_cost numeric(14,2) check (unit_cost is null or unit_cost >= 0),
  currency text not null default 'TRY' check (currency in ('TRY', 'EUR', 'USD')),
  supplier_id uuid,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, sku),
  constraint inventory_items_tenant_supplier_fkey foreign key (organization_id, supplier_id)
    references public.suppliers (organization_id, id) on delete set null
);

create table public.financial_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_number text not null check (char_length(trim(record_number)) between 1 and 80),
  record_type text not null check (record_type in ('quote', 'invoice', 'payment', 'expense')),
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'overdue', 'cancelled')),
  order_id uuid,
  customer_id uuid,
  description text not null check (char_length(trim(description)) between 2 and 240),
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'TRY' check (currency in ('TRY', 'EUR', 'USD')),
  issue_date date not null default current_date,
  due_date date,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, record_number),
  constraint financial_records_tenant_order_fkey foreign key (organization_id, order_id)
    references public.orders (organization_id, id) on delete set null,
  constraint financial_records_tenant_customer_fkey foreign key (organization_id, customer_id)
    references public.crm_customers (organization_id, id) on delete set null
);

create index crm_customers_org_status_idx on public.crm_customers (organization_id, status, updated_at desc);
create index suppliers_org_status_idx on public.suppliers (organization_id, status, updated_at desc);
create index inventory_items_org_category_idx on public.inventory_items (organization_id, category, name);
create index inventory_items_tenant_supplier_idx on public.inventory_items (organization_id, supplier_id);
create index financial_records_org_date_idx on public.financial_records (organization_id, issue_date desc);
create index financial_records_tenant_order_idx on public.financial_records (organization_id, order_id);
create index financial_records_tenant_customer_idx on public.financial_records (organization_id, customer_id);

create trigger crm_customers_touch_updated_at before update on public.crm_customers
for each row execute function public.touch_updated_at();
create trigger suppliers_touch_updated_at before update on public.suppliers
for each row execute function public.touch_updated_at();
create trigger inventory_items_touch_updated_at before update on public.inventory_items
for each row execute function public.touch_updated_at();
create trigger financial_records_touch_updated_at before update on public.financial_records
for each row execute function public.touch_updated_at();

alter table public.crm_customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.financial_records enable row level security;

create policy crm_customers_member_select on public.crm_customers for select to authenticated
using (public.is_org_member(organization_id));
create policy crm_customers_office_insert on public.crm_customers for insert to authenticated
with check (created_by = auth.uid() and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]));
create policy crm_customers_office_update on public.crm_customers for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]));
create policy crm_customers_admin_delete on public.crm_customers for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy suppliers_member_select on public.suppliers for select to authenticated
using (public.is_org_member(organization_id));
create policy suppliers_office_insert on public.suppliers for insert to authenticated
with check (created_by = auth.uid() and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]));
create policy suppliers_office_update on public.suppliers for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]));
create policy suppliers_admin_delete on public.suppliers for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy inventory_items_member_select on public.inventory_items for select to authenticated
using (public.is_org_member(organization_id));
create policy inventory_items_office_insert on public.inventory_items for insert to authenticated
with check (created_by = auth.uid() and public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]));
create policy inventory_items_office_update on public.inventory_items for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin','office']::public.organization_role[]));
create policy inventory_items_admin_delete on public.inventory_items for delete to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy financial_records_admin_select on public.financial_records for select to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy financial_records_admin_insert on public.financial_records for insert to authenticated
with check (created_by = auth.uid() and public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy financial_records_admin_update on public.financial_records for update to authenticated
using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy financial_records_owner_delete on public.financial_records for delete to authenticated
using (public.has_org_role(organization_id, array['owner']::public.organization_role[]));

create or replace function public.audit_business_module_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  target_id text;
begin
  target_org := coalesce(new.organization_id, old.organization_id);
  target_id := coalesce(new.id, old.id)::text;
  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (target_org, auth.uid(), lower(tg_table_name || '.' || tg_op), tg_table_name, target_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger crm_customers_audit after insert or update or delete on public.crm_customers
for each row execute function public.audit_business_module_change();
create trigger suppliers_audit after insert or update or delete on public.suppliers
for each row execute function public.audit_business_module_change();
create trigger inventory_items_audit after insert or update or delete on public.inventory_items
for each row execute function public.audit_business_module_change();
create trigger financial_records_audit after insert or update or delete on public.financial_records
for each row execute function public.audit_business_module_change();
