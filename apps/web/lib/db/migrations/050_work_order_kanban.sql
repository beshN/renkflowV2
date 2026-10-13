-- Shared card order; presentation never changes stock, quantities or production recipes.
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS board_position double precision;
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY tenant_id, status ORDER BY
    CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
    COALESCE(due_at, created_at), created_at DESC, id) * 1024 AS position
  FROM public.work_orders
)
UPDATE public.work_orders w SET board_position = r.position
FROM ranked r WHERE w.id = r.id AND w.board_position IS NULL;
ALTER TABLE public.work_orders ALTER COLUMN board_position SET DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_work_orders_board ON public.work_orders(tenant_id, status, board_position, id);
