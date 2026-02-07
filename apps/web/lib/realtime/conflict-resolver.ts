/**
 * Conflict Resolution System
 * Handles concurrent edit conflicts with multiple strategies
 */

import {
  ConflictInfo,
  ConflictResolution,
  ConflictResolutionStrategy,
} from './types';

type ConflictCallback<T> = (conflict: ConflictInfo<T>) => Promise<ConflictResolution<T>>;

interface VersionedData {
  version: number;
  updatedAt: number;
  updatedBy: string;
}

interface MergeableOrder {
  id: string;
  customer?: string;
  email?: string;
  phone?: string;
  product?: string;
  quantity?: number;
  amount?: number;
  status?: string;
  deliveryDate?: string;
  description?: string;
  documents?: unknown[];
}

class ConflictResolver {
  private static instance: ConflictResolver;
  private pendingConflicts: Map<string, ConflictInfo> = new Map();
  private resolvedConflicts: Map<string, ConflictResolution> = new Map();
  private manualResolveCallbacks: Map<string, ConflictCallback<unknown>> = new Map();
  private defaultStrategy: ConflictResolutionStrategy = 'last-write-wins';

  private constructor() {}

  static getInstance(): ConflictResolver {
    if (!ConflictResolver.instance) {
      ConflictResolver.instance = new ConflictResolver();
    }
    return ConflictResolver.instance;
  }

  setDefaultStrategy(strategy: ConflictResolutionStrategy): void {
    this.defaultStrategy = strategy;
  }

  /**
   * Check if there's a conflict between local and server versions
   */
  hasConflict<T extends VersionedData>(local: T, server: T): boolean {
    // If versions match, no conflict
    if (local.version === server.version) {
      return false;
    }

    // If local is newer, it's an update that should go through
    if (local.version > server.version) {
      return false;
    }

    // Server has newer version - potential conflict
    // Check if the same user made both changes
    if (local.updatedBy === server.updatedBy) {
      return false; // Same user, no conflict
    }

    // Different users, different versions - conflict!
    return true;
  }

  /**
   * Resolve a conflict using the specified strategy
   */
  async resolve<T>(
    conflict: ConflictInfo<T>,
    strategy?: ConflictResolutionStrategy
  ): Promise<ConflictResolution<T>> {
    const resolveStrategy = strategy || this.defaultStrategy;

    this.pendingConflicts.set(conflict.id, conflict as ConflictInfo);

    let resolution: ConflictResolution<T>;

    switch (resolveStrategy) {
      case 'last-write-wins':
        resolution = this.resolveLastWriteWins(conflict);
        break;
      case 'first-write-wins':
        resolution = this.resolveFirstWriteWins(conflict);
        break;
      case 'merge':
        resolution = this.resolveMerge(conflict);
        break;
      case 'manual':
        resolution = await this.resolveManual(conflict);
        break;
      default:
        resolution = this.resolveLastWriteWins(conflict);
    }

    this.pendingConflicts.delete(conflict.id);
    this.resolvedConflicts.set(conflict.id, resolution as ConflictResolution);

    return resolution;
  }

  /**
   * Last Write Wins - Most recent timestamp wins
   */
  private resolveLastWriteWins<T>(conflict: ConflictInfo<T>): ConflictResolution<T> {
    const isLocalNewer = conflict.localTimestamp > conflict.serverTimestamp;

    return {
      conflictId: conflict.id,
      strategy: 'last-write-wins',
      resolvedData: isLocalNewer ? conflict.localData : conflict.serverData,
      resolvedBy: isLocalNewer ? conflict.localUserId : conflict.serverUserId,
      resolvedAt: Date.now(),
    };
  }

  /**
   * First Write Wins - First timestamp wins (prevents overwrites)
   */
  private resolveFirstWriteWins<T>(conflict: ConflictInfo<T>): ConflictResolution<T> {
    const isLocalFirst = conflict.localTimestamp < conflict.serverTimestamp;

    return {
      conflictId: conflict.id,
      strategy: 'first-write-wins',
      resolvedData: isLocalFirst ? conflict.localData : conflict.serverData,
      resolvedBy: isLocalFirst ? conflict.localUserId : conflict.serverUserId,
      resolvedAt: Date.now(),
    };
  }

