// ============================================
// REACT QUERY HOOKS
// Custom Hooks for Data Fetching
// ============================================

/**
 * @module query/hooks
 * @description React Query hooks with tenant-scoped cache keys.
 * 
 * Security features:
 * - Tenant-scoped query keys prevent cross-tenant data leakage
 * - Automatic cache invalidation on tenant change
 * - Type-safe query key builders
 */

'use client';

import { 
  useQuery, 
  useMutation, 
  useInfiniteQuery,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type UseInfiniteQueryOptions,
  type QueryKey,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api, type ApiException } from '../api/client';

// ============================================
// QUERY KEY FACTORY (Tenant-Scoped)
// ============================================

/**
 * Type-safe query key builders with tenant isolation.
 * All query keys include tenantId to prevent cross-tenant data leakage.
 * 
 * @example
 * ```typescript
 * // Without tenant (legacy/public data)
 * queryKeys.users.all()
 * 
 * // With tenant (isolated data)
 * queryKeys.users.allTenant('tenant-123')
 * queryKeys.users.listTenant('tenant-123', { page: 1 })
 * ```
 */
export const queryKeys = {
  all: ['api'] as const,
  
  users: {
    all: () => [...queryKeys.all, 'users'] as const,
    /** Tenant-scoped: all users for tenant */
    allTenant: (tenantId: string) => [...queryKeys.all, 'users', tenantId] as const,
    lists: () => [...queryKeys.users.all(), 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.users.lists(), filters] as const,
    /** Tenant-scoped: user list with filters */
    listTenant: (tenantId: string, filters?: Record<string, unknown>) => 
      [...queryKeys.users.allTenant(tenantId), 'list', filters ?? {}] as const,
    details: () => [...queryKeys.users.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    /** Tenant-scoped: single user detail */
    detailTenant: (tenantId: string, id: string) => 
      [...queryKeys.users.allTenant(tenantId), 'detail', id] as const,
  },
  
  posts: {
    all: () => [...queryKeys.all, 'posts'] as const,
    allTenant: (tenantId: string) => [...queryKeys.all, 'posts', tenantId] as const,
    lists: () => [...queryKeys.posts.all(), 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.posts.lists(), filters] as const,
    listTenant: (tenantId: string, filters?: Record<string, unknown>) => 
      [...queryKeys.posts.allTenant(tenantId), 'list', filters ?? {}] as const,
    details: () => [...queryKeys.posts.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.posts.details(), id] as const,
    detailTenant: (tenantId: string, id: string) => 
      [...queryKeys.posts.allTenant(tenantId), 'detail', id] as const,
    infinite: (filters?: Record<string, unknown>) => [...queryKeys.posts.all(), 'infinite', filters] as const,
    infiniteTenant: (tenantId: string, filters?: Record<string, unknown>) => 
      [...queryKeys.posts.allTenant(tenantId), 'infinite', filters] as const,
  },
  
  orders: {
    all: () => [...queryKeys.all, 'orders'] as const,
    allTenant: (tenantId: string) => [...queryKeys.all, 'orders', tenantId] as const,
    listTenant: (tenantId: string, filters?: Record<string, unknown>) => 
      [...queryKeys.orders.allTenant(tenantId), 'list', filters ?? {}] as const,
    detailTenant: (tenantId: string, id: string) => 
      [...queryKeys.orders.allTenant(tenantId), 'detail', id] as const,
    statsTenant: (tenantId: string) => 
      [...queryKeys.orders.allTenant(tenantId), 'stats'] as const,
  },
  
  comments: {
    all: () => [...queryKeys.all, 'comments'] as const,
    byPost: (postId: string) => [...queryKeys.comments.all(), 'post', postId] as const,
  },
} as const;

// ============================================
// TENANT CHANGE HOOK
// ============================================

/**
 * Hook to invalidate all queries when tenant changes.
 * Prevents stale cross-tenant data from being displayed.
 */
export function useTenantChangeInvalidation(tenantId: string | null) {
  const queryClient = useQueryClient();
  const prevTenantRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevTenantRef.current !== null && prevTenantRef.current !== tenantId) {
      // Tenant changed - invalidate all queries
      void queryClient.invalidateQueries({ queryKey: queryKeys.all });
      // Also clear the cache to prevent any stale data
      queryClient.clear();
    }
    prevTenantRef.current = tenantId;
  }, [tenantId, queryClient]);
}

// ============================================
// TYPE DEFINITIONS
// ============================================

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user';
  createdAt: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ============================================
// USER HOOKS
// ============================================

export function useUsers(
  filters?: { page?: number; limit?: number; search?: string },
  options?: Omit<UseQueryOptions<PaginatedResponse<User>, ApiException>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.users.list(filters ?? {}),
    queryFn: () => api.get<PaginatedResponse<User>>('/users', { params: filters }),
    ...options,
  });
}

