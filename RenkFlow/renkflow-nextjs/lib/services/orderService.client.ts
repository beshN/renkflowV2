/**
 * Client-Only Order Service Entry Point
 * 
 * This file can ONLY be imported from client-side code.
 * Next.js will throw an error if this is imported from server code.
 * 
 * Pattern: WebOrderService communicates with Server Actions / API routes
 */

import 'client-only';

import { Order, NewOrderFormData } from '@/lib/types';
import { IOrderService } from './types';

/**
 * Web Order Service
 * Communicates with the Next.js API routes (/api/v1/orders)
 * This is the ONLY service implementation that should be used in the browser.
 */
class WebOrderService implements IOrderService {
  private readonly baseUrl = '/api/v1/orders';

  async getOrders(): Promise<Order[]> {
    const response = await fetch(this.baseUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch orders');
    }
    const result = await response.json();
    return result.data;
  }

  async getOrderById(id: string): Promise<Order | null> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch order');
    }
    const result = await response.json();
    return result.data;
  }

  async createOrder(formData: NewOrderFormData, files?: File[]): Promise<Order> {
    const data = new FormData();
    
    // Core fields
    data.append('customerName', formData.customerName);
    if (formData.email) data.append('email', formData.email);
    if (formData.phone) data.append('phone', formData.phone);
    data.append('productName', formData.productName);
    data.append('quantity', formData.quantity.toString());
    data.append('totalAmount', formData.totalAmount.toString());
    data.append('currency', formData.currency);
    if (formData.deliveryDate) data.append('deliveryDate', formData.deliveryDate);
    if (formData.notes) data.append('notes', formData.notes);

    // Documents
    if (files) {
      files.forEach(file => data.append('files', file));
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      body: data,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create order');
    }

    const result = await response.json();
    return result.data;
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update order');
    }

    const result = await response.json();
    return result.data;
  }

  async updateOrderStatus(id: string, status: Order['status']): Promise<Order> {
    const response = await fetch(`${this.baseUrl}/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error('Failed to update order status');
    }

    const result = await response.json();
    return result.data;
  }

  async deleteOrder(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete order');
    }
  }

  async addDocuments(id: string, files: File[]): Promise<Order> {
    const data = new FormData();
    files.forEach(file => data.append('files', file));

    const response = await fetch(`${this.baseUrl}/${id}/documents`, {
      method: 'POST',
      body: data,
    });

    if (!response.ok) {
      throw new Error('Failed to upload documents');
    }

    const result = await response.json();
    return result.data;
  }
}

// Singleton instance
let clientOrderService: WebOrderService | null = null;

/**
 * Get the client-side order service instance.
 * This is a singleton that is created once per browser session.
 */
export function getOrderService(): WebOrderService {
  if (!clientOrderService) {
    clientOrderService = new WebOrderService();
  }
  return clientOrderService;
}

/**
 * Direct export for convenience.
 * Note: This will fail if imported from server code due to 'client-only'.
 */
export const orderService = getOrderService();
