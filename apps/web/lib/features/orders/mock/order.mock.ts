import { Order, NewOrderFormData, createOrderId, createTenantId, createDocumentId, safeParseCurrency } from '@/lib/types';
import { IOrderService } from '../types';
import { sampleOrders } from '@/lib/data/sampleOrders';
import { generateId } from '@/lib/utils';

/**
 * Mock Order Service with SSR-Safe Storage and Synchronization
 * - Uses in-memory storage for SSR compatibility
 * - localStorage for client-side persistence
 * - Object URL tracking to prevent memory leaks
 */
export class MockOrderService implements IOrderService {
  private readonly STORAGE_KEY = 'renkflow-orders';
  private static inMemoryOrders: Order[] | null = null;
  private static objectUrls: Set<string> = new Set();

  private isClient(): boolean {
    return typeof window !== 'undefined';
  }

  private normalizeOrder(order: Partial<Order> & Record<string, unknown>): Order {
    const legacyCustomer = order.customer as string | undefined;
    const legacyProduct = order.product as string | undefined;
    const legacyAmount = order.amount as number | undefined;
    const legacyNotes = order.description as string | undefined;
    const date = order.date || new Date().toISOString().split('T')[0];
    const createdAt = order.createdAt || `${date}T00:00:00Z`;
    const updatedAt = order.updatedAt || createdAt;

    const rawId = (order.id as string) || `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const tenantId = order.tenantId ? createTenantId(order.tenantId as string) : undefined;

    return {
      id: createOrderId(rawId),
      orderNumber: order.orderNumber || `RF-${String(order.id || Date.now()).slice(-6)}`,
      customerName: order.customerName || legacyCustomer || 'Bilinmeyen Müşteri',
      email: order.email as string | undefined,
      phone: order.phone as string | undefined,
      date,
      deliveryDate: order.deliveryDate as string | undefined,
      totalAmount: typeof order.totalAmount === 'number' ? order.totalAmount : (legacyAmount || 0),
      currency: safeParseCurrency(order.currency),
      status: (order.status as Order['status']) || 'pending',
      priority: order.priority as Order['priority'],
      notes: order.notes || legacyNotes,
      productName: order.productName || legacyProduct,
      quantity: order.quantity as number | undefined,
      customFields: order.customFields as Record<string, string> | undefined,
      documents: order.documents as Order['documents'],
      tenantId,
      createdAt,
      updatedAt,
    };
  }

  /**
   * Cleanup method for object URLs - call on unmount or before unload
   */
  public static cleanup(): void {
    if (typeof window !== 'undefined') {
      MockOrderService.objectUrls.forEach((url) => URL.revokeObjectURL(url));
      MockOrderService.objectUrls.clear();
    }
  }

  private getStoredOrders(): Order[] {
    try {
      // Server-side: strictly use in-memory
      if (!this.isClient()) {
        if (MockOrderService.inMemoryOrders === null) {
          MockOrderService.inMemoryOrders = [...sampleOrders].map((order) => this.normalizeOrder(order));
        }
        return MockOrderService.inMemoryOrders;
      }

      // Client-side: Sync strategy
      const stored = localStorage.getItem(this.STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored);
        const normalized = Array.isArray(parsed)
          ? parsed.map((order) => this.normalizeOrder(order))
          : [];
        // Update in-memory cache to match localStorage
        MockOrderService.inMemoryOrders = normalized;
        // Persist normalized version if needed
        this.saveOrders(normalized);
        return normalized;
      }

      // If no localStorage, but we have in-memory (e.g. from initial load)
      if (MockOrderService.inMemoryOrders !== null) {
        this.saveOrders(MockOrderService.inMemoryOrders);
        return MockOrderService.inMemoryOrders;
      }

      // Fallback to sample data
      const normalized = sampleOrders.map((order) => this.normalizeOrder(order));
      this.saveOrders(normalized);
      return normalized;
    } catch (error) {
      console.error('Error loading orders from localStorage:', error);
      const fallback = MockOrderService.inMemoryOrders || sampleOrders;
      return fallback.map((order) => this.normalizeOrder(order));
    }
  }

  private saveOrders(orders: Order[]): void {
    try {
      MockOrderService.inMemoryOrders = orders;

      if (this.isClient()) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(orders));
      }
    } catch (error) {
      console.error('Error saving orders to localStorage:', error);
    }
  }

  async getOrders(tenantId: string): Promise<Order[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const orders = this.getStoredOrders();
    return orders.filter((order) => !order.tenantId || order.tenantId === tenantId);
  }

  async getOrderById(tenantId: string, id: string): Promise<Order | null> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const orders = this.getStoredOrders();
    return orders.find((order) => order.id === id && (!order.tenantId || order.tenantId === tenantId)) || null;
  }

  async createOrder(tenantId: string, formData: NewOrderFormData, files?: File[]): Promise<Order> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const totalAmount = formData.totalAmount || 0;
    const orderNumber = `RF-${Date.now().toString().slice(-6)}`;
    const deliveryDate = formData.deliveryDate || undefined;
    const priority: Order['priority'] =
      deliveryDate && new Date(deliveryDate).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000
        ? 'urgent'
        : totalAmount > 20000
          ? 'high'
          : totalAmount > 10000
            ? 'medium'
            : 'low';

    let documents: Order['documents'] = [];
    if (files && files.length > 0) {
      documents = files.map((file) => {
        const url = URL.createObjectURL(file);
        MockOrderService.objectUrls.add(url);
        return {
          id: createDocumentId(Math.random().toString(36).substr(2, 9)),
          name: file.name,
          url,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        };
      });
    }

    const newOrder: Order = {
      id: createOrderId(generateId()),
      orderNumber,
      customerName: formData.customerName,
      email: formData.email,
      phone: formData.phone,
      date: new Date().toISOString().split('T')[0],
      deliveryDate,
      totalAmount,
      currency: safeParseCurrency(formData.currency),
      status: 'pending',
      priority,
      productName: formData.productName,
      quantity: formData.quantity,
      notes: formData.notes,
      customFields: formData.customFields,
      documents,
      tenantId: createTenantId(tenantId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const orders = this.getStoredOrders();
    const updatedOrders = [...orders, newOrder];
    this.saveOrders(updatedOrders);

    return newOrder;
  }

  async updateOrder(tenantId: string, id: string, updates: Partial<Order>): Promise<Order> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const orders = this.getStoredOrders();
    const index = orders.findIndex((order) => order.id === id && (!order.tenantId || order.tenantId === tenantId));

    if (index === -1) {
      throw new Error(`Order with id ${id} not found`);
    }

    const updatedOrder = { ...orders[index], ...updates, updatedAt: new Date().toISOString() };
    orders[index] = updatedOrder;
    this.saveOrders(orders);

    return updatedOrder;
  }

  async updateOrderStatus(tenantId: string, id: string, status: Order['status']): Promise<Order> {
    return this.updateOrder(tenantId, id, { status });
  }

  async deleteOrder(tenantId: string, id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const orders = this.getStoredOrders();
    const filteredOrders = orders.filter((order) => !(order.id === id && (!order.tenantId || order.tenantId === tenantId)));
    this.saveOrders(filteredOrders);
  }

  async addDocuments(tenantId: string, id: string, files: File[]): Promise<Order> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const orders = this.getStoredOrders();
    const index = orders.findIndex((order) => order.id === id && (!order.tenantId || order.tenantId === tenantId));

    if (index === -1) {
      throw new Error(`Order with id ${id} not found`);
    }

    const newDocuments = files.map((file) => {
      const url = URL.createObjectURL(file);
      MockOrderService.objectUrls.add(url);
      return {
        id: createDocumentId(Math.random().toString(36).substr(2, 9)),
        name: file.name,
        url,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };
    });

    const currentDocuments = orders[index].documents || [];
    orders[index].documents = [...currentDocuments, ...newDocuments];

    this.saveOrders(orders);

    return orders[index];
  }
}
