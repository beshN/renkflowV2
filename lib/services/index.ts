import { IOrderService } from './types';
import { MockOrderService } from './mock/order.mock';
import { NeonOrderService } from './neon/order.neon';

/**
 * Service Factory
 * 
 * Automatically selects the correct service based on environment:
 * - If DATABASE_URL is set: uses NeonOrderService
 * - Otherwise: uses MockOrderService for development
 */

const isDatabaseConfigured = !!process.env.DATABASE_URL;

export const orderService: IOrderService = isDatabaseConfigured
  ? new NeonOrderService()
  : new MockOrderService();

// Log which service is being used
if (typeof window === 'undefined') {
  console.log(`[RenkFlow] Using ${isDatabaseConfigured ? 'Neon' : 'Mock'} Order Service`);
}

