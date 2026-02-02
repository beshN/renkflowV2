'use server';

/**
 * Automation Server Actions
 * CRUD operations for automation rules
 */

import { sql } from '@/lib/db';
import { auth } from '@/auth';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

// ============================================
// Validation Schemas
// ============================================

const ConditionSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.unknown(),
  logicalOperator: z.enum(['AND', 'OR']).optional(),
});

const ActionSchema = z.object({
  type: z.string(),
  config: z.record(z.string(), z.unknown()),
  order: z.number(),
  delay: z.number().default(0),
});

const TriggerSchema = z.object({
  type: z.string(),
  config: z.record(z.string(), z.unknown()).default({}),
});

const AutomationRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  trigger: TriggerSchema,
  conditions: z.array(ConditionSchema).default([]),
  actions: z.array(ActionSchema),
  scope: z.object({
    projects: z.array(z.string()).optional(),
    spaces: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
  isEnabled: z.boolean().default(true),
  schedule: z.object({
    cron: z.string().optional(),
    timezone: z.string().default('Europe/Istanbul'),
  }).optional(),
});

const UpdateAutomationRuleSchema = AutomationRuleSchema.partial();

// ============================================
// Types
// ============================================

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface AutomationRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  conditions: Array<{
    field: string;
    operator: string;
    value: unknown;
    logicalOperator?: 'AND' | 'OR';
  }>;
  actions: Array<{
    type: string;
    config: Record<string, unknown>;
    order: number;
    delay: number;
  }>;
  scope?: {
    projects?: string[];
    spaces?: string[];
    tags?: string[];
  };
  isEnabled: boolean;
  executionCount: number;
  lastExecutedAt?: string;
  schedule?: {
    cron?: string;
    timezone: string;
  };
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface AutomationExecution {
  id: string;
  ruleId: string;
  triggeredAt: string;
  triggeredBy: string;
  triggerData: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  actions: Array<{
    type: string;
    status: string;
    result?: unknown;
    error?: string;
    executedAt: string;
  }>;
  error?: string;
  duration: number;
}

// ============================================
// Helper Functions
// ============================================

async function getSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session;
}

// ============================================
// Server Actions
// ============================================

export async function createAutomationRule(
  data: z.infer<typeof AutomationRuleSchema>
): Promise<ActionResult<AutomationRule>> {
  try {
    const session = await getSession();
    const validated = AutomationRuleSchema.parse(data);

    const result = await sql`
      INSERT INTO automation_rules (
        tenant_id,
        name,
        description,
        trigger_type,
        trigger_config,
        conditions,
        actions,
        scope,
        is_enabled,
        schedule,
        created_by
      ) VALUES (
        ${session.user.tenantId},
        ${validated.name},
        ${validated.description || null},
        ${validated.trigger.type},
        ${JSON.stringify(validated.trigger.config)},
        ${JSON.stringify(validated.conditions)},
        ${JSON.stringify(validated.actions)},
        ${validated.scope ? JSON.stringify(validated.scope) : null},
        ${validated.isEnabled},
        ${validated.schedule ? JSON.stringify(validated.schedule) : null},
        ${session.user.id}
      )
      RETURNING *
    `;

    revalidatePath('/settings/automation');

    const rows = result as any[];
    return {
      success: true,
      data: mapAutomationRule(rows[0]),
    };
  } catch (error) {
    console.error('[Automation] Create error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create automation rule',
    };
  }
}

