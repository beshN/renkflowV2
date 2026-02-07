import { useEffect, useCallback, useRef } from 'react';

// Core Web Vitals Metric Types
export interface WebVitalsMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'INP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  entries?: PerformanceEntry[];
}

// Web Vitals Thresholds (Google's Core Web Vitals)
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  INP: { good: 200, poor: 500 },
  TTFB: { good: 800, poor: 1800 },
};

/**
 * Get rating based on value and thresholds
 */
function getRating(
  value: number,
  thresholds: { good: number; poor: number }
): 'good' | 'needs-improvement' | 'poor' {
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Report Web Vitals to console and optionally to analytics
 */
export function reportWebVitals(
  onReport?: (metric: WebVitalsMetric) => void
) {
  // LCP - Largest Contentful Paint
  const observeLCP = () => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
      const value = lastEntry.renderTime || lastEntry.loadTime || 0;
      
      const metric: WebVitalsMetric = {
        name: 'LCP',
        value,
        rating: getRating(value, THRESHOLDS.LCP),
        entries,
      };
      
      console.log(`[Web Vitals] LCP: ${value.toFixed(2)}ms (${metric.rating})`);
      onReport?.(metric);
    });
    
    observer.observe({ entryTypes: ['largest-contentful-paint'] });
    return () => observer.disconnect();
  };

  // CLS - Cumulative Layout Shift
  const observeCLS = () => {
    let clsValue = 0;
    let sessionEntries: PerformanceEntry[] = [];
    
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!layoutShift.hadRecentInput) {
          clsValue += layoutShift.value;
          sessionEntries.push(entry);
        }
      }
      
      const metric: WebVitalsMetric = {
        name: 'CLS',
        value: clsValue,
        rating: getRating(clsValue, THRESHOLDS.CLS),
        entries: sessionEntries,
      };
      
      console.log(`[Web Vitals] CLS: ${clsValue.toFixed(4)} (${metric.rating})`);
      onReport?.(metric);
    });
    
    observer.observe({ entryTypes: ['layout-shift'] });
    
    // Report final CLS on page unload
    const reportFinalCLS = () => {
      const metric: WebVitalsMetric = {
        name: 'CLS',
        value: clsValue,
        rating: getRating(clsValue, THRESHOLDS.CLS),
        entries: sessionEntries,
      };
      onReport?.(metric);
    };
    
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        reportFinalCLS();
      }
    });
    
    return () => observer.disconnect();
  };

  // FID - First Input Delay
  const observeFID = () => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const firstEntry = entries[0] as PerformanceEntry & { processingStart: number; startTime: number };
      const value = firstEntry.processingStart - firstEntry.startTime;
      
      const metric: WebVitalsMetric = {
        name: 'FID',
        value,
        rating: getRating(value, THRESHOLDS.FID),
        entries,
      };
      
      console.log(`[Web Vitals] FID: ${value.toFixed(2)}ms (${metric.rating})`);
      onReport?.(metric);
    });
    
    observer.observe({ entryTypes: ['first-input'] });
    return () => observer.disconnect();
  };

  // FCP - First Contentful Paint
  const observeFCP = () => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const firstEntry = entries[0] as PerformanceEntry & { startTime: number };
      const value = firstEntry.startTime;
      
      const metric: WebVitalsMetric = {
        name: 'FCP',
        value,
        rating: getRating(value, THRESHOLDS.FCP),
        entries,
      };
      
      console.log(`[Web Vitals] FCP: ${value.toFixed(2)}ms (${metric.rating})`);
      onReport?.(metric);
    });
    
    observer.observe({ entryTypes: ['paint'] });
    return () => observer.disconnect();
  };

  // INP - Interaction to Next Paint (experimental)
  const observeINP = () => {
    let maxDuration = 0;
    const entries: PerformanceEntry[] = [];
    
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const event = entry as PerformanceEntry & { duration: number };
        if (event.duration > maxDuration) {
          maxDuration = event.duration;
          entries.push(entry);
        }
      }
      
      const metric: WebVitalsMetric = {
        name: 'INP',
        value: maxDuration,
        rating: getRating(maxDuration, THRESHOLDS.INP),
        entries,
      };
      
      console.log(`[Web Vitals] INP: ${maxDuration.toFixed(2)}ms (${metric.rating})`);
      onReport?.(metric);
    });
    
    observer.observe({ entryTypes: ['event'] });
    return () => observer.disconnect();
  };

  // TTFB - Time to First Byte
  const observeTTFB = () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      const value = navigation.responseStart - navigation.startTime;
      
      const metric: WebVitalsMetric = {
        name: 'TTFB',
        value,
        rating: getRating(value, THRESHOLDS.TTFB),
        entries: [navigation],
      };
      
      console.log(`[Web Vitals] TTFB: ${value.toFixed(2)}ms (${metric.rating})`);
      onReport?.(metric);
    }
  };

  // Initialize all observers
  const cleanupFns: (() => void)[] = [];
  
  try { cleanupFns.push(observeLCP()); } catch (e) { console.warn('LCP observation failed', e); }
  try { cleanupFns.push(observeCLS()); } catch (e) { console.warn('CLS observation failed', e); }
  try { cleanupFns.push(observeFID()); } catch (e) { console.warn('FID observation failed', e); }
  try { cleanupFns.push(observeFCP()); } catch (e) { console.warn('FCP observation failed', e); }
  try { cleanupFns.push(observeINP()); } catch (e) { console.warn('INP observation failed', e); }
  try { observeTTFB(); } catch (e) { console.warn('TTFB observation failed', e); }

  return () => cleanupFns.forEach(fn => fn());
}

/**
 * React hook for Web Vitals monitoring
 */
export function useWebVitals(onReport?: (metric: WebVitalsMetric) => void) {
  useEffect(() => {
    return reportWebVitals(onReport);
  }, [onReport]);
}

/**
 * Yield control to main thread to prevent blocking
 */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Chunk large work into smaller pieces
 */
export async function chunkWork<T>(
  items: T[],
  callback: (item: T) => void,
  chunkSize: number = 10
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    chunk.forEach(callback);
    
    // Yield to main thread after each chunk
    if (i + chunkSize < items.length) {
      await yieldToMain();
    }
  }
}

/**
 * Reserve space for dynamic content to prevent CLS
 */
export function reserveSpace(element: HTMLElement, minHeight: number): void {
  element.style.minHeight = `${minHeight}px`;
}

export default reportWebVitals;
