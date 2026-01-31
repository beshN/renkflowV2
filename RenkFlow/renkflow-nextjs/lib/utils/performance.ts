'use client';

/**
 * Performance Optimization Utilities
 * - URL.createObjectURL cleanup
 * - Image optimization helpers
 * - Lazy loading utilities
 * - Memory management
 */

import React from 'react';

// ============================================
// URL Object Management
// ============================================

class URLObjectManager {
  private static instance: URLObjectManager;
  private urls: Set<string> = new Set();
  private urlMetadata: Map<string, { createdAt: number; source: string }> = new Map();

  private constructor() {
    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.revokeAll();
      });
    }
  }

  static getInstance(): URLObjectManager {
    if (!URLObjectManager.instance) {
      URLObjectManager.instance = new URLObjectManager();
    }
    return URLObjectManager.instance;
  }

  create(blob: Blob | MediaSource, source: string = 'unknown'): string {
    const url = URL.createObjectURL(blob);
    this.urls.add(url);
    this.urlMetadata.set(url, {
      createdAt: Date.now(),
      source,
    });

    if (process.env.NODE_ENV === 'development') {
      console.debug(`[URLObjectManager] Created URL: ${url} (source: ${source})`);
    }

    return url;
  }

  revoke(url: string): void {
    if (this.urls.has(url)) {
      URL.revokeObjectURL(url);
      this.urls.delete(url);
      this.urlMetadata.delete(url);

      if (process.env.NODE_ENV === 'development') {
        console.debug(`[URLObjectManager] Revoked URL: ${url}`);
      }
    }
  }

  revokeAll(): void {
    const count = this.urls.size;
    this.urls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    this.urls.clear();
    this.urlMetadata.clear();

    if (process.env.NODE_ENV === 'development' && count > 0) {
      console.debug(`[URLObjectManager] Revoked ${count} URLs`);
    }
  }

  getActiveCount(): number {
    return this.urls.size;
  }

  getMetadata(url: string) {
    return this.urlMetadata.get(url);
  }

  // Cleanup URLs older than specified age (in milliseconds)
  cleanupStale(maxAge: number = 5 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    this.urlMetadata.forEach((metadata, url) => {
      if (now - metadata.createdAt > maxAge) {
        this.revoke(url);
        cleaned++;
      }
    });

    return cleaned;
  }
}

export const urlManager = URLObjectManager.getInstance();

/**
 * React hook for managed object URLs with automatic cleanup
 */
export function useObjectURL(blob: Blob | null): string | null {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }

    const objectUrl = urlManager.create(blob, 'useObjectURL hook');
    setUrl(objectUrl);

    return () => {
      urlManager.revoke(objectUrl);
    };
  }, [blob]);

  return url;
}

// ============================================
// Image Optimization
// ============================================

interface OptimizedImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

/**
 * Generate optimized image URL for Next.js Image component
 */
export function getOptimizedImageUrl(
  src: string,
  options: OptimizedImageOptions = {}
): string {
  const { width, height, quality = 75 } = options;
  
  // If it's already a Next.js optimized URL or external, return as-is
  if (src.startsWith('/_next/image') || src.startsWith('data:')) {
    return src;
  }

  // Build query params for Next.js image optimization
  const params = new URLSearchParams();
  params.set('url', src);
  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  params.set('q', quality.toString());

  return `/_next/image?${params.toString()}`;
}

/**
 * Preload critical images
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Preload multiple images in parallel
 */
export function preloadImages(srcs: string[]): Promise<void[]> {
  return Promise.all(srcs.map(preloadImage));
}

// ============================================
// Lazy Loading Utilities
// ============================================

/**
 * React hook for intersection observer based lazy loading
 */
export function useLazyLoad(
  threshold: number = 0.1,
  rootMargin: string = '100px'
): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, isVisible];
}

/**
 * React hook for deferred loading (load after main content)
 */
export function useDeferredLoad(delay: number = 0): boolean {
  const [shouldLoad, setShouldLoad] = React.useState(false);

  React.useEffect(() => {
    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => {
        if (delay > 0) {
          setTimeout(() => setShouldLoad(true), delay);
        } else {
          setShouldLoad(true);
        }
      });
      return () => window.cancelIdleCallback(id);
    } else {
      const timeout = setTimeout(() => setShouldLoad(true), delay + 100);
      return () => clearTimeout(timeout);
    }
  }, [delay]);

  return shouldLoad;
}

// ============================================
// Component Code Splitting Helper
// ============================================

interface LazyComponentOptions {
  fallback?: React.ReactNode;
  preload?: boolean;
}

/**
 * Create a lazy-loaded component with optional preloading
 */
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyComponentOptions = {}
): React.LazyExoticComponent<T> & { preload: () => Promise<{ default: T }> } {
  const LazyComponent = React.lazy(importFn) as React.LazyExoticComponent<T> & {
    preload: () => Promise<{ default: T }>;
  };

  LazyComponent.preload = importFn;

  if (options.preload && typeof window !== 'undefined') {
    // Preload after initial render
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => importFn());
    } else {
      setTimeout(() => importFn(), 100);
    }
  }

  return LazyComponent;
}

// ============================================
// Memory Management
// ============================================

/**
 * React hook to detect and warn about memory leaks in development
 */
export function useMemoryWarning(componentName: string, threshold: number = 50): void {
  const mountCount = React.useRef(0);

  React.useEffect(() => {
    mountCount.current++;

    if (process.env.NODE_ENV === 'development' && mountCount.current > threshold) {
      console.warn(
        `[Memory Warning] Component "${componentName}" has been mounted ${mountCount.current} times. ` +
        `This might indicate a memory leak or unnecessary re-renders.`
      );
    }
  }, [componentName, threshold]);
}

/**
 * Cleanup function that runs on component unmount
 */
export function useCleanup(cleanupFn: () => void): void {
  const cleanupRef = React.useRef(cleanupFn);
  cleanupRef.current = cleanupFn;

  React.useEffect(() => {
    return () => {
      cleanupRef.current();
    };
  }, []);
}

// ============================================
// Throttle and Debounce
// ============================================

/**
 * React hook for throttled values
 */
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = React.useState(value);
  const lastRan = React.useRef(Date.now());

  React.useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => clearTimeout(handler);
  }, [value, limit]);

  return throttledValue;
}

/**
 * React hook for debounced values
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
