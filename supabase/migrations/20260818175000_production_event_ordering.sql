-- `now()` is stable for an entire transaction, so multiple stage events can
-- receive the same timestamp. A wall-clock default preserves insertion order.
alter table public.order_stage_events
  alter column created_at set default clock_timestamp();
