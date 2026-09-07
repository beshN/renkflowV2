export { getAIService, ZaiAIService } from './service';
export type { AIMessage, AIQueryResult, WorkspaceContext } from './service';
export {
  AI_TOOLS,
  findOrder,
  searchCustomer,
  getInventory,
  getCriticalStock,
  getProductionStatus,
  getPurchasingNeeds,
  getScrapStatistics,
  getWorkOrders,
  getShipmentStatus,
  getDashboardSummary,
} from './tools';
export type { ToolContext, AIToolName } from './tools';
