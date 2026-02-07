import { Order, NewOrderFormData } from '@/lib/types';

export class TenantMismatchError extends Error {
  constructor() {
    super('Tenant mismatch');
    this.name = 'TenantMismatchError';
  }
}

/**
 * Order Service Interface
 * Defines the contract for order data operations
 * Implementations: MockOrderService, SupabaseOrderService
 */
export interface IOrderService {
  /**
   * Fetch all orders
   */
  getOrders(tenantId: string): Promise<Order[]>;

  /**
   * Get a single order by ID
   */
  getOrderById(tenantId: string, id: string): Promise<Order | null>;

  /**
   * Create a new order
   */
  createOrder(tenantId: string, formData: NewOrderFormData, files?: File[]): Promise<Order>;

  /**
   * Update an existing order
   */
  updateOrder(tenantId: string, id: string, updates: Partial<Order>): Promise<Order>;

  /**
   * Update order status
   */
  updateOrderStatus(tenantId: string, id: string, status: Order['status']): Promise<Order>;

  /**
   * Delete an order
   */
  deleteOrder(tenantId: string, id: string): Promise<void>;

  /**
   * Add documents to an existing order
   */
  addDocuments(tenantId: string, id: string, files: File[]): Promise<Order>;
}
