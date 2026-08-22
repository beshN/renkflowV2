create index orders_delivered_by_idx on public.orders (delivered_by)
where delivered_by is not null;
