import { useOrdersContext } from '@/lib/context/OrdersContext';

export function useOrders() {
  return useOrdersContext();
}
