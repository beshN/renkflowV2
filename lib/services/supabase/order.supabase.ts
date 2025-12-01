import { Order, NewOrderFormData } from '@/lib/types';
import { IOrderService } from '../types';

/**
 * Supabase Order Service (STUB)
 * 
 * This is a placeholder for future Supabase integration.
 * To activate:
 * 1. Install @supabase/supabase-js
 * 2. Configure environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
 * 3. Implement methods using Supabase client
 * 4. Update lib/services/index.ts to use SupabaseOrderService
 */
export class SupabaseOrderService implements IOrderService {
  // private supabase: SupabaseClient;

  constructor() {
    // this.supabase = createClient(
    //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    // );
    throw new Error('SupabaseOrderService is not yet implemented. Use MockOrderService instead.');
  }

  async getOrders(): Promise<Order[]> {
    // const { data, error } = await this.supabase
    //   .from('orders')
    //   .select(`
    //     *,
    //     customer:customers(*),
    //     order_items(*),
    //     documents(*)
    //   `)
    //   .order('created_at', { ascending: false });
    
    // if (error) throw error;
    // return this.mapToOrders(data);
    throw new Error('Not implemented');
  }

  async getOrderById(id: string): Promise<Order | null> {
    throw new Error('Not implemented');
  }

  async createOrder(formData: NewOrderFormData): Promise<Order> {
    throw new Error('Not implemented');
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
    throw new Error('Not implemented');
  }

  async updateOrderStatus(id: string, status: Order['status']): Promise<Order> {
    throw new Error('Not implemented');
  }

  async deleteOrder(id: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
