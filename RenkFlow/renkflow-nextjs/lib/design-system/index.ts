/**
 * Design System Entry Point
 */

export * from './tokens';

// Organism Components Exports Placeholder
// export { OrderList } from './order-list';
// export { DashboardStats } from './dashboard-stats';

/**
 * Utility to apply design tokens to dynamic styles
 */
export function getSemanticColor(status: string) {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'success':
      return 'text-green-600 bg-green-50';
    case 'pending':
    case 'warning':
      return 'text-blue-600 bg-blue-50';
    case 'failed':
    case 'danger':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-slate-600 bg-slate-50';
  }
}
