'use client';

import { offlineDB } from './indexeddb';
import { SyncOperation, SyncOperationType } from '../realtime/types';

/**
 * Sync Queue for Background Synchronization
 * Manages pending operations and handles sync with server
 */

type SyncCallback = (operation: SyncOperation) => Promise<void>;
type ConflictCallback = (operation: SyncOperation, serverData: unknown) => Promise<unknown>;

interface SyncQueueConfig {
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
  syncInterval?: number;
}

const DEFAULT_CONFIG: Required<SyncQueueConfig> = {
  maxRetries: 3,
  retryDelay: 5000,
  batchSize: 10,
  syncInterval: 30000, // 30 seconds
};

class SyncQueue {
  private static instance: SyncQueue;
  private config: Required<SyncQueueConfig>;
  private isProcessing = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private isOnline = true;
  
  // Callbacks for handling sync operations
  private syncHandlers: Map<string, SyncCallback> = new Map();
  private conflictHandlers: Map<string, ConflictCallback> = new Map();
  
  // Event listeners
  private listeners: Set<(event: SyncQueueEvent) => void> = new Set();

  private constructor(config: SyncQueueConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupOnlineListener();
  }

  static getInstance(config?: SyncQueueConfig): SyncQueue {
    if (!SyncQueue.instance) {
      SyncQueue.instance = new SyncQueue(config);
    }
    return SyncQueue.instance;
  }

  // ============================================
  // Setup
  // ============================================

