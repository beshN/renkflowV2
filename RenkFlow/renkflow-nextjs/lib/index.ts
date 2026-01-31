/**
 * Production-Ready Architecture - Main Export File
 * 
 * This file exports all the core utilities and hooks for the application.
 */

// ============================================
// Storage Layer
// ============================================
export { storage, useSSRStorage } from './storage/ssr-safe-storage';

// ============================================
// API Layer
// ============================================
export {
  requestCache,
  cachedRequest,
  optimisticUpdate,
  useCachedQuery,
  useMutation,
  type UseCachedQueryOptions,
  type UseCachedQueryResult,
  type UseMutationOptions,
  type UseMutationResult,
  type OptimisticUpdateConfig,
} from './api/request-layer';

export {
  // Schemas
  OrderStatusSchema,
  DocumentSchema,
  OrderSchema,
  NewOrderFormSchema,
  UpdateOrderFormSchema,
  LoginFormSchema,
  RegisterFormSchema,
  ResetPasswordFormSchema,
  APISuccessSchema,
  APIErrorSchema,
  APIResponseSchema,
  // Types
  type OrderStatus,
  type Document,
  type Order,
  type NewOrderFormData,
  type UpdateOrderFormData,
  type LoginFormData,
  type RegisterFormData,
  type ResetPasswordFormData,
  // Utilities
  parseFormData,
  parseJSON,
  createValidationErrorResponse,
  withValidation,
  // Type Guards
  isOrder,
  isValidOrderStatus,
  isDocument,
} from './api/validation';

// ============================================
// Context Layer
// ============================================
export {
  AppProvider,
  useApp,
  useAuth,
  useToast,
  useUI,
} from './context/AppProvider';

// ============================================
// Real-Time Sync Layer
// ============================================
export {
  realtime,
  RealtimeClient,
  conflictResolver,
  ConflictResolver,
  useRealtime,
  useChannel,
  useOrderRealtime,
  usePresence,
  useConflictResolution,
  useOptimisticRealtime,
  useTypingIndicator,
  useLiveCursors,
  type RealtimeEvent,
  type PresenceUser,
  type PresenceState,
  type ConflictInfo,
  type ConflictResolution,
} from './realtime';

// ============================================
// Utilities
// ============================================
export {
  logger,
  createLogger,
  devLog,
  devAssert,
  deprecationWarning,
} from './utils/logger';

export {
  urlManager,
  useObjectURL,
  getOptimizedImageUrl,
  preloadImage,
  preloadImages,
  useLazyLoad,
  useDeferredLoad,
  createLazyComponent,
  useMemoryWarning,
  useCleanup,
  useThrottle,
  useDebounce,
  throttle,
  debounce,
} from './utils/performance';

// ============================================
// Re-exports from existing utils
// ============================================
export { cn, formatCurrency, formatDate, getOrderStatusInfo, generateId } from './utils';
