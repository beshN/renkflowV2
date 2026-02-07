// ============================================
// BARREL EXPORTS FOR LIB MODULES
// ============================================

/**
 * @module lib
 * @description Main library exports for all architectural patterns.
 * Import from '@/lib' for convenient access to all modules.
 * 
 * @example
 * ```typescript
 * import { useAppStore, api, useAuth, ValidationError } from '@/lib';
 * ```
 */

// Core Interfaces (DI Pattern)
export * from './core/interfaces';

// Error Handling System
export * from './errors';

// Cache System (Enterprise + Request Layer)
export * from './cache';

// Testing Utilities
export * from './testing';

// Store (Zustand + Context)
export * from './store';
export * from './store/context';

// API Client
export * from './api/client';
export * from './api/hooks';

// Forms
export * from './forms/schemas';
export * from './forms/multi-step-form';

// Query (React Query)
export * from './query/provider';
export * from './query/hooks';

// Auth
export * from './auth/jwt';
export * from './auth/hooks';

// Virtualization
export * from './virtualization/virtual-list';

// Real-time
export * from './realtime/websocket';
export * from './realtime/sse';
export * from './realtime/hooks';

// Utilities
export * from './utils';
export * from './utils/hooks';

// Environment
export * from './env';