  /**
   * Merge - Intelligently merge non-conflicting fields
   */
  private resolveMerge<T>(conflict: ConflictInfo<T>): ConflictResolution<T> {
    const local = conflict.localData as MergeableOrder;
    const server = conflict.serverData as MergeableOrder;

    // Deep merge with field-level conflict resolution
    const merged = this.mergeObjects(local, server, conflict.localTimestamp, conflict.serverTimestamp);

    return {
      conflictId: conflict.id,
      strategy: 'merge',
      resolvedData: merged as T,
      resolvedBy: 'system',
      resolvedAt: Date.now(),
    };
  }

  /**
   * Merge two objects, preferring newer values for conflicting fields
   */
  private mergeObjects(
    local: MergeableOrder,
    server: MergeableOrder,
    localTimestamp: number,
    serverTimestamp: number
  ): MergeableOrder {
    const merged: MergeableOrder = { id: local.id || server.id };

    // Get all unique keys
    const allKeys = new Set([
      ...Object.keys(local),
      ...Object.keys(server),
    ]) as Set<keyof MergeableOrder>;

    for (const key of allKeys) {
      if (key === 'id') continue;

      const localValue = local[key];
      const serverValue = server[key];

      // If both have the same value, use it
      if (JSON.stringify(localValue) === JSON.stringify(serverValue)) {
        (merged as any)[key] = localValue;
        continue;
      }

      // If only one has the value, use that
      if (localValue === undefined) {
        (merged as any)[key] = serverValue;
        continue;
      }
      if (serverValue === undefined) {
        (merged as any)[key] = localValue;
        continue;
      }

      // Both have different values - use the newer one
      if (localTimestamp > serverTimestamp) {
        (merged as any)[key] = localValue;
      } else {
        (merged as any)[key] = serverValue;
      }
    }

    // Special handling for arrays (documents)
    if (local.documents || server.documents) {
      merged.documents = this.mergeArrays(
        (local.documents || []) as { id?: string }[],
        (server.documents || []) as { id?: string }[]
      );
    }

    return merged;
  }

  /**
   * Merge arrays by combining unique items
   */
  private mergeArrays<T extends { id?: string }>(local: T[], server: T[]): T[] {
    const merged = new Map<string, T>();

    // Add all server items first
    server.forEach((item) => {
      const key = item.id || JSON.stringify(item);
      merged.set(key, item);
    });

    // Add/override with local items
    local.forEach((item) => {
      const key = item.id || JSON.stringify(item);
      merged.set(key, item);
    });

    return Array.from(merged.values());
  }

  /**
   * Manual Resolution - Requires user intervention
   */
  private async resolveManual<T>(conflict: ConflictInfo<T>): Promise<ConflictResolution<T>> {
    const callback = this.manualResolveCallbacks.get(conflict.resourceType);

    if (callback) {
      return callback(conflict as ConflictInfo<unknown>) as Promise<ConflictResolution<T>>;
    }

    // Default to last-write-wins if no manual handler
    console.warn('[ConflictResolver] No manual resolver, falling back to last-write-wins');
    return this.resolveLastWriteWins(conflict);
  }

  /**
   * Register a manual resolution handler
   */
  onManualResolve<T>(
    resourceType: 'order' | 'document',
    callback: ConflictCallback<T>
  ): () => void {
    this.manualResolveCallbacks.set(resourceType, callback as ConflictCallback<unknown>);
    return () => this.manualResolveCallbacks.delete(resourceType);
  }

  /**
   * Get pending conflicts
   */
  getPendingConflicts(): ConflictInfo[] {
    return Array.from(this.pendingConflicts.values());
  }

  /**
   * Get resolved conflicts history
   */
  getResolvedConflicts(): ConflictResolution[] {
    return Array.from(this.resolvedConflicts.values());
  }

  /**
   * Clear resolved conflicts history
   */
  clearHistory(): void {
    this.resolvedConflicts.clear();
  }

  /**
   * Create a conflict info object
   */
  createConflict<T>(
    resourceType: 'order' | 'document',
    resourceId: string,
    localData: T,
    serverData: T,
    localVersion: number,
    serverVersion: number,
    localUserId: string,
    serverUserId: string
  ): ConflictInfo<T> {
    return {
      id: `conflict-${resourceId}-${Date.now()}`,
      resourceType,
      resourceId,
      localVersion,
      serverVersion,
      localData,
      serverData,
      localTimestamp: Date.now(),
      serverTimestamp: Date.now(),
      localUserId,
      serverUserId,
    };
  }
}

export const conflictResolver = ConflictResolver.getInstance();
export { ConflictResolver };
