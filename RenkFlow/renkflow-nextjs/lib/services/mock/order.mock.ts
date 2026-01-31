import { Order, NewOrderFormData } from '@/lib/types';
import { IOrderService } from '../types';
import { sampleOrders } from '@/lib/data/sampleOrders';
import { generateId } from '@/lib/utils';

/**
 * Mock Order Service
 * Uses in-memory storage for SSR compatibility, localStorage for client persistence
 */
export class MockOrderService implements IOrderService {
  private readonly STORAGE_KEY = 'renkflow-orders';
  private static inMemoryOrders: Order[] | null = null;

  private isClient(): boolean {
    return typeof window !== 'undefined';
  }

  private getStoredOrders(): Order[] {
    try {
      // Server-side: use in-memory storage
      if (!this.isClient()) {
        if (MockOrderService.inMemoryOrders === null) {
          MockOrderService.inMemoryOrders = [...sampleOrders];
        }
        return MockOrderService.inMemoryOrders;
      }
      
      // Client-side: use localStorage
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      // Initialize with sample data on first load
      this.saveOrders(sampleOrders);
      return sampleOrders;
    } catch (error) {
      console.error('Error loading orders from localStorage:', error);
      return sampleOrders;
    }
  }

  private saveOrders(orders: Order[]): void {
    try {
      // Server-side: use in-memory storage
      if (!this.isClient()) {
        MockOrderService.inMemoryOrders = orders;
        return;
      }
      
      // Client-side: use localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(orders));
    } catch (error) {
      console.error('Error saving orders to localStorage:', error);
    }
  }

  async getOrders(): Promise<Order[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.getStoredOrders();
  }

  async getOrderById(id: string): Promise<Order | null> {
    await new Promise(resolve => setTimeout(resolve, 50));
    const orders = this.getStoredOrders();
    return orders.find(order => order.id === id) || null;
  }

  async createOrder(formData: NewOrderFormData, files?: File[]): Promise<Order> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const newOrder: Order = {
      id: generateId(),
      customer: formData.customerName,
      email: formData.customerEmail,
      phone: formData.customerPhone,
      date: new Date().toISOString().split('T')[0],
      deliveryDate: formData.deliveryDate,
      amount: formData.quantity * (formData.unitPrice || 0),
      currency: '₺',
      status: 'pending',
      product: formData.productName,
      quantity: formData.quantity,
      description: formData.notes,
      documents: formData.documents,
    };

    const orders = this.getStoredOrders();
    const updatedOrders = [...orders, newOrder];
    this.saveOrders(updatedOrders);

    return newOrder;
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const orders = this.getStoredOrders();
    const index = orders.findIndex(order => order.id === id);
    
    if (index === -1) {
      throw new Error(`Order with id ${id} not found`);
    }

    const updatedOrder = { ...orders[index], ...updates };
    orders[index] = updatedOrder;
    this.saveOrders(orders);

    return updatedOrder;
  }

  async updateOrderStatus(id: string, status: Order['status']): Promise<Order> {
    return this.updateOrder(id, { status });
  }

  async deleteOrder(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const orders = this.getStoredOrders();
    const filteredOrders = orders.filter(order => order.id !== id);
    this.saveOrders(filteredOrders);
  }
  async addDocuments(id: string, files: File[]): Promise<Order> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const orders = this.getStoredOrders();
    const index = orders.findIndex(order => order.id === id);
    
    if (index === -1) {
      throw new Error(`Order with id ${id} not found`);
    }

    // Creating mock documents
    const newDocuments = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      url: URL.createObjectURL(file), // Warning: This blob URL won't work after refresh in real mock usage but fine for session
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }));

    const currentDocuments = orders[index].documents || [];
    orders[index].documents = [...currentDocuments, ...newDocuments];
    
    this.saveOrders(orders);
    
    return orders[index];
  }
}
