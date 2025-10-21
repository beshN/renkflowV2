-- Add is_admin_only column to order_files table
ALTER TABLE public.order_files
ADD COLUMN IF NOT EXISTS is_admin_only BOOLEAN DEFAULT FALSE;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_order_files_admin_only ON public.order_files(is_admin_only);

COMMENT ON COLUMN public.order_files.is_admin_only IS 'Belgenin sadece admin kullanıcılar tarafından görülebilir olup olmadığını belirtir';
