/**
 * Enterprise Module Type Definitions
 * Multi-View, Dependencies, Time Tracking, Automation, Resources
 */

import { z } from 'zod';

// ============================================
// 1. MULTI-VIEW ARCHITECTURE TYPES
// ============================================

export const ViewTypeSchema = z.enum([
  'list',      // Tabular display
  'board',     // Kanban board
  'calendar',  // Calendar view
  'gantt',     // Timeline/Gantt view
  'dashboard', // Customizable widgets
  'map',       // Location-based view
]);
export type ViewType = z.infer<typeof ViewTypeSchema>;

export interface ViewConfig {
  type: ViewType;
  name: string;
  icon: string;
  isDefault?: boolean;
  settings?: Record<string, unknown>;
}

export interface ListViewConfig {
  columns: ColumnDefinition[];
  rowHeight: 'compact' | 'normal' | 'relaxed';
  stripedRows: boolean;
  showGridLines: boolean;
  frozenColumns: number;
}

export interface ColumnDefinition {
  id: string;
  accessorKey: string;
  header: string;
  type: 'text' | 'number' | 'date' | 'status' | 'priority' | 'user' | 'currency' | 'progress' | 'custom';
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  visible?: boolean;
  frozen?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: string;
  renderCell?: string; // component name
}

export interface CalendarViewConfig {
  defaultView: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';
  firstDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  slotMinTime: string; // '08:00:00'
  slotMaxTime: string; // '20:00:00'
  showWeekNumbers: boolean;
  businessHours: BusinessHours[];
}

export interface BusinessHours {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
}

export interface GanttViewConfig {
  timeScale: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  showDependencies: boolean;
  showCriticalPath: boolean;
  showMilestones: boolean;
  showProgress: boolean;
  rowHeight: number;
  columnWidth: number;
}

export interface DashboardViewConfig {
  widgets: DashboardWidget[];
  layout: 'grid' | 'freeform';
  columns: number;
  rowHeight: number;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  config: Record<string, unknown>;
  refreshInterval?: number; // seconds
}

export type WidgetType = 
  | 'stats_card'
  | 'chart_bar'
  | 'chart_line'
  | 'chart_pie'
  | 'chart_donut'
  | 'table'
  | 'kanban_summary'
  | 'calendar_mini'
  | 'task_list'
  | 'burndown'
  | 'burnup'
  | 'cumulative_flow'
  | 'velocity'
  | 'cycle_time'
  | 'workload_heatmap'
  | 'resource_allocation'
  | 'custom';

export interface MapViewConfig {
  defaultZoom: number;
  defaultCenter: { lat: number; lng: number };
  clusterMarkers: boolean;
  showRoutes: boolean;
  mapStyle: 'standard' | 'satellite' | 'terrain';
}

// ============================================
// 2. TASK DEPENDENCIES TYPES
// ============================================

export const DependencyTypeSchema = z.enum([
  'FS', // Finish-to-Start: B starts after A finishes
  'SS', // Start-to-Start: B starts when A starts
  'FF', // Finish-to-Finish: B finishes when A finishes
  'SF', // Start-to-Finish: B finishes when A starts
]);
export type DependencyType = z.infer<typeof DependencyTypeSchema>;

export const DependencySchema = z.object({
  id: z.string().uuid(),
  sourceTaskId: z.string().uuid(),
  targetTaskId: z.string().uuid(),
  type: DependencyTypeSchema,
  lagDays: z.number().default(0), // Delay between tasks
  lagHours: z.number().default(0),
  isHard: z.boolean().default(true), // Hard = must respect, Soft = preferred
  createdAt: z.string(),
  createdBy: z.string().uuid().optional(),
});
export type Dependency = z.infer<typeof DependencySchema>;

export interface DependencyNode {
  taskId: string;
  taskName: string;
  startDate: Date;
  endDate: Date;
  duration: number; // hours
  progress: number; // 0-100
  dependencies: string[]; // incoming dependency IDs
  dependents: string[]; // outgoing dependency IDs
  isCritical: boolean;
  earlyStart: Date | null;
  earlyFinish: Date | null;
  lateStart: Date | null;
  lateFinish: Date | null;
  totalFloat: number; // slack time in hours
  freeFloat: number;
}

