/**
 * Permission System Unit Tests
 * Tests for hasPermission, canAccessFinance, sanitizer functions
 */

import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessFinance,
  canDeleteFinanceRecords,
  canViewFinancialFields,
  isRoleAtLeast,
  canAccessRoute,
  UserRole,
  Permission,
  FINANCE_ROLES,
} from '../permissions';

import {
  sanitizeOrderForRole,
  sanitizeOrdersForRole,
} from '../sanitizer';

describe('Permission System', () => {
  describe('hasPermission', () => {
    it('owner should have all permissions', () => {
      expect(hasPermission('owner', 'orders.view')).toBe(true);
      expect(hasPermission('owner', 'orders.delete')).toBe(true);
      expect(hasPermission('owner', 'finance.view')).toBe(true);
      expect(hasPermission('owner', 'finance.payments.delete')).toBe(true);
      expect(hasPermission('owner', 'settings.edit')).toBe(true);
    });

    it('admin should have almost all permissions', () => {
      expect(hasPermission('admin', 'orders.view')).toBe(true);
      expect(hasPermission('admin', 'orders.delete')).toBe(true);
      expect(hasPermission('admin', 'finance.view')).toBe(true);
      expect(hasPermission('admin', 'finance.payments.delete')).toBe(true);
    });

    it('accountant should have finance + read-only order permissions', () => {
      expect(hasPermission('accountant', 'orders.view')).toBe(true);
      expect(hasPermission('accountant', 'orders.edit')).toBe(false);
      expect(hasPermission('accountant', 'orders.delete')).toBe(false);
      expect(hasPermission('accountant', 'finance.view')).toBe(true);
      expect(hasPermission('accountant', 'finance.payments.create')).toBe(true);
      expect(hasPermission('accountant', 'finance.payments.delete')).toBe(false);
      expect(hasPermission('accountant', 'finance.documents.upload')).toBe(true);
      expect(hasPermission('accountant', 'finance.documents.delete')).toBe(false);
    });

    it('office should have operational permissions but not finance', () => {
      expect(hasPermission('office', 'orders.view')).toBe(true);
      expect(hasPermission('office', 'orders.edit')).toBe(true);
      expect(hasPermission('office', 'orders.create')).toBe(true);
      expect(hasPermission('office', 'customers.edit')).toBe(true);
      expect(hasPermission('office', 'finance.view')).toBe(false);
    });

    it('member should have limited permissions', () => {
      expect(hasPermission('member', 'orders.view')).toBe(true);
      expect(hasPermission('member', 'orders.edit')).toBe(true);
      expect(hasPermission('member', 'orders.delete')).toBe(false);
      expect(hasPermission('member', 'finance.view')).toBe(false);
    });

    it('worker should have minimal permissions', () => {
      expect(hasPermission('worker', 'orders.view')).toBe(true);
      expect(hasPermission('worker', 'orders.edit')).toBe(false);
      expect(hasPermission('worker', 'kanban.view')).toBe(true);
      expect(hasPermission('worker', 'finance.view')).toBe(false);
      expect(hasPermission('worker', 'reports.view')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true if user has any of the permissions', () => {
      expect(hasAnyPermission('worker', ['orders.view', 'finance.view'])).toBe(true);
      expect(hasAnyPermission('accountant', ['finance.view', 'orders.delete'])).toBe(true);
    });

    it('should return false if user has none of the permissions', () => {
      expect(hasAnyPermission('worker', ['finance.view', 'settings.edit'])).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true if user has all permissions', () => {
      expect(hasAllPermissions('owner', ['orders.view', 'finance.view', 'settings.edit'])).toBe(true);
    });

    it('should return false if user is missing any permission', () => {
      expect(hasAllPermissions('accountant', ['orders.view', 'orders.edit'])).toBe(false);
    });
  });

  describe('canAccessFinance', () => {
    it('should return true for finance roles', () => {
      expect(canAccessFinance('owner')).toBe(true);
      expect(canAccessFinance('admin')).toBe(true);
      expect(canAccessFinance('accountant')).toBe(true);
    });

    it('should return false for non-finance roles', () => {
      expect(canAccessFinance('office')).toBe(false);
      expect(canAccessFinance('member')).toBe(false);
      expect(canAccessFinance('worker')).toBe(false);
    });
  });

  describe('canDeleteFinanceRecords', () => {
    it('should return true only for owner/admin', () => {
      expect(canDeleteFinanceRecords('owner')).toBe(true);
      expect(canDeleteFinanceRecords('admin')).toBe(true);
      expect(canDeleteFinanceRecords('accountant')).toBe(false);
      expect(canDeleteFinanceRecords('office')).toBe(false);
    });
  });

  describe('canViewFinancialFields', () => {
    it('should return false only for worker', () => {
      expect(canViewFinancialFields('owner')).toBe(true);
      expect(canViewFinancialFields('admin')).toBe(true);
      expect(canViewFinancialFields('accountant')).toBe(true);
      expect(canViewFinancialFields('office')).toBe(true);
      expect(canViewFinancialFields('member')).toBe(true);
      expect(canViewFinancialFields('worker')).toBe(false);
    });
  });

  describe('isRoleAtLeast', () => {
    it('should correctly compare role hierarchy', () => {
      expect(isRoleAtLeast('owner', 'admin')).toBe(true);
      expect(isRoleAtLeast('admin', 'owner')).toBe(false);
      expect(isRoleAtLeast('accountant', 'office')).toBe(true);
      expect(isRoleAtLeast('worker', 'member')).toBe(false);
      expect(isRoleAtLeast('member', 'worker')).toBe(true);
    });
  });

  describe('canAccessRoute', () => {
    it('should allow access to routes based on permissions', () => {
      expect(canAccessRoute('owner', '/finance')).toBe(true);
      expect(canAccessRoute('accountant', '/finance')).toBe(true);
      expect(canAccessRoute('worker', '/finance')).toBe(false);
      expect(canAccessRoute('worker', '/orders')).toBe(true);
      expect(canAccessRoute('office', '/orders')).toBe(true);
    });

    it('should allow access to unprotected routes', () => {
      expect(canAccessRoute('worker', '/dashboard')).toBe(true);
      expect(canAccessRoute('worker', '/some-unprotected-route')).toBe(true);
    });
  });
});

describe('Sanitizer', () => {
  const mockOrder = {
    id: '123',
    orderNumber: 'ORD001',
    customerName: 'Test Customer',
    totalAmount: 1000,
    currency: 'TRY',
    status: 'pending' as const,
    date: '2024-01-01',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  describe('sanitizeOrderForRole', () => {
    it('should not modify order for non-worker roles', () => {
      const result = sanitizeOrderForRole(mockOrder, 'owner');
      expect(result.totalAmount).toBe(1000);
      expect(result.currency).toBe('TRY');
    });

    it('should remove financial fields for worker role', () => {
      const result = sanitizeOrderForRole(mockOrder, 'worker');
      expect(result.totalAmount).toBeUndefined();
      expect(result.currency).toBeUndefined();
      expect(result.customerName).toBe('Test Customer');
      expect(result.orderNumber).toBe('ORD001');
    });
  });

  describe('sanitizeOrdersForRole', () => {
    const mockOrders = [mockOrder, { ...mockOrder, id: '456' }];

    it('should sanitize all orders for worker role', () => {
      const results = sanitizeOrdersForRole(mockOrders, 'worker');
      results.forEach(order => {
        expect(order.totalAmount).toBeUndefined();
        expect(order.currency).toBeUndefined();
      });
    });

    it('should not modify orders for non-worker roles', () => {
      const results = sanitizeOrdersForRole(mockOrders, 'accountant');
      results.forEach(order => {
        expect(order.totalAmount).toBeDefined();
        expect(order.currency).toBeDefined();
      });
    });
  });
});

describe('Finance Roles Configuration', () => {
  it('FINANCE_ROLES should contain correct roles', () => {
    expect(FINANCE_ROLES).toContain('owner');
    expect(FINANCE_ROLES).toContain('admin');
    expect(FINANCE_ROLES).toContain('accountant');
    expect(FINANCE_ROLES).not.toContain('office');
    expect(FINANCE_ROLES).not.toContain('worker');
    expect(FINANCE_ROLES).not.toContain('member');
  });
});
