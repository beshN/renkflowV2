import 'server-only';

import { IOrderService } from './types';
import { MockOrderService } from './mock/order.mock';
import { NeonOrderService } from './neon/order.neon';

function createOrderService(): IOrderService {
  if (process.env.NODE_ENV === 'test') {
    return new MockOrderService();
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  return new NeonOrderService();
}

export const orderService: IOrderService = createOrderService();
