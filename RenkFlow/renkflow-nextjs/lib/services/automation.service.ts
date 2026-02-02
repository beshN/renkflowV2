/**
 * Automation Engine Service
 * Rule-based automation with triggers, conditions, and actions
 */

import type {
  AutomationRule,
  AutomationExecution,
  TriggerType,
  ActionType,
  ConditionOperator,
  AutomationTemplate,
} from '@/lib/types/enterprise';

// ============================================
// Condition Evaluator
// ============================================

export class ConditionEvaluator {
  static evaluate(
    operator: ConditionOperator,
    fieldValue: unknown,
    conditionValue: unknown
  ): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === conditionValue;

      case 'not_equals':
        return fieldValue !== conditionValue;

      case 'contains':
        if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
          return fieldValue.toLowerCase().includes(conditionValue.toLowerCase());
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(conditionValue);
        }
        return false;

      case 'not_contains':
        return !this.evaluate('contains', fieldValue, conditionValue);

      case 'starts_with':
        if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
          return fieldValue.toLowerCase().startsWith(conditionValue.toLowerCase());
        }
        return false;

      case 'ends_with':
        if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
          return fieldValue.toLowerCase().endsWith(conditionValue.toLowerCase());
        }
        return false;

      case 'greater_than':
        return Number(fieldValue) > Number(conditionValue);

      case 'less_than':
        return Number(fieldValue) < Number(conditionValue);

      case 'greater_or_equal':
        return Number(fieldValue) >= Number(conditionValue);

      case 'less_or_equal':
        return Number(fieldValue) <= Number(conditionValue);

      case 'is_empty':
        return (
          fieldValue === null ||
          fieldValue === undefined ||
          fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        );

      case 'is_not_empty':
        return !this.evaluate('is_empty', fieldValue, conditionValue);

      case 'in_list':
        if (Array.isArray(conditionValue)) {
          return conditionValue.includes(fieldValue);
        }
        return false;

      case 'not_in_list':
        return !this.evaluate('in_list', fieldValue, conditionValue);

      case 'matches_regex':
        if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
          try {
            return new RegExp(conditionValue).test(fieldValue);
          } catch {
            return false;
          }
        }
        return false;

      case 'between':
        if (Array.isArray(conditionValue) && conditionValue.length === 2) {
          const val = Number(fieldValue);
          return val >= Number(conditionValue[0]) && val <= Number(conditionValue[1]);
        }
        return false;

      case 'is_today':
        if (typeof fieldValue === 'string') {
          const date = new Date(fieldValue);
          const today = new Date();
          return (
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()
          );
        }
        return false;

      case 'is_overdue':
        if (typeof fieldValue === 'string') {
          const date = new Date(fieldValue);
          return date < new Date();
        }
        return false;

      case 'is_this_week':
        if (typeof fieldValue === 'string') {
          const date = new Date(fieldValue);
          const today = new Date();
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay() + 1);
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          return date >= startOfWeek && date <= endOfWeek;
        }
        return false;

      default:
        return false;
    }
  }

  static evaluateConditions(
    conditions: AutomationRule['conditions'],
    data: Record<string, unknown>
  ): boolean {
    if (conditions.length === 0) return true;

    let result = true;
    let currentLogicalOp: 'AND' | 'OR' = 'AND';

    for (const condition of conditions) {
      const fieldValue = this.getNestedValue(data, condition.field);
      const conditionResult = this.evaluate(
        condition.operator,
        fieldValue,
        condition.value
      );

      if (currentLogicalOp === 'AND') {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }

      if (condition.logicalOperator) {
        currentLogicalOp = condition.logicalOperator;
      }
    }

    return result;
  }

  private static getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}

// ============================================
// Action Executor
// ============================================

