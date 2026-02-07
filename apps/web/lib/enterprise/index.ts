/**
 * Enterprise Module Index
 * Central export point for all enterprise features
 */

// ============================================
// Types
// ============================================
export * from '@/lib/types/enterprise';

// ============================================
// Stores
// ============================================
export { useViewStore, selectCurrentView, selectListConfig, selectCalendarConfig, selectGanttConfig, selectDashboardConfig } from '@/lib/stores/view.store';
export { useTimeTrackingStore, selectTimer, selectPomodoro, selectIsTimerRunning, selectTodayEntries } from '@/lib/stores/timeTracking.store';
export { useResourceStore, selectResources, selectAllocations, selectActiveResources, RESOURCE_TYPE_LABELS } from '@/lib/stores/resource.store';
export { useDocsStore, selectDocuments, selectActiveDocument, selectWhiteboards, BLOCK_TYPE_LABELS } from '@/lib/stores/docs.store';
export { usePortfolioStore, selectPortfolios, selectActivePortfolio, PORTFOLIO_HEALTH_LABELS, PROJECT_STATUS_LABELS } from '@/lib/stores/portfolio.store';

// ============================================
// Services
// ============================================
export { AutomationEngine, ConditionEvaluator, ActionExecutor, AUTOMATION_TEMPLATES, TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS } from '@/lib/services/automation.service';
export { AIService, getAIService } from '@/lib/services/ai.service';
export { ReportBuilder, ChartDataGenerator, ReportExecutor, REPORT_TEMPLATES, CHART_TYPE_LABELS } from '@/lib/services/reporting.service';

// ============================================
// Utilities
// ============================================
export { DependencyGraph, validateDependency, DEPENDENCY_TYPE_LABELS, DEPENDENCY_TYPE_DESCRIPTIONS, exportDependenciesToMermaid } from '@/lib/utils/dependencies';

// ============================================
// View Components Re-exports
// ============================================
// These are client components, so they should be imported directly where needed
// export { ViewSwitcher, CompactViewSwitcher, ViewIndicator } from '@/components/views/ViewSwitcher';
// export { ListView } from '@/components/views/ListView';
// export { CalendarView } from '@/components/views/CalendarView';
// export { GanttView } from '@/components/views/GanttView';
// export { TimerWidget, FloatingTimerButton } from '@/components/time-tracking/TimerWidget';

// ============================================
// Feature Flags
// ============================================
export const ENTERPRISE_FEATURES = {
  multiView: true,
  dependencies: true,
  timeTracking: true,
  automation: true,
  docs: true,
  whiteboard: true,
  aiAssistant: true,
  resourcePlanning: true,
  portfolioManagement: true,
  advancedReporting: true,
} as const;

export type EnterpriseFeature = keyof typeof ENTERPRISE_FEATURES;

export function isFeatureEnabled(feature: EnterpriseFeature): boolean {
  return ENTERPRISE_FEATURES[feature];
}

// ============================================
// Version Info
// ============================================
export const ENTERPRISE_VERSION = '1.0.0';
export const ENTERPRISE_BUILD_DATE = '2024-01-15';
