import 'server-only';

import { IOrderService } from './types';
import { MockOrderService } from './mock/order.mock';
import { NeonOrderService } from './neon/order.neon';

function createOrderService(): IOrderService {
  const IS_BUILD_TIME = process.env.NEXT_PHASE === 'phase-production-build';
  
  if (process.env.NODE_ENV === 'test' || IS_BUILD_TIME) {
    return new MockOrderService();
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  return new NeonOrderService();
}

export const orderService: IOrderService = createOrderService();