export interface CriticalPathResult {
  criticalPath: string[]; // task IDs in order
  totalDuration: number; // hours
  startDate: Date;
  endDate: Date;
  milestones: Milestone[];
  floatAnalysis: FloatAnalysis[];
}

export interface Milestone {
  id: string;
  name: string;
  date: Date;
  taskId?: string;
  isCompleted: boolean;
}

export interface FloatAnalysis {
  taskId: string;
  taskName: string;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
}

// ============================================
// 3. TIME TRACKING TYPES
// ============================================

export const TimeEntryStatusSchema = z.enum(['running', 'paused', 'stopped']);
export type TimeEntryStatus = z.infer<typeof TimeEntryStatusSchema>;

export const TimeEntrySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  description: z.string().optional(),
  startTime: z.string(),
  endTime: z.string().optional(),
  duration: z.number().default(0), // seconds
  billable: z.boolean().default(false),
  billableRate: z.number().optional(),
  tags: z.array(z.string()).default([]),
  status: TimeEntryStatusSchema.default('stopped'),
  source: z.enum(['manual', 'timer', 'pomodoro', 'automatic']).default('manual'),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TimeEntry = z.infer<typeof TimeEntrySchema>;

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  currentEntryId: string | null;
  startTime: number | null;
  pausedAt: number | null;
  accumulatedTime: number; // seconds
  taskId: string | null;
  description: string;
}

export interface PomodoroConfig {
  workDuration: number; // minutes (default: 25)
  shortBreakDuration: number; // minutes (default: 5)
  longBreakDuration: number; // minutes (default: 15)
  sessionsBeforeLongBreak: number; // default: 4
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  notifications: boolean;
  sounds: boolean;
}

export interface PomodoroState {
  isActive: boolean;
  type: 'work' | 'short_break' | 'long_break';
  sessionsCompleted: number;
  currentSession: number;
  timeRemaining: number; // seconds
}

export interface TimesheetEntry {
  date: string;
  entries: TimeEntry[];
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
}

export interface WeeklyTimesheet {
  weekStart: string;
  weekEnd: string;
  days: TimesheetEntry[];
  totalHours: number;
  billableHours: number;
  targetHours: number;
  overtimeHours: number;
}

export interface TimeReport {
  period: { start: string; end: string };
  byUser: { userId: string; userName: string; hours: number; billable: number }[];
  byProject: { projectId: string; projectName: string; hours: number }[];
  byTask: { taskId: string; taskName: string; hours: number }[];
  byDay: { date: string; hours: number }[];
  totals: {
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    overtime: number;
    estimatedCost: number;
  };
}

// ============================================
// 4. AUTOMATION ENGINE TYPES
// ============================================

export const TriggerTypeSchema = z.enum([
  'status_change',
  'field_change',
  'due_date_approaching',
  'task_created',
  'task_assigned',
  'task_completed',
  'time_based',
  'webhook',
  'manual',
]);
export type TriggerType = z.infer<typeof TriggerTypeSchema>;

export const ActionTypeSchema = z.enum([
  'update_field',
  'create_subtask',
  'send_notification',
  'send_email',
  'send_sms',
  'move_task',
  'archive_task',
  'assign_user',
  'add_tag',
  'remove_tag',
  'call_webhook',
  'create_task',
  'duplicate_task',
  'add_comment',
  'set_due_date',
  'start_timer',
  'generate_report',
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const ConditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'less_than',
  'greater_or_equal',
  'less_or_equal',
  'is_empty',
  'is_not_empty',
  'in_list',
  'not_in_list',
  'matches_regex',
  'between',
  'is_today',
  'is_overdue',
  'is_this_week',
]);
export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

