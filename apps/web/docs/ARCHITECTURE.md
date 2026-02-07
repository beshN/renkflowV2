# Production-Ready Architecture

Bu dokümantasyon, RenkFlow uygulaması için oluşturulan production-ready mimarinin detaylarını içerir.

## 📁 Dosya Yapısı

```
lib/
├── api/
│   ├── request-layer.ts    # Smart Request Layer (caching, deduplication, optimistic updates)
│   └── validation.ts       # Zod validation schemas
├── context/
│   └── AppProvider.tsx     # Atomic Context Architecture
├── storage/
│   └── ssr-safe-storage.ts # SSR-Safe Storage Layer
├── utils/
│   ├── logger.ts           # Production-safe logging
│   └── performance.ts      # Performance utilities
├── hooks/
│   └── useOrders.new.ts    # Production-ready orders hook
└── index.ts                # Main export file
```

---

## 1. SSR-Safe Storage Layer

### Problem
`localStorage` server-side'da mevcut değil, bu da SSR sırasında hatalara neden oluyordu.

### Çözüm
`lib/storage/ssr-safe-storage.ts` - Hem server hem client tarafında çalışan storage abstraction.

```typescript
import { storage, useSSRStorage } from '@/lib/storage/ssr-safe-storage';

// Direct usage
storage.setItem('key', { data: 'value' });
const data = storage.getItem('key', defaultValue);

// React hook (auto-syncs with localStorage)
const [value, setValue] = useSSRStorage('key', initialValue);
```

### Özellikler
- ✅ Server-side'da in-memory fallback
- ✅ Client-side'da localStorage sync
- ✅ Cross-tab synchronization
- ✅ Automatic JSON serialization
- ✅ Type-safe with generics

---

## 2. Atomic Context Architecture

### Problem
Birden fazla provider ve context, prop drilling ve gereksiz re-render'lara neden oluyordu.

### Çözüm
`lib/context/AppProvider.tsx` - Tek bir unified provider altında tüm state management.

```typescript
// In layout.tsx
import { AppProvider } from '@/lib/context/AppProvider';

export default function RootLayout({ children }) {
  return (
    <AppProvider>
      {children}
    </AppProvider>
  );
}

// In any component
import { useApp, useAuth, useToast, useUI } from '@/lib/context/AppProvider';

function MyComponent() {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { theme, setTheme, sidebarOpen } = useUI();
}
```

### Özellikler
- ✅ `useMemo` ile value stabilization
- ✅ `useCallback` ile function memoization
- ✅ `useReducer` ile predictable state updates
- ✅ Built-in toast system
- ✅ Theme management
- ✅ Sidebar state

---

## 3. Smart Request Layer

### Problem
Duplicate requests, stale data, ve poor UX (loading states).

### Çözüm
`lib/api/request-layer.ts` - SWR-like data fetching pattern.

```typescript
import { useCachedQuery, useMutation, optimisticUpdate } from '@/lib/api/request-layer';

// Cached query with automatic deduplication
const { data, isLoading, refetch } = useCachedQuery(
  'orders',
  () => fetchOrders(),
  { cacheTTL: 5 * 60 * 1000 } // 5 minutes
);

// Mutation with optimistic update
const mutation = useMutation(
  (data) => createOrder(data),
  {
    onMutate: async (newData) => {
      // Optimistic update logic
    },
    onError: (err, vars, context) => {
      // Rollback logic
    }
  }
);
```

### Özellikler
- ✅ Request deduplication
- ✅ Response caching (configurable TTL)
- ✅ Optimistic updates with rollback
- ✅ Automatic retry with exponential backoff
- ✅ Window focus refetching
- ✅ Cache invalidation patterns

---

## 4. Type-Safe API with Zod

### Problem
Runtime type errors ve validation inconsistencies.

### Çözüm
`lib/api/validation.ts` - Zod schemas for all data types.

```typescript
import { 
  OrderSchema, 
  NewOrderFormSchema, 
  parseFormData,
  parseJSON,
  isOrder 
} from '@/lib/api/validation';

// Validate FormData
const result = parseFormData(formData, NewOrderFormSchema);
if (result.success) {
  // result.data is fully typed
}

// Validate JSON
const result = parseJSON(jsonData, OrderSchema);

// Type guard
if (isOrder(data)) {
  // data is Order type
}
```

### Schemas
- `OrderSchema` - Full order validation
- `NewOrderFormSchema` - New order form
- `LoginFormSchema` - Login form
- `RegisterFormSchema` - Registration form
- `APIResponseSchema` - API response wrapper

