-- ============================================
-- Audit Logs Migration
-- Enterprise-grade audit trail for all financial operations
-- ============================================

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  
  -- Who performed the action
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  user_email text,
  user_role text,
  
  -- What action was performed
  action text NOT NULL, -- e.g., 'payment.create', 'employee.update', 'document.delete'
  entity_type text NOT NULL, -- e.g., 'payment', 'employee', 'order_document'
  entity_id uuid,
  
  -- Before/After values for tracking changes
  old_values jsonb,
  new_values jsonb,
  
  -- Request metadata
  ip_address inet,
  user_agent text,
  request_id text,
  
  -- Additional context
  metadata jsonb DEFAULT '{}',
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON public.audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_entity 
  ON public.audit_logs(tenant_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action_date 
  ON public.audit_logs(tenant_id, action, created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only owner/admin can view audit logs
CREATE POLICY "Only admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = audit_logs.tenant_id
      AND tenant_members.user_id = auth.uid()
      AND tenant_members.role IN ('owner', 'admin')
    )
  );

-- Insert policy - System can insert
CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- Audit Log Helper Function
-- ============================================

CREATE OR REPLACE FUNCTION log_audit_event(
  p_tenant_id uuid,
  p_user_id uuid,
  p_user_email text,
  p_user_role text,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    tenant_id,
    user_id,
    user_email,
    user_role,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    ip_address,
    user_agent,
    request_id,
    metadata
  ) VALUES (
    p_tenant_id,
    p_user_id,
    p_user_email,
    p_user_role,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_values,
    p_new_values,
    p_ip_address,
    p_user_agent,
    gen_random_uuid()::text,
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Audit Summary View
-- ============================================

CREATE OR REPLACE VIEW audit_logs_summary AS
SELECT 
  tenant_id,
  action,
  entity_type,
  DATE(created_at) as log_date,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users
FROM public.audit_logs
GROUP BY tenant_id, action, entity_type, DATE(created_at);
