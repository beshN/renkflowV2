import { syncQueue } from './sync-queue';
import { orderService } from '../services/orderService.client';
import { SyncOperation } from '../realtime/types';
import { devLog } from '../utils/logger';

/**
 * Initialize Background Sync Handlers
 * Maps offline operations to actual service calls
 */
export function initializeSyncHandlers() {
  if (typeof window === 'undefined') return;

  devLog.info('[SyncHandlers] Initializing background sync handlers');

  // Order HANDLERS
  
  // Create Order
  syncQueue.registerSyncHandler('order', 'create', async (operation: SyncOperation) => {
    devLog.info(`[SyncQueue] Handling create:order for ${operation.resourceId}`);
    const orderData = operation.data as any;
    
    // Convert to NewOrderFormData if needed
    // In our case, the operation.data should already be mostly compatible 
    // but creation might involve files which aren't in the JSON data.
    // However, for background sync, we usually sync JSON first.
    
    // Note: If files are present, they should be handles by a separate file sync queue
    // but for now we assume JSON sync.
    await orderService.createOrder('', orderData);
  });

  // Update Order
  syncQueue.registerSyncHandler('order', 'update', async (operation: SyncOperation) => {
    devLog.info(`[SyncQueue] Handling update:order for ${operation.resourceId}`);
    await orderService.updateOrder('', operation.resourceId, operation.data as any);
  });

  // Delete Order
  syncQueue.registerSyncHandler('order', 'delete', async (operation: SyncOperation) => {
    devLog.info(`[SyncQueue] Handling delete:order for ${operation.resourceId}`);
    await orderService.deleteOrder('', operation.resourceId);
  });

  // Start the queue
  syncQueue.start();
}
