import 'client-only';

import { IOrderService } from './types';
import { WebOrderService } from './web/order.web';

export const orderService: IOrderService = new WebOrderService();
