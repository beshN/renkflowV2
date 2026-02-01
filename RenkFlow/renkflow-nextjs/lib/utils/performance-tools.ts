/**
 * Performance & Load Testing Utilities
 * Tools for measuring system limits and detecting regressions
 */

import { Order, createOrderId } from '@/lib/types';

/**
 * Generates massive datasets for stress testing the UI and IndexedDB
 */
export async function generateStressTestData(count: number): Promise<Order[]> {
  console.log(`[LoadTest] Generating ${count} mock orders...`);
  
  const orders: Order[] = [];
  const start = performance.now();

  for (let i = 0; i < count; i++) {
    orders.push({
      id: createOrderId(`stress-${i}-${Math.random().toString(36).substr(2, 5)}`),
      orderNumber: `RF-ST-${i}`,
      customerName: `Stress Test User ${i}`,
      date: new Date().toISOString(),
      totalAmount: Math.floor(Math.random() * 5000),
      currency: '₺',
      status: i % 2 === 0 ? 'pending' : 'delivered',
      notes: `Large dataset item for performance analysis #${i}`,
      documents: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const end = performance.now();
  console.log(`[LoadTest] Generation complete in ${(end - start).toFixed(2)}ms`);
  
  return orders;
}

/**
 * Lightweight memory usage tracker
 */
export function detectMemoryLeaks(callback: (memoryTrend: number) => void, durationMs: number = 60000) {
  if (typeof window === 'undefined' || !(window.performance as any).memory) {
    console.warn('[LoadTest] Memory API not supported in this browser');
    return () => {};
  }

  const measurements: number[] = [];
  const interval = setInterval(() => {
    const usage = (window.performance as any).memory.usedJSHeapSize;
    measurements.push(usage);
    
    if (measurements.length > 1) {
      const trend = usage - measurements[measurements.length - 2];
      callback(trend);
    }
  }, 1000);

  const timeout = setTimeout(() => {
    clearInterval(interval);
    console.log('[LoadTest] Memory monitoring session finished');
  }, durationMs);

  return () => {
    clearInterval(interval);
    clearTimeout(timeout);
  };
}

/**
 * Measure execution time of a specific component block
 */
export function measurePerformance<T>(name: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`[Perf] ${name} executed in ${(end - start).toFixed(2)}ms`);
  return result;
}
