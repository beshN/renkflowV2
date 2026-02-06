/**
 * Performance & Load Testing Utilities
 * Tools for measuring system limits and detecting regressions
 */

import { Order } from '../types';

/**
 * Generates massive datasets for stress testing the UI and IndexedDB
 */
export async function generateStressTestData(count: number): Promise<Order[]> {
  console.log(`[LoadTest] Generating ${count} mock orders...`);
  
  const orders: Order[] = [];
  const start = performance.now();

  for (let i = 0; i < count; i++) {
    const today = new Date();
    const dateOnly = today.toISOString().slice(0, 10);
    const statuses: Order['status'][] = ['pending', 'in_production', 'delivered'];
    orders.push({
      id: `stress-${i}-${Math.random().toString(36).substr(2, 5)}` as Order['id'],
      orderNumber: `RF-ST-${i}`,
      customerName: `Stress Test User ${i}`,
      productName: `Test Product ${i}`,
      quantity: Math.floor(Math.random() * 100) + 1,
      date: dateOnly,
      deliveryDate: dateOnly,
      totalAmount: Math.floor(Math.random() * 5000),
      currency: 'TRY',
      status: statuses[i % 3],
      notes: `Large dataset item for performance analysis #${i}`,
      documents: [],
      customFields: {},
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    } as Order);
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
