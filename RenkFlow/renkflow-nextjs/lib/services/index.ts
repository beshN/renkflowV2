import { IOrderService } from './types';
import { MockOrderService } from './mock/order.mock';
import { NeonOrderService } from './neon/order.neon';
import { WebOrderService } from './web/order.web';

/**
 * Service Factory
 * 
 * Automatically selects the correct service based on environment:
 * - Browser: Always uses WebOrderService (to communicate with Next.js API)
 * - Server + DATABASE_URL: uses NeonOrderService (direct DB access)
 * - Server (Dev/Offline): uses MockOrderService
 */

const isBrowser = typeof window !== 'undefined';
const isDatabaseConfigured = process.env.NEXT_PUBLIC_USE_DATABASE === 'true' || !!process.env.DATABASE_URL;

export const orderService: IOrderService = isBrowser
  ? new WebOrderService()
  : isDatabaseConfigured
    ? new NeonOrderService()
    : new MockOrderService();

// Log which service is being used
if (typeof window === 'undefined') {
  // console.log(`[RenkFlow] Using ${isDatabaseConfigured ? 'Neon' : 'Mock'} Order Service`);
}