export const AutomationRuleSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  isEnabled: z.boolean().default(true),
  trigger: z.object({
    type: TriggerTypeSchema,
    config: z.record(z.string(), z.unknown()),
  }),
  conditions: z.array(z.object({
    field: z.string(),
    operator: ConditionOperatorSchema,
    value: z.unknown(),
    logicalOperator: z.enum(['AND', 'OR']).optional(),
  })).default([]),
  actions: z.array(z.object({
    type: ActionTypeSchema,
    config: z.record(z.string(), z.unknown()),
    order: z.number().default(0),
    delay: z.number().default(0), // seconds
  })),
  scope: z.object({
    projects: z.array(z.string()).optional(),
    statuses: z.array(z.string()).optional(),
    users: z.array(z.string()).optional(),
  }).optional(),
  schedule: z.object({
    cron: z.string().optional(), // For time-based triggers
    timezone: z.string().default('Europe/Istanbul'),
  }).optional(),
  executionCount: z.number().default(0),
  lastExecutedAt: z.string().optional(),
  createdAt: z.string(),
  createdBy: z.string().uuid(),
  updatedAt: z.string(),
});
export type AutomationRule = z.infer<typeof AutomationRuleSchema>;

export interface AutomationExecution {
  id: string;
  ruleId: string;
  ruleName: string;
  triggeredAt: string;
  triggeredBy: 'system' | 'user' | 'webhook';
  triggerData: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  actions: {
    type: ActionType;
    status: 'pending' | 'completed' | 'failed' | 'skipped';
    result?: unknown;
    error?: string;
    executedAt?: string;
  }[];
  duration: number; // milliseconds
  error?: string;
}

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'productivity' | 'notifications' | 'quality' | 'production' | 'custom';
  rule: Omit<AutomationRule, 'id' | 'tenantId' | 'createdAt' | 'createdBy' | 'updatedAt'>;
  popularity: number;
}

// ============================================
// 5. DOCUMENTS & WHITEBOARD TYPES
// ============================================

export const DocBlockTypeSchema = z.enum([
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bullet_list',
  'numbered_list',
  'todo_list',
  'code',
  'quote',
  'divider',
  'table',
  'image',
  'video',
  'embed',
  'task_reference',
  'mention',
  'callout',
  'toggle',
]);
export type DocBlockType = z.infer<typeof DocBlockTypeSchema>;

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  title: z.string().min(1),
  content: z.string(), // JSON stringified blocks
  parentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  icon: z.string().optional(),
  coverImage: z.string().url().optional(),
  isTemplate: z.boolean().default(false),
  isArchived: z.boolean().default(false),
  permissions: z.object({
    view: z.array(z.string()),
    edit: z.array(z.string()),
    comment: z.array(z.string()),
  }).optional(),
  version: z.number().default(1),
  lastEditedBy: z.string().uuid().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Doc = z.infer<typeof DocumentSchema>;

export interface DocBlock {
  id: string;
  type: DocBlockType;
  content: unknown;
  children?: DocBlock[];
  props?: Record<string, unknown>;
}

export interface DocComment {
  id: string;
  docId: string;
  blockId?: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  isResolved: boolean;
  replies: DocComment[];
  createdAt: string;
  updatedAt: string;
}

export interface WhiteboardSchema {
  id: string;
  tenantId: string;
  title: string;
  elements: WhiteboardElement[];
  viewport: { x: number; y: number; zoom: number };
  backgroundColor: string;
  gridEnabled: boolean;
  gridSize: number;
  projectId?: string;
  taskId?: string;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WhiteboardElement {
  id: string;
  type: 'sticky' | 'shape' | 'text' | 'image' | 'drawing' | 'connector' | 'frame' | 'embed';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  props: Record<string, unknown>;
  children?: string[]; // for frames
  connectedTo?: string[]; // for connectors
}

// ============================================
// 6. AI ASSISTANT TYPES
// ============================================

export const AICapabilitySchema = z.enum([
  'query',
  'summarize',
  'generate',
  'analyze',
  'forecast',
  'suggest',
  'automate',
  'search',
]);
export type AICapability = z.infer<typeof AICapabilitySchema>;

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    capability?: AICapability;
    sources?: string[];
    confidence?: number;
    processingTime?: number;
  };
}