export class ActionExecutor {
  static async execute(
    actionType: ActionType,
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    try {
      switch (actionType) {
        case 'update_field':
          return await this.updateField(config, context);

        case 'create_subtask':
          return await this.createSubtask(config, context);

        case 'send_notification':
          return await this.sendNotification(config, context);

        case 'send_email':
          return await this.sendEmail(config, context);

        case 'move_task':
          return await this.moveTask(config, context);

        case 'archive_task':
          return await this.archiveTask(config, context);

        case 'assign_user':
          return await this.assignUser(config, context);

        case 'add_tag':
          return await this.addTag(config, context);

        case 'remove_tag':
          return await this.removeTag(config, context);

        case 'call_webhook':
          return await this.callWebhook(config, context);

        case 'create_task':
          return await this.createTask(config, context);

        case 'add_comment':
          return await this.addComment(config, context);

        case 'set_due_date':
          return await this.setDueDate(config, context);

        case 'generate_report':
          return await this.generateReport(config, context);

        default:
          return { success: false, error: `Unknown action type: ${actionType}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Action implementations
  private static async updateField(
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { field, value } = config;
    // This would call the appropriate server action
    console.log(`[Automation] Updating field ${field} to ${value} for task ${context.taskId}`);
    return { success: true, result: { field, value } };
  }

  private static async createSubtask(
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { title, template } = config;
    console.log(`[Automation] Creating subtask: ${title || template}`);
    return { success: true, result: { subtaskId: `subtask_${Date.now()}` } };
  }

  private static async sendNotification(
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { title, message, recipients } = config;
    console.log(`[Automation] Sending notification: ${title} to ${recipients}`);
    return { success: true };
  }

  private static async sendEmail(
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { to, subject, body } = config;
    console.log(`[Automation] Sending email to ${to}: ${subject}`);
    // Would call email service
    return { success: true };
  }

  private static async moveTask(
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { status, column } = config;
    console.log(`[Automation] Moving task to ${status || column}`);
    return { success: true };
  }

  private static async archiveTask(
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    console.log(`[Automation] Archiving task ${context.taskId}`);
    return { success: true };
  }

  private static async assignUser(
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { userId, assignmentType } = config;
    console.log(`[Automation] Assigning ${userId} (type: ${assignmentType})`);
    return { success: true };
  }

  private static async addTag(
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { tag } = config;
    console.log(`[Automation] Adding tag: ${tag}`);
    return { success: true };
  }

  private static async removeTag(
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { tag } = config;
    console.log(`[Automation] Removing tag: ${tag}`);
    return { success: true };
  }

  private static async callWebhook(
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { url, method = 'POST', headers, body } = config;
    
    try {
      const response = await fetch(url as string, {
        method: method as string,
        headers: {
          'Content-Type': 'application/json',
          ...(headers as Record<string, string> || {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      return {
        success: response.ok,
        result: { status: response.status },
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook failed',
      };
    }
  }

  private static async createTask(
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { title, description, dueDate } = config;
    console.log(`[Automation] Creating task: ${title}`);
    return { success: true, result: { taskId: `task_${Date.now()}` } };
  }

  private static async addComment(
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { comment } = config;
    console.log(`[Automation] Adding comment to task ${context.taskId}`);
    return { success: true };
  }

  private static async setDueDate(
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { date, daysFromNow } = config;
    const newDate = date || new Date(Date.now() + (daysFromNow as number) * 24 * 60 * 60 * 1000);
    console.log(`[Automation] Setting due date to ${newDate}`);
    return { success: true };
  }

  private static async generateReport(
    config: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const { reportType, format } = config;
    console.log(`[Automation] Generating ${reportType} report in ${format} format`);
    return { success: true, result: { reportUrl: `/reports/${Date.now()}.${format}` } };
  }
}

// ============================================
// Execution Context
// ============================================

interface ExecutionContext {
  tenantId: string;
  userId?: string;
  taskId?: string;
  projectId?: string;
  triggeredBy: 'system' | 'user' | 'webhook';
  triggerData: Record<string, unknown>;
}

// ============================================
// Automation Engine
// ============================================

export class AutomationEngine {
  private rules: Map<string, AutomationRule> = new Map();
  private executionLog: AutomationExecution[] = [];

  constructor(rules: AutomationRule[] = []) {
    rules.forEach((rule) => {
      if (rule.isEnabled) {
        this.rules.set(rule.id, rule);
      }
    });
  }

  addRule(rule: AutomationRule): void {
    if (rule.isEnabled) {
      this.rules.set(rule.id, rule);
    }
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  async processEvent(
    triggerType: TriggerType,
    eventData: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<AutomationExecution[]> {
    const executions: AutomationExecution[] = [];

    for (const rule of this.rules.values()) {
      if (rule.trigger.type !== triggerType) continue;

      // Check if rule applies to this scope
      if (!this.isInScope(rule, context)) continue;

      // Check trigger-specific conditions
      if (!this.matchesTrigger(rule.trigger.config, eventData)) continue;

      // Evaluate conditions
      const conditionsMatch = ConditionEvaluator.evaluateConditions(
        rule.conditions,
        eventData
      );

      if (!conditionsMatch) continue;

      // Execute actions
      const execution = await this.executeRule(rule, context, eventData);
      executions.push(execution);
    }

    return executions;
  }

  private async executeRule(
    rule: AutomationRule,
    context: ExecutionContext,
    eventData: Record<string, unknown>
  ): Promise<AutomationExecution> {
    const startTime = Date.now();
    const execution: AutomationExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      triggeredAt: new Date().toISOString(),
      triggeredBy: context.triggeredBy,
      triggerData: eventData,
      status: 'running',
      actions: [],
      duration: 0,
    };

    try {
      // Sort actions by order
      const sortedActions = [...rule.actions].sort((a, b) => a.order - b.order);

      for (const action of sortedActions) {
        // Apply delay if specified
        if (action.delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, action.delay * 1000));
        }

        const result = await ActionExecutor.execute(
          action.type,
          this.interpolateVariables(action.config, eventData),
          context
        );

        execution.actions.push({
          type: action.type,
          status: result.success ? 'completed' : 'failed',
          result: result.result,
          error: result.error,
          executedAt: new Date().toISOString(),
        });

        // Stop on failure if action is critical
        if (!result.success && action.config.critical) {
          execution.status = 'failed';
          execution.error = `Action ${action.type} failed: ${result.error}`;
          break;
        }
      }

      if (execution.status === 'running') {
        execution.status = 'completed';
      }
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
    }

    execution.duration = Date.now() - startTime;
    this.executionLog.push(execution);

    // Update rule execution count
    rule.executionCount = (rule.executionCount || 0) + 1;
    rule.lastExecutedAt = new Date().toISOString();

    return execution;
  }

  private isInScope(rule: AutomationRule, context: ExecutionContext): boolean {
    if (!rule.scope) return true;

    if (rule.scope.projects?.length && context.projectId) {
      if (!rule.scope.projects.includes(context.projectId)) return false;
    }

    return true;
  }

  private matchesTrigger(
    triggerConfig: Record<string, unknown>,
    eventData: Record<string, unknown>
  ): boolean {
    // Check if trigger-specific conditions match
    for (const [key, value] of Object.entries(triggerConfig)) {
      if (key === 'field' && value && eventData.changedField !== value) {
        return false;
      }
      if (key === 'oldValue' && value !== undefined && eventData.oldValue !== value) {
        return false;
      }
      if (key === 'newValue' && value !== undefined && eventData.newValue !== value) {
        return false;
      }
    }
    return true;
  }

  private interpolateVariables(
    config: Record<string, unknown>,
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        // Replace {{variable}} patterns
        result[key] = value.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
          const val = path.split('.').reduce((obj: unknown, k: string) => {
            if (obj && typeof obj === 'object') {
              return (obj as Record<string, unknown>)[k];
            }
            return undefined;
          }, data);
          return val !== undefined ? String(val) : '';
        });
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.interpolateVariables(
          value as Record<string, unknown>,
          data
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  getExecutionLog(limit = 100): AutomationExecution[] {
    return this.executionLog.slice(-limit);
  }

  clearExecutionLog(): void {
    this.executionLog = [];
  }
}

// ============================================
// Pre-built Automation Templates
// ============================================

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'notify-overdue',
    name: 'Gecikme Bildirimi',
    description: 'Teslim tarihi geçen siparişler için bildirim gönder',
    category: 'notifications',
    rule: {
      name: 'Gecikme Bildirimi',
      isEnabled: true,
      executionCount: 0,
      trigger: {
        type: 'due_date_approaching',
        config: { threshold: 0 },
      },
      conditions: [
        { field: 'status', operator: 'not_equals', value: 'delivered' },
      ],
      actions: [
        {
          type: 'send_notification',
          config: {
            title: 'Geciken Sipariş',
            message: '{{orderNumber}} numaralı sipariş gecikti!',
            recipients: ['owner', 'assigned'],
          },
          order: 0,
          delay: 0,
        },
        {
          type: 'add_tag',
          config: { tag: 'gecikmiş' },
          order: 1,
          delay: 0,
        },
      ],
    },
    popularity: 95,
  },
  {
    id: 'auto-qc-task',
    name: 'Otomatik Kalite Kontrol',
    description: 'Üretim başladığında QC görevi oluştur',
    category: 'production',
    rule: {
      name: 'Otomatik QC Görevi',
      isEnabled: true,
      executionCount: 0,
      trigger: {
        type: 'status_change',
        config: { newValue: 'in_production' },
      },
      conditions: [],
      actions: [
        {
          type: 'create_subtask',
          config: {
            title: 'Kalite Kontrol',
            template: 'qc-checklist',
          },
          order: 0,
          delay: 0,
        },
      ],
    },
    popularity: 88,
  },
  {
    id: 'daily-report',
    name: 'Günlük Rapor',
    description: 'Her gün saat 18:00\'da üretim raporu oluştur',
    category: 'productivity',
    rule: {
      name: 'Günlük Üretim Raporu',
      isEnabled: true,
      executionCount: 0,
      trigger: {
        type: 'time_based',
        config: {},
      },
      conditions: [],
      actions: [
        {
          type: 'generate_report',
          config: {
            reportType: 'daily_production',
            format: 'pdf',
          },
          order: 0,
          delay: 0,
        },
        {
          type: 'send_email',
          config: {
            to: ['management'],
            subject: 'Günlük Üretim Raporu - {{date}}',
            body: 'Günlük üretim raporu ekte.',
          },
          order: 1,
          delay: 0,
        },
      ],
      schedule: {
        cron: '0 18 * * *',
        timezone: 'Europe/Istanbul',
      },
    },
    popularity: 75,
  },
  {
    id: 'auto-archive',
    name: 'Otomatik Arşivleme',
    description: 'Teslim edilen siparişleri 30 gün sonra arşivle',
    category: 'productivity',
    rule: {
      name: 'Otomatik Arşivleme',
      isEnabled: true,
      executionCount: 0,
      trigger: {
        type: 'status_change',
        config: { newValue: 'delivered' },
      },
      conditions: [],
      actions: [
        {
          type: 'archive_task',
          config: {},
          order: 0,
          delay: 30 * 24 * 60 * 60,
        },
      ],
    },
    popularity: 60,
  },
  {
    id: 'low-inventory-alert',
    name: 'Düşük Stok Uyarısı',
    description: 'Stok kritik seviyeye düştüğünde satın alma bilgilendir',
    category: 'production',
    rule: {
      name: 'Düşük Stok Uyarısı',
      isEnabled: true,
      executionCount: 0,
      trigger: {
        type: 'field_change',
        config: { field: 'inventory.stock' },
      },
      conditions: [
        { field: 'inventory.stock', operator: 'less_than', value: 10 },
      ],
      actions: [
        {
          type: 'send_notification',
          config: {
            title: 'Düşük Stok Uyarısı',
            message: '{{inventory.name}} stoğu kritik seviyede: {{inventory.stock}} adet',
            recipients: ['procurement'],
          },
          order: 0,
          delay: 0,
        },
      ],
    },
    popularity: 82,
  },
];

// ============================================
// Trigger Labels
// ============================================

export const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
  status_change: 'Durum Değişikliği',
  field_change: 'Alan Değişikliği',
  due_date_approaching: 'Teslim Tarihi Yaklaşıyor',
  task_created: 'Görev Oluşturuldu',
  task_assigned: 'Görev Atandı',
  task_completed: 'Görev Tamamlandı',
  time_based: 'Zamanlı Tetikleyici',
  webhook: 'Webhook',
  manual: 'Manuel',
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  update_field: 'Alan Güncelle',
  create_subtask: 'Alt Görev Oluştur',
  send_notification: 'Bildirim Gönder',
  send_email: 'E-posta Gönder',
  send_sms: 'SMS Gönder',
  move_task: 'Görevi Taşı',
  archive_task: 'Görevi Arşivle',
  assign_user: 'Kullanıcı Ata',
  add_tag: 'Etiket Ekle',
  remove_tag: 'Etiket Kaldır',
  call_webhook: 'Webhook Çağır',
  create_task: 'Görev Oluştur',
  duplicate_task: 'Görevi Kopyala',
  add_comment: 'Yorum Ekle',
  set_due_date: 'Teslim Tarihi Belirle',
  start_timer: 'Zamanlayıcı Başlat',
  generate_report: 'Rapor Oluştur',
};
