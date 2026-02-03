'use client';

import { useEffect, useCallback } from 'react';

/**
 * Performance monitoring utilities for tracking Core Web Vitals
 * and custom performance metrics
 */

interface PerformanceMetrics {
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
  INP?: number; // Interaction to Next Paint
}

type MetricHandler = (metric: { name: string; value: number; id: string }) => void;

/**
 * Hook to monitor Core Web Vitals
 */
export function usePerformanceMonitoring(onMetric?: MetricHandler) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observerCallback: PerformanceObserverCallback = (list) => {
      for (const entry of list.getEntries()) {
        // Send to analytics or console in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Performance] ${entry.name}:`, entry);
        }

        // Call custom handler
        onMetric?.({
          name: entry.entryType,
          value: entry.startTime,
          id: entry.name,
        });
      }
    };

    // Observe LCP
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver(observerCallback);
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Observe FID (First Input Delay)
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const fidEntry = entry as PerformanceEventTiming;
            if (process.env.NODE_ENV === 'development') {
              console.log('[Performance] FID:', fidEntry.processingStart - fidEntry.startTime);
            }
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Observe CLS
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShiftEntry = entry as LayoutShift;
            if (!layoutShiftEntry.hadRecentInput) {
              clsValue += layoutShiftEntry.value;
              if (process.env.NODE_ENV === 'development') {
                console.log('[Performance] CLS:', clsValue);
              }
            }
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        return () => {
          lcpObserver.disconnect();
          fidObserver.disconnect();
          clsObserver.disconnect();
        };
      } catch (e) {
        console.warn('PerformanceObserver not supported');
      }
    }
  }, [onMetric]);
}

/**
 * Measure component render time
 */
export function useRenderTime(componentName: string) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      console.log(`[Render] ${componentName}: ${(endTime - startTime).toFixed(2)}ms`);
    };
  }, [componentName]);
}

/**
 * Debounced function wrapper
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttled function wrapper for scroll/resize events
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * RAF-based throttling for smooth animations
 */
export function rafThrottle<T extends (...args: unknown[]) => unknown>(
  fn: T
): (...args: Parameters<T>) => void {
  let ticking = false;
  
  return (...args: Parameters<T>) => {
    if (!ticking) {
      requestAnimationFrame(() => {
        fn(...args);
        ticking = false;
      });
      ticking = true;
    }
  };
}

/**
 * Preload critical resources
 */
export function preloadResource(href: string, as: 'image' | 'script' | 'style' | 'font') {
  if (typeof document === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  
  if (as === 'font') {
    link.crossOrigin = 'anonymous';
  }
  
  document.head.appendChild(link);
}

/**
 * Preconnect to external domains
 */
export function preconnect(url: string) {
  if (typeof document === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = url;
  document.head.appendChild(link);

  const dnsLink = document.createElement('link');
  dnsLink.rel = 'dns-prefetch';
  dnsLink.href = url;
  document.head.appendChild(dnsLink);
}

/**
 * Report performance metrics to analytics
 */
export function reportWebVitals(metric: {
  id: string;
  name: string;
  startTime: number;
  value: number;
  label: 'web-vital' | 'custom';
}) {
  // Send to your analytics endpoint
  const body = JSON.stringify(metric);
  
  // Use sendBeacon for reliability
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/performance', body);
  } else {
    fetch('/api/analytics/performance', {
      body,
      method: 'POST',
      keepalive: true,
    });
  }
}

/**
 * Optimize image loading
 */
export function getOptimizedImageProps(
  src: string,
  width: number,
  quality: number = 75
) {
  return {
    src,
    width,
    quality,
    loading: 'lazy' as const,
    decoding: 'async' as const,
    sizes: `(max-width: ${width}px) 100vw, ${width}px`,
  };
}

/**
 * Check if device is low-end
 */
export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency;
  
  return (memory !== undefined && memory < 4) || (cores !== undefined && cores < 4);
}

/**
 * Should reduce animations based on device and preference
 */
export function shouldReduceAnimations(): boolean {
  if (typeof window === 'undefined') return false;
  
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isLowEnd = isLowEndDevice();
  
  return prefersReducedMotion || isLowEnd;
}

/**
 * Batch DOM reads/writes for better performance
 */
export function batchDOMOperations<T>(
  reads: (() => T)[],
  writes: ((results: T[]) => void)[]
): void {
  // Read phase
  const results = reads.map(read => read());
  
  // Write phase - batch all writes together
  requestAnimationFrame(() => {
    writes.forEach(write => write(results));
  });
}
