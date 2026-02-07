/**
 * Real-Time Sync System - Type Definitions
 */

// ============================================
// Event Types
// ============================================

export type RealtimeEventType =
  | 'order:created'
  | 'order:updated'
  | 'order:deleted'
  | 'order:status_changed'
  | 'document:added'
  | 'document:removed'
  | 'user:joined'
  | 'user:left'
  | 'user:typing'
  | 'user:viewing'
  | 'sync:conflict'
  | 'sync:resolved';

export interface RealtimeEvent<T = unknown> {
  id: string;
  type: RealtimeEventType;
  payload: T;
  userId: string;
  userName: string;
  tenantId: string;
  timestamp: number;
  version: number;
}

// ============================================
// Presence Types
// ============================================

export interface PresenceUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy';
  currentPage?: string;
  viewingOrderId?: string;
  lastSeen: number;
}

export interface PresenceState {
  users: Map<string, PresenceUser>;
  typingUsers: Set<string>;
  viewingOrders: Map<string, Set<string>>; // orderId -> Set<userId>
}

// ============================================
// Conflict Resolution Types
// ============================================

export type ConflictResolutionStrategy =
  | 'last-write-wins'
  | 'first-write-wins'
  | 'merge'
  | 'manual';

export interface ConflictInfo<T = unknown> {
  id: string;
  resourceType: 'order' | 'document';
  resourceId: string;
  localVersion: number;
  serverVersion: number;
  localData: T;
  serverData: T;
  localTimestamp: number;
  serverTimestamp: number;
  localUserId: string;
  serverUserId: string;
}

export interface ConflictResolution<T = unknown> {
  conflictId: string;
  strategy: ConflictResolutionStrategy;
  resolvedData: T;
  resolvedBy: string;
  resolvedAt: number;
}

// ============================================
// Sync Queue Types
// ============================================

export type SyncOperationType = 'create' | 'update' | 'delete';

export interface SyncOperation<T = unknown> {
  id: string;
  type: SyncOperationType;
  resourceType: 'order' | 'document';
  resourceId: string;
  data: T;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'conflict';
  error?: string;
}

// ============================================
// Channel Types
// ============================================

export interface ChannelConfig {
  name: string;
  type: 'public' | 'private' | 'presence';
  tenantId?: string;
}

export interface SubscriptionOptions {
  onEvent?: (event: RealtimeEvent) => void;
  onPresenceUpdate?: (state: PresenceState) => void;
  onError?: (error: Error) => void;
  onReconnect?: () => void;
}

// ============================================
// Connection Types
// ============================================

export type ConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface ConnectionInfo {
  state: ConnectionState;
  latency: number;
  lastConnected: number | null;
  reconnectAttempts: number;
  socketId: string | null;
}

// ============================================
// Message Types for WebSocket
// ============================================

export interface WSMessage {
  type: 'subscribe' | 'unsubscribe' | 'publish' | 'presence' | 'ping' | 'pong';
  channel?: string;
  event?: RealtimeEventType;
  data?: unknown;
  timestamp: number;
}

export interface WSResponse {
  success: boolean;
  type: string;
  data?: unknown;
  error?: string;
}
