import { Order, NewOrderFormData } from '@/lib/types';

/**
 * Order Service Interface
 * Defines the contract for order data operations
 * Implementations: MockOrderService, SupabaseOrderService
 */
export interface IOrderService {
  /**
   * Fetch all orders
   */
  getOrders(): Promise<Order[]>;

  /**
   * Get a single order by ID
   */
  getOrderById(id: string): Promise<Order | null>;

  /**
   * Create a new order
   */
  createOrder(formData: NewOrderFormData, files?: File[]): Promise<Order>;

  /**
   * Update an existing order
   */
  updateOrder(id: string, updates: Partial<Order>): Promise<Order>;

  /**
   * Update order status
   */
  updateOrderStatus(id: string, status: Order['status']): Promise<Order>;

  /**
   * Delete an order
   */
  deleteOrder(id: string): Promise<void>;

  /**
   * Add documents to an existing order
   */
  addDocuments(id: string, files: File[]): Promise<Order>;
}
