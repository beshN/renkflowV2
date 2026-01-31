// @/components/ui/primitive/index.ts
// Atomic Design System

export const tokens = {
  colors: {
    primary: { 50: '#eff6ff', 500: '#3b82f6', 900: '#1e3a8a' },
    danger: { 500: '#ef4444' },
    success: { 500: '#22c55e' }
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  radius: { sm: 4, md: 8, lg: 12 }
};

// Molecule Components
export { OrderCard } from './order-card';
export { StatusBadge } from './status-badge';
export { CustomerInfo } from './customer-info';

// Organism Components  
export { OrderList } from './order-list';
export { DashboardStats } from './dashboard-stats';
