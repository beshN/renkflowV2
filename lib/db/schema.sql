-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create mock auth schema and function if not exists (for non-Supabase environments)
create schema if not exists auth;

create or replace function auth.uid() returns uuid as $$
  select null::uuid
$$ language sql stable;

-- Clean up existing tables (Cascade will handle dependencies)
drop table if exists public.documents cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.customers cascade;
drop table if exists public.tenant_members cascade;
drop table if exists public.invitations cascade;
drop table if exists public.tenants cascade;
drop table if exists public.profiles cascade;

-- 1. Tenants (Organizations)
create table public.tenants (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text unique not null,
  logo_url text,
  brand_color text default '#6366f1', -- Default primary color
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Profiles (Users)
create table public.profiles (
  id uuid primary key, -- Matches Supabase Auth ID
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tenant Members (Link Users to Tenants)
create table public.tenant_members (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text check (role in ('owner', 'admin', 'member')) default 'member',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(tenant_id, user_id)
);

-- 4. Invitations
create table public.invitations (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade,
  email text not null,
  role text check (role in ('admin', 'member')) default 'member',
  token text unique not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(tenant_id, email)
);

-- 5. Customers (Tenant Scoped)
create table public.customers (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  full_name text not null,
  email text,
  phone text,
  address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Orders (Tenant Scoped)
create table public.orders (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  order_number text not null, -- Unique per tenant, handled by app logic or composite key
  customer_id uuid references public.customers(id),
  customer_name text not null,
  email text,
  phone text,
  product_name text,
  quantity integer default 1,
  status text check (status in ('pending', 'in_production', 'delivered')) default 'pending',
  total_amount decimal(10,2) not null,
  currency text default '₺',
  delivery_date date,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(tenant_id, order_number)
);

-- 7. Order Items (Tenant Scoped via Order)
create table public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade,
  product_name text not null,
  quantity integer not null default 1,
  unit_price decimal(10,2) not null,
  total_price decimal(10,2) not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Documents (Tenant Scoped via Order)
create table public.documents (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade not null, -- Direct link for easier RLS
  order_id uuid references public.orders(id) on delete cascade,
  name text not null,
  file_path text not null,
  file_type text,
  size integer,
  uploaded_by uuid references public.profiles(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_members enable row level security;
alter table public.invitations enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.documents enable row level security;

-- RLS Policies

-- Profiles: Users can see their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Tenants: Users can view tenants they are members of
create policy "Members can view their tenants"
  on public.tenants for select
  using (
    exists (
      select 1 from public.tenant_members
      where tenant_members.tenant_id = tenants.id
      and tenant_members.user_id = auth.uid()
    )
  );

create policy "Users can create tenants"
  on public.tenants for insert
  with check (auth.uid() is not null);

create policy "Owners can update their tenants"
  on public.tenants for update
  using (
    exists (
      select 1 from public.tenant_members
      where tenant_members.tenant_id = tenants.id
      and tenant_members.user_id = auth.uid()
      and tenant_members.role = 'owner'
    )
  );

-- Tenant Members: Users can view members of their tenants
create policy "Members can view other members"
  on public.tenant_members for select
  using (
    exists (
      select 1 from public.tenant_members as tm
      where tm.tenant_id = tenant_members.tenant_id
      and tm.user_id = auth.uid()
    )
  );

create policy "Users can insert their own membership"
  on public.tenant_members for insert
  with check (auth.uid() = user_id);

create policy "Admins can manage members"
  on public.tenant_members for all
  using (
    exists (
      select 1 from public.tenant_members as tm
      where tm.tenant_id = tenant_members.tenant_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner', 'admin')
    )
  );

-- Invitations: Admins can manage invitations
create policy "Admins can manage invitations"
  on public.invitations for all
  using (
    exists (
      select 1 from public.tenant_members
      where tenant_members.tenant_id = invitations.tenant_id
      and tenant_members.user_id = auth.uid()
      and tenant_members.role in ('owner', 'admin')
    )
  );

create policy "Public can view invitations by token"
  on public.invitations for select
  using (true); -- Needed for verify page (token check)

-- Customers: Access restricted to tenant members
create policy "Tenant members can view customers"
  on public.customers for select
  using (
    exists (
      select 1 from public.tenant_members
      where tenant_members.tenant_id = customers.tenant_id
      and tenant_members.user_id = auth.uid()
    )
  );

create policy "Tenant members can insert customers"
  on public.customers for insert
  with check (
    exists (
      select 1 from public.tenant_members
      where tenant_members.tenant_id = customers.tenant_id
      and tenant_members.user_id = auth.uid()
    )
  );

create policy "Tenant members can update customers"
  on public.customers for update
  using (
    exists (
      select 1 from public.tenant_members
      where tenant_members.tenant_id = customers.tenant_id
      and tenant_members.user_id = auth.uid()
    )
  );

-- Orders: Access restricted to tenant members
create policy "Tenant members can view orders"
  on public.orders for select
  using (
    exists (
      select 1 from public.tenant_members
      where tenant_members.tenant_id = orders.tenant_id
      and tenant_members.user_id = auth.uid()
    )
  );

create policy "Tenant members can insert orders"
  on public.orders for insert
  with check (
    exists (
      select 1 from public.tenant_members
      where tenant_members.tenant_id = orders.tenant_id
      and tenant_members.user_id = auth.uid()
    )
  );

create policy "Tenant members can update orders"
  on public.orders for update
  using (
    exists (
      select 1 from public.tenant_members
      where tenant_members.tenant_id = orders.tenant_id
      and tenant_members.user_id = auth.uid()
    )
  );

-- Order Items: Access via Order -> Tenant
create policy "Tenant members can view order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders
      join public.tenant_members on orders.tenant_id = tenant_members.tenant_id
      where order_items.order_id = orders.id
      and tenant_members.user_id = auth.uid()
    )
  );

create policy "Tenant members can insert order items"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      join public.tenant_members on orders.tenant_id = tenant_members.tenant_id
      where order_items.order_id = orders.id
      and tenant_members.user_id = auth.uid()
    )
  );

-- Documents: Access restricted to tenant members
create policy "Tenant members can view documents"
  on public.documents for select
  using (
    exists (
      select 1 from public.tenant_members
      where tenant_members.tenant_id = documents.tenant_id
      and tenant_members.user_id = auth.uid()
    )
  );

create policy "Tenant members can insert documents"
  on public.documents for insert
  with check (
    exists (
      select 1 from public.tenant_members
      where tenant_members.tenant_id = documents.tenant_id
      and tenant_members.user_id = auth.uid()
    )
  );



