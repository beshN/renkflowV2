import 'server-only';

import { IOrderService } from './types';
import { MockOrderService } from './mock/order.mock';
import { PostgresOrderService } from './postgres/order.postgres';

function createOrderService(): IOrderService {
  if (process.env.NODE_ENV === 'test') {
    return new MockOrderService();
  }

  return new PostgresOrderService();
}

export const orderService: IOrderService = createOrderService();