export async function updateAutomationRule(
  ruleId: string,
  data: z.infer<typeof UpdateAutomationRuleSchema>
): Promise<ActionResult<AutomationRule>> {
  try {
    const session = await getSession();
    const validated = UpdateAutomationRuleSchema.parse(data);

    // Build update object with only provided fields
    const name = validated.name;
    const description = validated.description;
    const triggerType = validated.trigger?.type;
    const triggerConfig = validated.trigger?.config ? JSON.stringify(validated.trigger.config) : null;
    const conditions = validated.conditions ? JSON.stringify(validated.conditions) : null;
    const actions = validated.actions ? JSON.stringify(validated.actions) : null;
    const scope = validated.scope ? JSON.stringify(validated.scope) : null;
    const isEnabled = validated.isEnabled;
    const schedule = validated.schedule ? JSON.stringify(validated.schedule) : null;

    // Use COALESCE to only update provided fields
    const result = await sql`
      UPDATE automation_rules
      SET 
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        trigger_type = COALESCE(${triggerType}, trigger_type),
        trigger_config = COALESCE(${triggerConfig}::jsonb, trigger_config),
        conditions = COALESCE(${conditions}::jsonb, conditions),
        actions = COALESCE(${actions}::jsonb, actions),
        scope = COALESCE(${scope}::jsonb, scope),
        is_enabled = COALESCE(${isEnabled}, is_enabled),
        schedule = COALESCE(${schedule}::jsonb, schedule),
>>>>>>> /Users/beshnovski/.windsurf/worktrees/RenkFlow V2/RenkFlow V2-98ad306b/RenkFlow/renkflow-nextjs/app/actions/automation.actions.ts
        updated_at = NOW()
      WHERE id = ${ruleId}
        AND tenant_id = ${session.user.tenantId}
      RETURNING *
    `;

    const rows = result as any[];
    if (rows.length === 0) {
      return { success: false, error: 'Automation rule not found' };
    }

    revalidatePath('/settings/automation');

    return {
      success: true,
      data: mapAutomationRule(rows[0]),
    };
  } catch (error) {
    console.error('[Automation] Update error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update automation rule',
    };
  }
}

export async function deleteAutomationRule(ruleId: string): Promise<ActionResult> {
  try {
    const session = await getSession();

    const result = await sql`
      DELETE FROM automation_rules
      WHERE id = ${ruleId}
        AND tenant_id = ${session.user.tenantId}
      RETURNING id
    `;

    const rows = result as any[];
    if (rows.length === 0) {
      return { success: false, error: 'Automation rule not found' };
    }

    revalidatePath('/settings/automation');

    return { success: true };
  } catch (error) {
    console.error('[Automation] Delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete automation rule',
    };
  }
}

export async function toggleAutomationRule(ruleId: string): Promise<ActionResult<AutomationRule>> {
  try {
    const session = await getSession();

    const result = await sql`
      UPDATE automation_rules
      SET is_enabled = NOT is_enabled, updated_at = NOW()
      WHERE id = ${ruleId}
        AND tenant_id = ${session.user.tenantId}
      RETURNING *
    `;

    const rows = result as any[];
    if (rows.length === 0) {
      return { success: false, error: 'Automation rule not found' };
    }

    revalidatePath('/settings/automation');

    return {
      success: true,
      data: mapAutomationRule(rows[0]),
    };
  } catch (error) {
    console.error('[Automation] Toggle error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle automation rule',
    };
  }
}

export async function getAutomationRules(params?: {
  isEnabled?: boolean;
  triggerType?: string;
  limit?: number;
  offset?: number;
}): Promise<ActionResult<{ rules: AutomationRule[]; total: number }>> {
  try {
    const session = await getSession();
    const { isEnabled, triggerType, limit = 50, offset = 0 } = params || {};

    let whereClause = sql`tenant_id = ${session.user.tenantId}`;

    if (isEnabled !== undefined) {
      whereClause = sql`${whereClause} AND is_enabled = ${isEnabled}`;
    }
    if (triggerType) {
      whereClause = sql`${whereClause} AND trigger_type = ${triggerType}`;
    }

    const [rulesResult, countResult] = await Promise.all([
      sql`
        SELECT * FROM automation_rules
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) as total FROM automation_rules
        WHERE ${whereClause}
      `,
    ]);

    const rules = rulesResult as any[];
    const counts = countResult as any[];
    return {
      success: true,
      data: {
        rules: rules.map(mapAutomationRule),
        total: parseInt(counts[0]?.total || '0'),
      },
    };
  } catch (error) {
    console.error('[Automation] Get rules error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get automation rules',
    };
  }
}

