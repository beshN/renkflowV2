// @/lib/integration/unified-flow.ts
// Tüm modülleri tek flow'da birleştiren orchestration katmanı

import { useOfflineOrders } from '@/lib/offline/hooks';
import { useOrderRealtime } from '@/lib/realtime/hooks';
import { useFacetedSearch, useDashboardStats } from '@/lib/search/hooks';
import { auditTrail, encryptField } from '@/lib/security';
import { aiEngine } from '@/lib/ai';

export interface UnifiedOrderFlow {
  // Offline + Real-time
  createOrderWithSync: (data: NewOrderData) => Promise<Order>;
  // AI + Security
  analyzeAndLog: (order: Order) => Promise<void>;
  // Search + Analytics
  refreshSearchIndex: () => void;
}

export function useUnifiedOrderSystem(tenantId: string) {
  const { addOrder, updateOrder, isOnline } = useOfflineOrders(fetchOrders);
  const { publish } = useOrderRealtime(tenantId, handleRealtimeEvent);
  const search = useFacetedSearch([], { facets: [] });
  const stats = useDashboardStats([]);

  const createOrderWithSync = async (data: NewOrderData) => {
    // 1. Offline queue'ya ekle
    const order = await addOrder(data);
    
    // 2. AI analiz (şüpheli mi?)
    const analysis = await aiEngine.analyzeOrder(order);
    if (analysis.isSuspicious) {
      order.flags = ['suspicious'];
    }
    
    // 3. Security - encrypt sensitive data
    if (order.customerPhone) {
      order.customerPhone = await encryptField(order.customerPhone, 'phone');
    }
    
    // 4. Audit log
    await auditTrail.logCreate(tenantId, user, 'order', order.id, 'Created');
    
    // 5. Online ise real-time sync
    if (isOnline) {
      publish('order:created', order, Date.now());
    }
    
    // 6. Search index güncelle
    search.refresh();
    stats.refresh();
    
    return order;
  };

  return { createOrderWithSync, search, stats };
}