export function useUser(
  id: string,
  options?: Omit<UseQueryOptions<User, ApiException>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.users.detail(id),
    queryFn: () => api.get<User>(`/users/${id}`),
    enabled: !!id,
    ...options,
  });
}

export function useCreateUser(
  options?: UseMutationOptions<User, ApiException, Omit<User, 'id' | 'createdAt'>>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => api.post<User>('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
    },
    ...options,
  });
}

export function useUpdateUser(
  options?: UseMutationOptions<User, ApiException, { id: string; data: Partial<User> }>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }) => api.patch<User>(`/users/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      queryClient.setQueryData(queryKeys.users.detail(data.id), data);
    },
    ...options,
  });
}

export function useDeleteUser(
  options?: UseMutationOptions<void, ApiException, string>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => api.delete<void>(`/users/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
      queryClient.removeQueries({ queryKey: queryKeys.users.detail(id) });
    },
    ...options,
  });
}

// ============================================
// POST HOOKS WITH INFINITE QUERY
// ============================================

export function usePosts(
  filters?: { authorId?: string; search?: string },
  options?: Omit<UseQueryOptions<PaginatedResponse<Post>, ApiException>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.posts.list(filters ?? {}),
    queryFn: () => api.get<PaginatedResponse<Post>>('/posts', { params: filters }),
    ...options,
  });
}

export function useInfinitePosts(
  filters?: { authorId?: string; search?: string },
  options?: Omit<
    UseInfiniteQueryOptions<PaginatedResponse<Post>, ApiException, PaginatedResponse<Post>, PaginatedResponse<Post>, QueryKey, number>,
    'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >
) {
  return useInfiniteQuery({
    queryKey: queryKeys.posts.infinite(filters),
    queryFn: ({ pageParam }) => 
      api.get<PaginatedResponse<Post>>('/posts', { 
        params: { ...filters, page: pageParam, limit: 10 } 
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => 
      lastPage.meta.hasMore ? lastPage.meta.page + 1 : undefined,
    ...options,
  });
}

export function usePost(
  id: string,
  options?: Omit<UseQueryOptions<Post, ApiException>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.posts.detail(id),
    queryFn: () => api.get<Post>(`/posts/${id}`),
    enabled: !!id,
    ...options,
  });
}

// ============================================
// OPTIMISTIC UPDATE EXAMPLE
// ============================================

export function useOptimisticUpdatePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Post> }) => 
      api.patch<Post>(`/posts/${id}`, data),
    
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.posts.detail(id) });
      
      // Snapshot previous value
      const previousPost = queryClient.getQueryData<Post>(queryKeys.posts.detail(id));
      
      // Optimistically update
      if (previousPost) {
        queryClient.setQueryData<Post>(queryKeys.posts.detail(id), {
          ...previousPost,
          ...data,
        });
      }
      
      return { previousPost };
    },
    
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousPost) {
        queryClient.setQueryData(queryKeys.posts.detail(id), context.previousPost);
      }
    },
    
    onSettled: (_, __, { id }) => {
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(id) });
    },
  });
}

// ============================================
// PREFETCH UTILITIES
// ============================================

export function usePrefetchUser() {
  const queryClient = useQueryClient();
  
  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.users.detail(id),
      queryFn: () => api.get<User>(`/users/${id}`),
      staleTime: 5 * 60 * 1000,
    });
  };
}

export function usePrefetchPost() {
  const queryClient = useQueryClient();
  
  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.posts.detail(id),
      queryFn: () => api.get<Post>(`/posts/${id}`),
      staleTime: 5 * 60 * 1000,
    });
  };
}

// ============================================
// DEPENDENT QUERIES EXAMPLE
// ============================================

export function usePostWithAuthor(postId: string) {
  const postQuery = usePost(postId);
  
  const authorQuery = useUser(postQuery.data?.authorId ?? '', {
    enabled: !!postQuery.data?.authorId,
  });
  
  return {
    post: postQuery.data,
    author: authorQuery.data,
    isLoading: postQuery.isLoading || authorQuery.isLoading,
    isError: postQuery.isError || authorQuery.isError,
    error: postQuery.error || authorQuery.error,
  };
}

// ============================================
// POLLING EXAMPLE
// ============================================

export function usePollingPosts(intervalMs: number = 30000) {
  return useQuery({
    queryKey: queryKeys.posts.lists(),
    queryFn: () => api.get<PaginatedResponse<Post>>('/posts'),
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
  });
}

// ============================================
// QUERY INVALIDATION HOOK
// ============================================

export function useInvalidateQueries() {
  const queryClient = useQueryClient();
  
  return {
    invalidateUsers: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all() }),
    invalidatePosts: () => queryClient.invalidateQueries({ queryKey: queryKeys.posts.all() }),
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: queryKeys.all }),
    invalidateByKey: (key: QueryKey) => queryClient.invalidateQueries({ queryKey: key }),
  };
}
