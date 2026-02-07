/**
 * Finance Actions Index
 * Enterprise-grade re-exports for all finance-related server actions
 */

// ============================================
// Payment Actions
// ============================================
export {
  createPayment,
  listPaymentsByOrder,
  listAllPayments,
  deletePayment,
  getOrdersWithPayments,
  getThisMonthPaymentsTotal,
  getOutstandingReceivables,
} from './finance.payments.actions';

// ============================================
// Document Actions
// ============================================
export {
  uploadOrderDocument,
  listOrderDocuments,
  listAllDocuments,
  deleteOrderDocument,
  getRecentDocuments,
} from './finance.documents.actions';

// ============================================
// Employee & Ledger Actions
// ============================================
export {
  createEmployee,
  listEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  addLedgerEntry,
  listLedgerEntries,
  getThisMonthPayrollCost,
  getEmployeeBalance,
  getEmployeeWithBalance,
} from './finance.employees.actions';

// ============================================
// Overview & Analytics Actions
// ============================================
export {
  getFinanceOverview,
  getDailyPaymentTrend,
  getPaymentMethodBreakdown,
  getTopCustomers,
  getMonthlySummary,
  getAuditLogSummary,
} from './finance.overview.actions';

// ============================================
// Batch Operations
// ============================================
export {
  batchDeletePayments,
  batchDeleteDocuments,
  batchUpdateEmployees,
  batchDeleteLedgerEntries,
  logExportAction,
} from './finance.batch.actions';

// ============================================
// Type Re-exports
// ============================================
export type {
  FinanceOverviewData,
  DailyPaymentData,
  PaymentMethodBreakdown,
  TopCustomerData,
  MonthlySummary,
} from './finance.overview.actions';

export type {
  BatchOperationResult,
} from './finance.batch.actions';
