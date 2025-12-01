-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Clean up existing tables
drop table if exists public.documents cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.customers cascade;
drop table if exists public.profiles cascade;

-- Profiles (Users & Roles)
create table public.profiles (
  id uuid primary key, -- Matches Supabase Auth ID
  email text unique not null,
  full_name text,
  avatar_url text,
  role text check (role in ('admin', 'worker')) default 'worker',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Customers
create table public.customers (
  id uuid default uuid_generate_v4() primary key,
  full_name text not null,
  email text,
  phone text,
  address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Orders
create table public.orders (
  id uuid default uuid_generate_v4() primary key,
  order_number text unique not null, -- Human readable ID like ORD-2024-001
  customer_id uuid references public.customers(id),
  customer_name text not null, -- Denormalized for easier display
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
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Order Items (Products)
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

-- Documents
create table public.documents (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade,
  name text not null,
  file_path text not null, -- Storage path
  file_type text,
  size integer,
  uploaded_by uuid, -- References profiles(id) logically
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