export interface AIConversation {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  messages: AIMessage[];
  context: {
    projectIds?: string[];
    taskIds?: string[];
    docIds?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface AIQueryResult {
  answer: string;
  sources: {
    type: 'task' | 'doc' | 'comment' | 'external';
    id: string;
    title: string;
    snippet: string;
  }[];
  suggestions?: string[];
  confidence: number;
}

export interface AISuggestion {
  id: string;
  type: 'task_breakdown' | 'schedule' | 'resource' | 'automation' | 'content';
  title: string;
  description: string;
  preview?: unknown;
  confidence: number;
  reasoning: string;
}

// ============================================
// 7. RESOURCE & CAPACITY PLANNING TYPES
// ============================================

export const ResourceTypeSchema = z.enum([
  'human',
  'machine',
  'material',
  'facility',
  'tool',
]);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const ResourceSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  type: ResourceTypeSchema,
  code: z.string().optional(),
  description: z.string().optional(),
  capacity: z.object({
    hoursPerDay: z.number().default(8),
    daysPerWeek: z.number().default(5),
    efficiency: z.number().min(0).max(100).default(100), // percentage
  }),
  cost: z.object({
    hourlyRate: z.number().optional(),
    currency: z.string().default('TRY'),
  }).optional(),
  skills: z.array(z.string()).default([]),
  availability: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string(),
    endTime: z.string(),
  })).optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Resource = z.infer<typeof ResourceSchema>;

export interface ResourceAllocation {
  id: string;
  resourceId: string;
  resourceName: string;
  taskId: string;
  taskName: string;
  projectId?: string;
  startDate: string;
  endDate: string;
  hoursAllocated: number;
  hoursUsed: number;
  percentage: number; // 0-100
  status: 'planned' | 'active' | 'completed';
}

export interface ResourceCapacity {
  resourceId: string;
  resourceName: string;
  resourceType: ResourceType;
  period: { start: string; end: string };
  totalCapacity: number; // hours
  allocatedHours: number;
  availableHours: number;
  utilizationRate: number; // percentage
  overallocated: boolean;
  allocations: ResourceAllocation[];
}

export interface WorkloadSummary {
  userId: string;
  userName: string;
  userAvatar?: string;
  period: { start: string; end: string };
  targetHours: number;
  allocatedHours: number;
  completedHours: number;
  utilizationRate: number;
  status: 'under' | 'optimal' | 'over';
  tasks: {
    taskId: string;
    taskName: string;
    hours: number;
    dueDate?: string;
    priority?: string;
  }[];
}