  private setupOnlineListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.emit({ type: 'online' });
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.emit({ type: 'offline' });
    });

    this.isOnline = navigator.onLine;
  }

  start(): void {
    if (this.syncTimer) return;

    this.syncTimer = setInterval(() => {
      if (this.isOnline) {
        this.processQueue();
      }
    }, this.config.syncInterval);

    // Initial sync
    if (this.isOnline) {
      this.processQueue();
    }
  }

  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // ============================================
  // Queue Operations
  // ============================================

  async enqueue<T>(
    type: SyncOperationType,
    resourceType: 'order' | 'document',
    resourceId: string,
    data: T
  ): Promise<string> {
    const operation: SyncOperation<T> = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      resourceType,
      resourceId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      status: 'pending',
    };

    await offlineDB.put('syncQueue', operation as any);
    this.emit({ type: 'enqueued', operation });

    // Try to process immediately if online
    if (this.isOnline && !this.isProcessing) {
      this.processQueue();
    }

    return operation.id;
  }

  async dequeue(operationId: string): Promise<void> {
    await offlineDB.delete('syncQueue', operationId);
  }

  async getQueuedOperations(): Promise<SyncOperation[]> {
    const all = await offlineDB.getAll<SyncOperation>('syncQueue');
    return all.filter((op) => op.status === 'pending' || op.status === 'in_progress');
  }

  async getFailedOperations(): Promise<SyncOperation[]> {
    const all = await offlineDB.getAll<SyncOperation>('syncQueue');
    return all.filter((op) => op.status === 'failed');
  }

  async getConflictedOperations(): Promise<SyncOperation[]> {
    const all = await offlineDB.getAll<SyncOperation>('syncQueue');
    return all.filter((op) => op.status === 'conflict');
  }

  async clearQueue(): Promise<void> {
    await offlineDB.clear('syncQueue');
  }

  async retryFailed(): Promise<void> {
    const failed = await this.getFailedOperations();
    
    for (const operation of failed) {
      await offlineDB.put('syncQueue', {
        ...operation,
        status: 'pending',
        retryCount: 0,
        error: undefined,
      } as any);
    }

    if (this.isOnline) {
      this.processQueue();
    }
  }

  // ============================================
  // Queue Processing
  // ============================================

  async processQueue(): Promise<void> {
    if (this.isProcessing || !this.isOnline) return;

    this.isProcessing = true;
    this.emit({ type: 'sync_started' });

    try {
      const operations = await this.getQueuedOperations();
      const batch = operations.slice(0, this.config.batchSize);

      for (const operation of batch) {
        await this.processOperation(operation);
      }

      const remaining = await this.getQueuedOperations();
      
      this.emit({
        type: 'sync_completed',
        processedCount: batch.length,
        remainingCount: remaining.length,
      });

      // Continue if there are more operations
      if (remaining.length > 0) {
        setTimeout(() => this.processQueue(), 1000);
      }
    } catch (error) {
      console.error('[SyncQueue] Error processing queue:', error);
      this.emit({ type: 'sync_error', error: error as Error });
    } finally {
      this.isProcessing = false;
    }
  }

  private async processOperation(operation: SyncOperation): Promise<void> {
    const handlerKey = `${operation.resourceType}:${operation.type}`;
    const handler = this.syncHandlers.get(handlerKey);

    if (!handler) {
      console.warn(`[SyncQueue] No handler for ${handlerKey}`);
      return;
    }

    // Mark as in progress
    await offlineDB.put('syncQueue', { ...operation, status: 'in_progress' } as any);

    try {
      await handler(operation);

      // Success - remove from queue
      await this.dequeue(operation.id);
      this.emit({ type: 'operation_completed', operation });

      // Mark resource as synced
      await offlineDB.markAsSynced(
        operation.resourceType === 'order' ? 'orders' : 'documents',
        operation.resourceId
      );
    } catch (error: any) {
      const isConflict = error.code === 'CONFLICT' || error.status === 409;

      if (isConflict) {
        await this.handleConflict(operation, error.serverData);
      } else if (operation.retryCount < operation.maxRetries) {
        // Retry later
        await offlineDB.put('syncQueue', {
          ...operation,
          status: 'pending',
          retryCount: operation.retryCount + 1,
          error: error.message,
        } as any);
        
        this.emit({ type: 'operation_retrying', operation, error });
      } else {
        // Max retries exceeded
        await offlineDB.put('syncQueue', {
          ...operation,
          status: 'failed',
          error: error.message,
        } as any);
        
        this.emit({ type: 'operation_failed', operation, error });
      }
    }
  }

  private async handleConflict(
    operation: SyncOperation,
    serverData: unknown
  ): Promise<void> {
    const conflictHandler = this.conflictHandlers.get(operation.resourceType);

    if (conflictHandler) {
      try {
        const resolvedData = await conflictHandler(operation, serverData);
        
        // Update operation with resolved data
        await offlineDB.put('syncQueue', {
          ...operation,
          data: resolvedData,
          status: 'pending',
          retryCount: 0,
        } as any);
        
        this.emit({ type: 'conflict_resolved', operation });
      } catch {
        // Mark as conflict for manual resolution
        await offlineDB.put('syncQueue', {
          ...operation,
          status: 'conflict',
        } as any);
        
        await offlineDB.markAsConflict(
          operation.resourceType === 'order' ? 'orders' : 'documents',
          operation.resourceId
        );
        
        this.emit({ type: 'conflict_pending', operation, serverData });
      }
    } else {
      // No conflict handler, mark for manual resolution
      await offlineDB.put('syncQueue', {
        ...operation,
        status: 'conflict',
      } as any);
      
      this.emit({ type: 'conflict_pending', operation, serverData });
    }
  }

  // ============================================
  // Handler Registration
  // ============================================

  registerSyncHandler(
    resourceType: 'order' | 'document',
    operationType: SyncOperationType,
    handler: SyncCallback
  ): () => void {
    const key = `${resourceType}:${operationType}`;
    this.syncHandlers.set(key, handler);
    return () => this.syncHandlers.delete(key);
  }

  registerConflictHandler(
    resourceType: 'order' | 'document',
    handler: ConflictCallback
  ): () => void {
    this.conflictHandlers.set(resourceType, handler);
    return () => this.conflictHandlers.delete(resourceType);
  }

  // ============================================
  // Event System
  // ============================================

  private emit(event: SyncQueueEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[SyncQueue] Listener error:', error);
      }
    });
  }

  onEvent(listener: (event: SyncQueueEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ============================================
  // Status
  // ============================================

  get online(): boolean {
    return this.isOnline;
  }

  get processing(): boolean {
    return this.isProcessing;
  }

  async getStatus(): Promise<SyncQueueStatus> {
    const [queued, failed, conflicted] = await Promise.all([
      this.getQueuedOperations(),
      this.getFailedOperations(),
      this.getConflictedOperations(),
    ]);

    return {
      isOnline: this.isOnline,
      isProcessing: this.isProcessing,
      pendingCount: queued.length,
      failedCount: failed.length,
      conflictCount: conflicted.length,
    };
  }
}

// ============================================
// Types
// ============================================

interface SyncQueueStatus {
  isOnline: boolean;
  isProcessing: boolean;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
}

type SyncQueueEvent =
  | { type: 'online' }
  | { type: 'offline' }
  | { type: 'sync_started' }
  | { type: 'sync_completed'; processedCount: number; remainingCount: number }
  | { type: 'sync_error'; error: Error }
  | { type: 'enqueued'; operation: SyncOperation }
  | { type: 'operation_completed'; operation: SyncOperation }
  | { type: 'operation_retrying'; operation: SyncOperation; error: Error }
  | { type: 'operation_failed'; operation: SyncOperation; error: Error }
  | { type: 'conflict_resolved'; operation: SyncOperation }
  | { type: 'conflict_pending'; operation: SyncOperation; serverData: unknown };

export const syncQueue = SyncQueue.getInstance();
export { SyncQueue };
export type { SyncQueueStatus, SyncQueueEvent };
