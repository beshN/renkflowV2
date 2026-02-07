/**
 * Data Sanitizer for Role-Based Field Filtering
 * 
 * Workers should NOT see financial fields in orders.
 * This module provides functions to sanitize data based on user role.
 */

import { Order } from '@/lib/types';
import { UserRole, canViewFinancialFields } from './permissions';

/**
 * Financial fields that should be hidden from workers
 */
const FINANCIAL_FIELDS: (keyof Order)[] = [
  'totalAmount',
  'currency',
];

/**
 * Sanitize a single order based on user role
 * Removes financial fields for workers
 */
export function sanitizeOrderForRole<T extends Partial<Order>>(
  order: T,
  role: UserRole
): T {
  if (canViewFinancialFields(role)) {
    return order;
  }

  // Create a copy without financial fields
  const sanitized = { ...order };
  
  for (const field of FINANCIAL_FIELDS) {
    if (field in sanitized) {
      delete (sanitized as any)[field];
    }
  }

  return sanitized;
}

/**
 * Sanitize an array of orders based on user role
 */
export function sanitizeOrdersForRole<T extends Partial<Order>>(
  orders: T[],
  role: UserRole
): T[] {
  if (canViewFinancialFields(role)) {
    return orders;
  }

  return orders.map(order => sanitizeOrderForRole(order, role));
}

/**
 * Generic sanitizer for any object with specified fields to remove
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  fieldsToRemove: (keyof T)[]
): Partial<T> {
  const sanitized = { ...obj };
  
  for (const field of fieldsToRemove) {
    delete sanitized[field];
  }

  return sanitized;
}

/**
 * Check if a response should include financial data
 */
export function shouldIncludeFinancialData(role: UserRole): boolean {
  return canViewFinancialFields(role);
}