export async function getAutomationRule(ruleId: string): Promise<ActionResult<AutomationRule>> {
  try {
    const session = await getSession();

    const result = await sql`
      SELECT * FROM automation_rules
      WHERE id = ${ruleId}
        AND tenant_id = ${session.user.tenantId}
    `;

    const rows = result as any[];
    if (rows.length === 0) {
      return { success: false, error: 'Automation rule not found' };
    }

    return {
      success: true,
      data: mapAutomationRule(rows[0]),
    };
  } catch (error) {
    console.error('[Automation] Get rule error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get automation rule',
    };
  }
}

export async function getAutomationExecutions(
  ruleId: string,
  params?: { limit?: number; offset?: number }
): Promise<ActionResult<{ executions: AutomationExecution[]; total: number }>> {
  try {
    const session = await getSession();
    const { limit = 50, offset = 0 } = params || {};

    const [executionsResult, countResult] = await Promise.all([
      sql`
        SELECT * FROM automation_executions
        WHERE rule_id = ${ruleId}
          AND tenant_id = ${session.user.tenantId}
        ORDER BY triggered_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) as total FROM automation_executions
        WHERE rule_id = ${ruleId}
          AND tenant_id = ${session.user.tenantId}
      `,
    ]);

    const executions = executionsResult as any[];
    const counts = countResult as any[];
    return {
      success: true,
      data: {
        executions: executions.map(mapAutomationExecution),
        total: parseInt(counts[0]?.total || '0'),
      },
    };
  } catch (error) {
    console.error('[Automation] Get executions error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get automation executions',
    };
  }
}

export async function duplicateAutomationRule(ruleId: string): Promise<ActionResult<AutomationRule>> {
  try {
    const session = await getSession();

    const original = await sql`
      SELECT * FROM automation_rules
      WHERE id = ${ruleId}
        AND tenant_id = ${session.user.tenantId}
    `;

    const origRows = original as any[];
    if (origRows.length === 0) {
      return { success: false, error: 'Automation rule not found' };
    }

    const rule = origRows[0];

    const result = await sql`
      INSERT INTO automation_rules (
        tenant_id,
        name,
        description,
        trigger_type,
        trigger_config,
        conditions,
        actions,
        scope,
        is_enabled,
        schedule,
        created_by
      ) VALUES (
        ${session.user.tenantId},
        ${rule.name + ' (Kopya)'},
        ${rule.description},
        ${rule.trigger_type},
        ${rule.trigger_config},
        ${rule.conditions},
        ${rule.actions},
        ${rule.scope},
        false,
        ${rule.schedule},
        ${session.user.id}
      )
      RETURNING *
    `;

    revalidatePath('/settings/automation');

    const rows = result as any[];
    return {
      success: true,
      data: mapAutomationRule(rows[0]),
    };
  } catch (error) {
    console.error('[Automation] Duplicate error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to duplicate automation rule',
    };
  }
}

// ============================================
// Mapping Functions
// ============================================

function mapAutomationRule(row: any): AutomationRule {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    triggerType: row.trigger_type,
    triggerConfig: row.trigger_config || {},
    conditions: row.conditions || [],
    actions: row.actions || [],
    scope: row.scope,
    isEnabled: row.is_enabled,
    executionCount: row.execution_count || 0,
    lastExecutedAt: row.last_executed_at,
    schedule: row.schedule,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAutomationExecution(row: any): AutomationExecution {
  return {
    id: row.id,
    ruleId: row.rule_id,
    triggeredAt: row.triggered_at,
    triggeredBy: row.triggered_by,
    triggerData: row.trigger_data || {},
    status: row.status,
    actions: row.actions || [],
    error: row.error,
    duration: row.duration || 0,
  };
}
