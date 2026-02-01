// @/lib/integration/unified-flow.ts
// Tüm modülleri tek flow'da birleştiren orchestration katmanı

import { useOfflineOrders } from '@/lib/offline/hooks';
import { useOrderRealtime } from '@/lib/realtime/hooks';
import { useFacetedSearch, useDashboardStats } from '@/lib/search/hooks';
import { auditTrail, encryptField } from '@/lib/security';
import { Order, NewOrderFormData, createOrderId, CurrencySchema } from '@/lib/types';

// Mock/Draft AI Engine (as @/lib/ai doesn't exist yet)
const aiEngine = {
  analyzeOrder: async (order: Order) => ({ isSuspicious: false })
};

export interface UnifiedOrderFlow {
  // Offline + Real-time
  createOrderWithSync: (data: NewOrderFormData) => Promise<void>;
  // AI + Security
  analyzeAndLog: (order: Order) => Promise<void>;
  // Search + Analytics
  refreshSearchIndex: () => void;
}

export function useUnifiedOrderSystem(tenantId: string) {
  // Mock fetcher for offline hook
  const fetchOrders = async () => [];
  // Mock handler for realtime
  const handleRealtimeEvent = () => {};
  // Mock user for audit trail
  const user = { id: 'system', name: 'System', email: 'system@renkflow.com' };

  const { addOrder, isOnline } = useOfflineOrders(fetchOrders) as any;
  const { publish } = useOrderRealtime(tenantId, handleRealtimeEvent);
  const search = useFacetedSearch([] as Order[], { initialFilters: {} });
  const stats = useDashboardStats([] as Order[]);

  const createOrderWithSync = async (data: NewOrderFormData) => {
    // 1. Logic fix: addOrder in hooks.ts returns void but syncs via queue
    // We create a temporary Order object for analysis if needed, 
    // but the hook handles the actual persistence and ID generation.
    const tempOrder: Order = {
      ...data,
      id: createOrderId(`temp-${Date.now()}`),
      orderNumber: 'PENDING',
      date: new Date().toISOString(),
      status: 'pending',
      currency: (() => {
        const result = CurrencySchema.safeParse(data.currency);
        return result.success ? result.data : '₺';
      })(),
      documents: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 2. AI analiz (şüpheli mi?)
    const analysis = await aiEngine.analyzeOrder(tempOrder);
    if (analysis.isSuspicious) {
      (tempOrder as any).flags = ['suspicious'];
    }
    
    // 3. Security - encrypt sensitive data
    if (tempOrder.phone) {
      tempOrder.phone = await encryptField(tempOrder.phone, 'phone') as any;
    }
    
    // 4. Audit log
    await auditTrail.logCreate(tenantId, user, 'order', tempOrder.id, 'Created');
    
    // 5. Sync to offline DB & queue
    await addOrder(tempOrder);
    
    // 6. Online ise real-time sync
    if (isOnline) {
      publish('order:created', tempOrder as any, Date.now());
    }
    
    // 7. Search index güncelle
    // search.refresh() and stats.refresh() don't exist in current hooks, they are reactive to data props
    
    return tempOrder;
  };

  return { createOrderWithSync, search, stats };
}
