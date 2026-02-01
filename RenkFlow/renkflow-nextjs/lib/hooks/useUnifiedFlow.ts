'use client';

import React from 'react';
import { offlineDB } from '@/lib/offline/indexeddb';
import { syncQueue } from '@/lib/offline/sync-queue';
import { realtime as wsClient } from '@/lib/realtime/client';
import { encryption } from '@/lib/security/encryption';
import { Order, createOrderId, createTenantId, CurrencySchema } from '@/lib/types';

/**
 * Unified Flow Hook
 * Orchestrates multiple systems for a seamless order lifecycle
 */

interface UnifiedOrder extends Order {
  isSuspicious?: boolean;
  aiMetadata?: {
    sentiment: string;
    fraudProbability: number;
    suggestedFastTrack: boolean;
  };
  encryptionKeyId?: string;
}

export function useUnifiedOrderSystem(tenantId: string) {
  const [isProcessing, setIsProcessing] = React.useState(false);

  /**
   * Complex operation: Create order with AI analysis, encryption, and sync
   */
  const createOrderWithSync = React.useCallback(async (orderData: Partial<UnifiedOrder>) => {
    setIsProcessing(true);
    try {
      // 1. AI Analysis Simulation
      const aiAnalysis = {
        sentiment: 'positive',
        fraudProbability: Math.random() < 0.1 ? 0.8 : 0.05,
        suggestedFastTrack: ((orderData.totalAmount as number) || 0) > 1000,
      };

      // 2. Encryption for sensitive data (e.g. email)
      let emailField = orderData.email;
      let encryptionKeyId = undefined;
      
      if (orderData.email) {
        const encrypted = await encryption.encrypt(orderData.email);
        emailField = encrypted.ciphertext; // Replace with ciphertext
        encryptionKeyId = encrypted.keyId;
      }

      // 3. Prepare Enhanced Order with Security & AI data
      const idString = orderData.id || `order-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const enhancedOrder: UnifiedOrder = {
        ...orderData,
        id: createOrderId(idString as string),
        orderNumber: orderData.orderNumber || `RF-${Date.now().toString().slice(-6)}`,
        customerName: orderData.customerName || 'Unnamed Customer',
        email: emailField,
        date: new Date().toISOString(),
        totalAmount: orderData.totalAmount || 0,
        currency: (() => {
          const result = CurrencySchema.safeParse(orderData.currency);
          return result.success ? result.data : '₺';
        })(),
        status: orderData.status || 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId: createTenantId(tenantId),
        documents: orderData.documents || [],
        isSuspicious: aiAnalysis.fraudProbability > 0.5,
        aiMetadata: aiAnalysis,
        encryptionKeyId,
      };

      // 4. Local Persistence (Offline-First)
      await offlineDB.put('orders', enhancedOrder as any);

      // 5. Audit Logging (To IndexedDB)
      await offlineDB.put('auditLogs', {
        id: `log-${Date.now()}`,
        action: 'order_created',
        entityId: enhancedOrder.id,
        timestamp: new Date().toISOString(),
        metadata: { ai: aiAnalysis, encrypted: !!encryptionKeyId }
      } as any);
      
      console.log(`[UnifiedFlow] Order ${enhancedOrder.id} logged in system.`);

      // 6. Queue for Server Sync
      await syncQueue.enqueue(
        'create',
        'order',
        enhancedOrder.id,
        enhancedOrder
      );

      // 7. Real-time broadcast if online
      if (wsClient.isConnected()) {
        wsClient.publish('order:created', enhancedOrder, 1);
      }

      return enhancedOrder;
    } catch (error) {
      console.error('[UnifiedFlow] Failed to create order:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [tenantId]);

  return { createOrderWithSync, isProcessing };
}