---

## 5. Security Hardening

### Problem
Production'da sensitive bilgilerin expose edilmesi.

### Çözümler

#### ErrorBoundary (Already Updated)
```typescript
// Only shows error details in development
{process.env.NODE_ENV === 'development' && error && (
  <details>...</details>
)}
```

#### Production-Safe Logger
`lib/utils/logger.ts`

```typescript
import { logger, devLog } from '@/lib/utils/logger';

// Context-specific logger
const log = createLogger('OrderService');
log.debug('Processing order', { id });
log.error('Failed to save', error);

// Simple dev-only logging
devLog.log('This only shows in development');
devLog.table(data);
```

---

## 6. Performance Optimizations

### Problem
Memory leaks, unnecessary re-renders, slow loading.

### Çözüm
`lib/utils/performance.ts`

```typescript
import {
  urlManager,
  useObjectURL,
  useLazyLoad,
  useDeferredLoad,
  useDebounce,
  useThrottle,
  createLazyComponent
} from '@/lib/utils/performance';

// Managed object URLs (auto-cleanup)
const url = urlManager.create(blob, 'MyComponent');
// ... use url
urlManager.revoke(url);

// React hook for object URLs
const objectUrl = useObjectURL(blob); // Auto-cleanup on unmount

// Lazy loading with intersection observer
const [ref, isVisible] = useLazyLoad();
<div ref={ref}>
  {isVisible && <HeavyComponent />}
</div>

// Deferred loading (after main content)
const shouldLoad = useDeferredLoad(100);

// Debounced/throttled values
const debouncedSearch = useDebounce(searchTerm, 300);
const throttledScroll = useThrottle(scrollPosition, 100);

// Code splitting
const LazyChart = createLazyComponent(
  () => import('./Chart'),
  { preload: true }
);
```

---

## 🚀 Quick Start

### 1. Update Root Layout

```typescript
// app/layout.tsx
import { AppProvider } from '@/lib/context/AppProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
```

### 2. Use Hooks in Components

```typescript
'use client';

import { useAuth, useToast } from '@/lib/context/AppProvider';
import { useOrders } from '@/lib/hooks/useOrders.new';

export default function OrdersPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { orders, isLoading, deleteOrder } = useOrders();

  const handleDelete = async (id: string) => {
    try {
      await deleteOrder(id);
      showToast('Sipariş silindi', 'success');
    } catch {
      showToast('Silme başarısız', 'error');
    }
  };

  return (/* ... */);
}
```

### 3. Validate API Input

```typescript
// app/api/orders/route.ts
import { parseJSON, NewOrderFormSchema, createValidationErrorResponse } from '@/lib/api/validation';

export async function POST(request: Request) {
  const body = await request.json();
  const result = parseJSON(body, NewOrderFormSchema);
  
  if (!result.success) {
    return Response.json(createValidationErrorResponse(result.errors!), { status: 400 });
  }
  
  // result.data is fully typed
  const order = await createOrder(result.data);
  return Response.json({ success: true, data: order });
}
```

---

## 📊 Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| SSR Compatibility | ❌ localStorage errors | ✅ SSR-safe storage |
| Re-renders | ❌ Unnecessary updates | ✅ Memoized values |
| API Requests | ❌ Duplicate calls | ✅ Deduplication + caching |
| Type Safety | ❌ Runtime errors | ✅ Zod validation |
| Error Handling | ❌ Stack traces in prod | ✅ Dev-only details |
| Memory Management | ❌ URL leaks | ✅ Auto-cleanup |
| Loading UX | ❌ No optimistic updates | ✅ Instant feedback |

---

## 🔧 Configuration

### Cache TTL
```typescript
// Default: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

// Per-query override
useCachedQuery(key, fetcher, { cacheTTL: 10 * 60 * 1000 });
```

### Retry Configuration
```typescript
cachedRequest(key, fetcher, {
  retry: 3,           // Max attempts
  retryDelay: 1000,   // Initial delay (doubles each retry)
});
```

---

## 📝 Migration Guide

1. **Replace console.log** → Use `devLog` or `logger`
2. **Replace localStorage** → Use `storage` or `useSSRStorage`
3. **Replace multiple providers** → Use `AppProvider`
4. **Replace manual fetching** → Use `useCachedQuery`
5. **Add Zod validation** → Use schemas from `validation.ts`
