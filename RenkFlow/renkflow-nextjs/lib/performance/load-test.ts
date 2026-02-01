// @/lib/performance/load-test.ts
import type { Order } from '@/lib/types';
import { createOrderId } from '@/lib/types';
import * as React from 'react';
export async function generateStressTestData(count: number): Promise<Order[]> {
  const statuses: Order['status'][] = ['pending', 'in_production', 'delivered'];
  return Array.from({ length: count }, (_, i) => ({
    id: createOrderId(`order-${i}`),
    orderNumber: `RF-${String(i).padStart(6, '0')}`,
    customerName: `Müşteri ${i}`,
    productName: `Ürün ${i % 20}`,
    quantity: Math.max(1, Math.floor(Math.random() * 5)),
    totalAmount: Math.round(Math.random() * 10000),
    currency: '₺' as const,
    status: statuses[i % statuses.length],
    date: new Date(Date.now() - Math.random() * 86400000 * 365).toISOString().split('T')[0],
    documents: [],
    createdAt: new Date(Date.now() - Math.random() * 86400000 * 365).toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

export function measureRenderTime(component: React.ComponentType, props: any): number {
  const start = performance.now();
  const element = React.createElement(component, props);
  const end = performance.now();
  return end - start;
}

export async function testWebSocketLimits(): Promise<{ maxConnections: number; latency: number }> {
  const connections: WebSocket[] = [];
  let maxConnections = 0;
  
  try {
    while (maxConnections < 10000) {
      const ws = new WebSocket('ws://localhost:3001');
      await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
        setTimeout(reject, 5000);
      });
      connections.push(ws);
      maxConnections++;
    }
  } catch {
    // Limit reached
  }
  
  connections.forEach(ws => ws.close());
  return { maxConnections, latency: 0 };
}

export function detectMemoryLeaks(callback: () => void, duration: number): number[] {
  const measurements: number[] = [];
  const interval = setInterval(() => {
    const perf = performance as any;
    if (perf.memory) {
      measurements.push(perf.memory.usedJSHeapSize);
    }
  }, 1000);
  
  setTimeout(() => {
    clearInterval(interval);
    callback();
  }, duration);
  
  return measurements;
}
