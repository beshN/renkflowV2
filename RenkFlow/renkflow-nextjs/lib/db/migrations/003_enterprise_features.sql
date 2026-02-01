-- ============================================
-- Enterprise Features Migration
-- Time Tracking, Automation, Documents, Resources, Portfolios, Reports
-- ============================================

-- ============================================
-- 1. TIME TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration INTEGER NOT NULL DEFAULT 0, -- seconds
    
    billable BOOLEAN DEFAULT false,
    hourly_rate DECIMAL(10,2),
    
    tags TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'stopped' CHECK (status IN ('running', 'paused', 'stopped')),
    source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('timer', 'manual', 'import', 'pomodoro')),
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_time_entries_tenant ON time_entries(tenant_id);
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_task ON time_entries(task_id);
CREATE INDEX idx_time_entries_start_time ON time_entries(start_time);
CREATE INDEX idx_time_entries_date ON time_entries(DATE(start_time));

-- Enable RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY time_entries_tenant_isolation ON time_entries
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================
-- 2. AUTOMATION RULES
-- ============================================

CREATE TABLE IF NOT EXISTS automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    trigger_type VARCHAR(50) NOT NULL,
    trigger_config JSONB DEFAULT '{}',
    
    conditions JSONB DEFAULT '[]',
    actions JSONB DEFAULT '[]',
    
    scope JSONB DEFAULT '{}', -- projects, spaces, tags
    
    is_enabled BOOLEAN DEFAULT true,
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    
    schedule JSONB, -- cron, timezone, etc.
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_rules_tenant ON automation_rules(tenant_id);
CREATE INDEX idx_automation_rules_enabled ON automation_rules(is_enabled);
CREATE INDEX idx_automation_rules_trigger ON automation_rules(trigger_type);

-- Automation Executions Log
CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    triggered_by VARCHAR(50) NOT NULL, -- 'system', 'user', 'webhook'
    trigger_data JSONB DEFAULT '{}',
    
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    actions JSONB DEFAULT '[]', -- executed actions with results
    
    error TEXT,
    duration INTEGER, -- milliseconds
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_executions_rule ON automation_executions(rule_id);
CREATE INDEX idx_automation_executions_status ON automation_executions(status);
CREATE INDEX idx_automation_executions_triggered ON automation_executions(triggered_at);

-- Enable RLS
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_rules_tenant_isolation ON automation_rules
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY automation_executions_tenant_isolation ON automation_executions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================
-- 3. DOCUMENTS & WHITEBOARDS
-- ============================================

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    title VARCHAR(500) NOT NULL,
    content JSONB DEFAULT '[]', -- Block-based content
    
    parent_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    
    icon VARCHAR(100),
    cover_image TEXT,
    
    is_template BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    
    version INTEGER DEFAULT 1,
    
    created_by UUID REFERENCES users(id),
    last_edited_by UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_parent ON documents(parent_id);
CREATE INDEX idx_documents_project ON documents(project_id);

-- Document Comments
CREATE TABLE IF NOT EXISTS document_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    block_id VARCHAR(100), -- Reference to specific block
    
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id),
    
    parent_comment_id UUID REFERENCES document_comments(id) ON DELETE CASCADE,
    is_resolved BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_comments_doc ON document_comments(doc_id);

-- Whiteboards
CREATE TABLE IF NOT EXISTS whiteboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    title VARCHAR(500) NOT NULL,
    elements JSONB DEFAULT '[]',
    
    viewport JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}',
    background_color VARCHAR(20) DEFAULT '#ffffff',
    grid_enabled BOOLEAN DEFAULT true,
    
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    
    is_template BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whiteboards_tenant ON whiteboards(tenant_id);
CREATE INDEX idx_whiteboards_project ON whiteboards(project_id);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE whiteboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_tenant_isolation ON documents
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY whiteboards_tenant_isolation ON whiteboards
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================
-- 4. RESOURCES & CAPACITY
-- ============================================

CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('human', 'machine', 'material', 'facility', 'tool')),
    
    capacity JSONB DEFAULT '{"hoursPerDay": 8, "daysPerWeek": 5, "efficiency": 100}',
    cost JSONB DEFAULT '{"hourlyRate": 0, "currency": "TRY"}',
    
    skills TEXT[] DEFAULT '{}',
    certifications TEXT[] DEFAULT '{}',
    
    user_id UUID REFERENCES users(id), -- For human resources
    
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_resources_tenant ON resources(tenant_id);
CREATE INDEX idx_resources_type ON resources(type);
CREATE INDEX idx_resources_active ON resources(is_active);

-- Resource Allocations
CREATE TABLE IF NOT EXISTS resource_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    
    task_name VARCHAR(500),
    
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    hours_allocated DECIMAL(10,2) NOT NULL,
    hours_used DECIMAL(10,2) DEFAULT 0,
    
    allocation_percentage DECIMAL(5,2) DEFAULT 100,
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
    
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_resource_allocations_resource ON resource_allocations(resource_id);
CREATE INDEX idx_resource_allocations_dates ON resource_allocations(start_date, end_date);
CREATE INDEX idx_resource_allocations_status ON resource_allocations(status);

-- Enable RLS
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY resources_tenant_isolation ON resources
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY resource_allocations_tenant_isolation ON resource_allocations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================
-- 5. PORTFOLIOS
-- ============================================

CREATE TABLE IF NOT EXISTS portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    project_ids UUID[] DEFAULT '{}',
    
    owner_id UUID REFERENCES users(id),
    
    budget JSONB DEFAULT '{"allocated": 0, "spent": 0, "currency": "TRY"}',
    timeline JSONB DEFAULT '{"startDate": null, "endDate": null, "milestones": []}',
    goals JSONB DEFAULT '[]',
    
    tags TEXT[] DEFAULT '{}',
    
    is_archived BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portfolios_tenant ON portfolios(tenant_id);
CREATE INDEX idx_portfolios_owner ON portfolios(owner_id);
CREATE INDEX idx_portfolios_archived ON portfolios(is_archived);

-- Enable RLS
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY portfolios_tenant_isolation ON portfolios
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================
-- 6. REPORTS
-- ============================================

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('custom', 'template', 'scheduled')),
    category VARCHAR(50),
    
    data_source JSONB NOT NULL,
    visualizations JSONB DEFAULT '[]',
    
    schedule JSONB, -- frequency, format, recipients, nextRun
    
    is_public BOOLEAN DEFAULT false,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_tenant ON reports(tenant_id);
CREATE INDEX idx_reports_type ON reports(type);
CREATE INDEX idx_reports_category ON reports(category);

-- Report Executions
CREATE TABLE IF NOT EXISTS report_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_by UUID REFERENCES users(id),
    
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    duration INTEGER, -- milliseconds
    row_count INTEGER,
    
    output_url TEXT,
    error TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_executions_report ON report_executions(report_id);
CREATE INDEX idx_report_executions_executed ON report_executions(executed_at);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_tenant_isolation ON reports
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================
-- 7. TASK DEPENDENCIES
-- ============================================

CREATE TABLE IF NOT EXISTS task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    source_task_id UUID NOT NULL,
    target_task_id UUID NOT NULL,
    
    type VARCHAR(10) NOT NULL DEFAULT 'FS' CHECK (type IN ('FS', 'SS', 'FF', 'SF')),
    
    lag_days INTEGER DEFAULT 0,
    lag_hours INTEGER DEFAULT 0,
    
    is_hard BOOLEAN DEFAULT true, -- Hard vs soft dependency
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(source_task_id, target_task_id)
);

CREATE INDEX idx_task_dependencies_tenant ON task_dependencies(tenant_id);
CREATE INDEX idx_task_dependencies_source ON task_dependencies(source_task_id);
CREATE INDEX idx_task_dependencies_target ON task_dependencies(target_task_id);

-- Enable RLS
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_dependencies_tenant_isolation ON task_dependencies
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================
-- 8. AI CONVERSATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    title VARCHAR(255),
    messages JSONB DEFAULT '[]',
    
    context JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_tenant ON ai_conversations(tenant_id);
CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id);

-- Enable RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_conversations_tenant_isolation ON ai_conversations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================
-- UPDATE TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON automation_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whiteboards_updated_at BEFORE UPDATE ON whiteboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resource_allocations_updated_at BEFORE UPDATE ON resource_allocations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_dependencies_updated_at BEFORE UPDATE ON task_dependencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON ai_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
