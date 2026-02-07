// ============================================
// SERVER COMPONENT DATA FETCHING
// Next.js App Router Pattern
// ============================================

import { cache } from 'react';
import 'server-only';

// Next.js fetch config type
interface NextFetchConfig {
  revalidate?: number | false;
  tags?: string[];
}

// ============================================
// TYPES
// ============================================

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
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
// CACHED FETCH FUNCTIONS
// React cache() for request deduplication
// ============================================

const API_URL = process.env.API_URL ?? 'http://localhost:3000/api';

async function fetchApi<T>(
  endpoint: string, 
  options?: RequestInit & { next?: NextFetchConfig }
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ============================================
// USER FETCHERS
// ============================================

export const getUsers = cache(async (
  params?: { page?: number; limit?: number }
): Promise<PaginatedResponse<User>> => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  return fetchApi<PaginatedResponse<User>>(
    `/users?${searchParams.toString()}`,
    {
      next: { 
        revalidate: 60, // ISR: revalidate every 60 seconds
        tags: ['users'],
      },
    }
  );
});

export const getUser = cache(async (id: string): Promise<User> => {
  return fetchApi<User>(`/users/${id}`, {
    next: { 
      revalidate: 60,
      tags: ['users', `user-${id}`],
    },
  });
});

// ============================================
// POST FETCHERS
// ============================================

export const getPosts = cache(async (
  params?: { page?: number; limit?: number; authorId?: string }
): Promise<PaginatedResponse<Post>> => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.authorId) searchParams.set('authorId', params.authorId);

  return fetchApi<PaginatedResponse<Post>>(
    `/posts?${searchParams.toString()}`,
    {
      next: { 
        revalidate: 30,
        tags: ['posts'],
      },
    }
  );
});

export const getPost = cache(async (id: string): Promise<Post> => {
  return fetchApi<Post>(`/posts/${id}`, {
    next: { 
      revalidate: 30,
      tags: ['posts', `post-${id}`],
    },
  });
});

// ============================================
// NO-CACHE FETCHERS (Always Fresh)
// ============================================

export async function getPostsDynamic(): Promise<PaginatedResponse<Post>> {
  return fetchApi<PaginatedResponse<Post>>('/posts', {
    cache: 'no-store', // Always fetch fresh data
  });
}

// ============================================
// PARALLEL DATA FETCHING
// ============================================

export async function getPostWithAuthor(postId: string) {
  const post = await getPost(postId);
  const author = await getUser(post.authorId);
  
  return { post, author };
}

export async function getPostWithAuthorParallel(postId: string) {
  // First get post to know authorId
  const post = await getPost(postId);
  
  // Then fetch author
  const author = await getUser(post.authorId);
  
  return { post, author };
}

export async function getDashboardData(userId: string) {
  // Parallel fetching for independent data
  const [user, posts] = await Promise.all([
    getUser(userId),
    getPosts({ authorId: userId, limit: 5 }),
  ]);
  
  return { user, posts };
}

// ============================================
// REVALIDATION ACTIONS
// ============================================

export async function revalidateUsers() {
  const { revalidateTag } = await import('next/cache');
  revalidateTag('users');
}

export async function revalidateUser(id: string) {
  const { revalidateTag } = await import('next/cache');
  revalidateTag(`user-${id}`);
}

export async function revalidatePosts() {
  const { revalidateTag } = await import('next/cache');
  revalidateTag('posts');
}

export async function revalidatePost(id: string) {
  const { revalidateTag } = await import('next/cache');
  revalidateTag(`post-${id}`);
}

// ============================================
// STREAMING DATA PATTERN
// ============================================

export async function* streamPosts(batchSize: number = 10) {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await getPosts({ page, limit: batchSize });
    yield response.data;
    
    hasMore = response.meta.hasMore;
    page++;
  }
}