export interface CapacityPlan {
  id: string;
  tenantId: string;
  name: string;
  period: { start: string; end: string };
  resources: ResourceCapacity[];
  demand: {
    projectId: string;
    projectName: string;
    requiredHours: number;
    allocatedHours: number;
    gap: number;
  }[];
  summary: {
    totalCapacity: number;
    totalDemand: number;
    gap: number;
    utilizationRate: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 8. PORTFOLIO MANAGEMENT TYPES
// ============================================

export const PortfolioHealthSchema = z.enum(['green', 'yellow', 'red']);
export type PortfolioHealth = z.infer<typeof PortfolioHealthSchema>;

export const PortfolioSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  ownerId: z.string().uuid(),
  projectIds: z.array(z.string().uuid()),
  tags: z.array(z.string()).default([]),
  budget: z.object({
    allocated: z.number(),
    spent: z.number(),
    currency: z.string().default('TRY'),
  }).optional(),
  timeline: z.object({
    startDate: z.string(),
    endDate: z.string(),
    milestones: z.array(z.object({
      id: z.string(),
      name: z.string(),
      date: z.string(),
      status: z.enum(['pending', 'completed', 'missed']),
    })),
  }).optional(),
  goals: z.array(z.object({
    id: z.string(),
    name: z.string(),
    target: z.number(),
    current: z.number(),
    unit: z.string(),
  })).default([]),
  isArchived: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Portfolio = z.infer<typeof PortfolioSchema>;

export interface PortfolioSummary {
  portfolioId: string;
  portfolioName: string;
  projectCount: number;
  health: PortfolioHealth;
  progress: number; // 0-100
  budget: {
    allocated: number;
    spent: number;
    remaining: number;
    variance: number; // percentage
  };
  schedule: {
    onTrack: number;
    atRisk: number;
    delayed: number;
  };
  resources: {
    allocated: number;
    utilized: number;
    available: number;
  };
  risks: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface ProjectInPortfolio {
  id: string;
  name: string;
  status: 'not_started' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  health: PortfolioHealth;
  progress: number;
  startDate: string;
  endDate: string;
  budget: { allocated: number; spent: number };
  tasks: { total: number; completed: number };
  owner: { id: string; name: string; avatar?: string };
  lastUpdated: string;
}

// ============================================
// 9. ADVANCED REPORTING TYPES
// ============================================

export const ChartTypeSchema = z.enum([
  'bar',
  'stacked_bar',
  'line',
  'area',
  'pie',
  'donut',
  'funnel',
  'heatmap',
  'scatter',
  'radar',
  'treemap',
  'sankey',
  'gauge',
  'number',
  'table',
  'pivot',
]);
export type ChartType = z.infer<typeof ChartTypeSchema>;

export const ReportSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['standard', 'custom', 'template']),
  category: z.enum([
    'productivity',
    'time',
    'finance',
    'resources',
    'quality',
    'production',
    'executive',
  ]),
  dataSource: z.object({
    type: z.enum(['tasks', 'time_entries', 'orders', 'employees', 'custom']),
    filters: z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.unknown(),
    })).default([]),
    groupBy: z.array(z.string()).default([]),
    aggregations: z.array(z.object({
      field: z.string(),
      function: z.enum(['sum', 'avg', 'count', 'min', 'max', 'distinct']),
      alias: z.string(),
    })).default([]),
    dateRange: z.object({
      field: z.string(),
      preset: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
  }),
  visualizations: z.array(z.object({
    id: z.string(),
    type: ChartTypeSchema,
    title: z.string(),
    config: z.record(z.string(), z.unknown()),
    position: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  })),
  schedule: z.object({
    enabled: z.boolean().default(false),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']).optional(),
    recipients: z.array(z.string()).default([]),
    format: z.enum(['pdf', 'excel', 'csv']).default('pdf'),
  }).optional(),
  permissions: z.object({
    viewerIds: z.array(z.string()),
    editorIds: z.array(z.string()),
  }).optional(),
  isPublic: z.boolean().default(false),
  createdBy: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Report = z.infer<typeof ReportSchema>;

export interface ReportExecution {
  id: string;
  reportId: string;
  executedAt: string;
  executedBy: string;
  duration: number; // milliseconds
  rowCount: number;
  status: 'success' | 'failed' | 'partial';
  error?: string;
  outputUrl?: string;
}

export interface BurndownData {
  date: string;
  idealRemaining: number;
  actualRemaining: number;
  completed: number;
  added: number;
}

export interface CumulativeFlowData {
  date: string;
  statuses: Record<string, number>;
}

export interface CycleTimeData {
  taskId: string;
  taskName: string;
  startDate: string;
  endDate: string;
  cycleTime: number; // hours
  leadTime: number; // hours
  waitTime: number; // hours
  workTime: number; // hours
}

export interface VelocityData {
  period: string;
  planned: number;
  completed: number;
  velocity: number;
  trend: number; // percentage change
}

// ============================================
// 10. PRODUCTION-SPECIFIC TYPES
// ============================================

export interface ShiftSchedule {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string;
  breakMinutes: number;
  daysOfWeek: number[];
  color: string;
}

export interface MachineStatus {
  machineId: string;
  machineName: string;
  status: 'running' | 'idle' | 'maintenance' | 'breakdown' | 'setup';
  currentOrderId?: string;
  currentOperatorId?: string;
  utilization: number; // percentage
  efficiency: number; // OEE
  lastStatusChange: string;
}

export interface ProductionMetrics {
  date: string;
  shiftId: string;
  machineId?: string;
  plannedOutput: number;
  actualOutput: number;
  defects: number;
  downtime: number; // minutes
  setupTime: number;
  efficiency: number;
  quality: number;
  availability: number;
  oee: number; // Overall Equipment Effectiveness
}

export interface InventoryLevel {
  materialId: string;
  materialName: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  unit: string;
  status: 'ok' | 'low' | 'critical' | 'excess';
  lastUpdated: string;
}
