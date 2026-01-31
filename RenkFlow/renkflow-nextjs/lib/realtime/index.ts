/**
 * Real-Time Sync System - Main Export
 */

// Types
export type {
  RealtimeEventType,
  RealtimeEvent,
  PresenceUser,
  PresenceState,
  ConflictInfo,
  ConflictResolution,
  ConflictResolutionStrategy,
  SyncOperation,
  SyncOperationType,
  ConnectionState,
  ConnectionInfo,
  ChannelConfig,
  SubscriptionOptions,
} from './types';

// WebSocket Client
export { realtime, RealtimeClient } from './client';

// Conflict Resolver
export { conflictResolver, ConflictResolver } from './conflict-resolver';

// React Hooks
export {
  useRealtime,
  useChannel,
  useOrderRealtime,
  usePresence,
  useConflictResolution,
  useOptimisticRealtime,
  useTypingIndicator,
  useLiveCursors,
} from './hooks';
