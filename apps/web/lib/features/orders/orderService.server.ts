import 'server-only';

import { IOrderService } from './types';
import { MockOrderService } from './mock/order.mock';
import { PostgresOrderService } from './postgres/order.postgres';

function createOrderService(): IOrderService {
  const IS_BUILD_TIME = process.env.NEXT_PHASE === 'phase-production-build';
  
  if (process.env.NODE_ENV === 'test' || IS_BUILD_TIME) {
    return new MockOrderService();
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
  }

  return new PostgresOrderService();
}

export const orderService: IOrderService = createOrderService();
