'use client';

import { PageHeader, SkeletonRows } from '@/components/kit';
import { CustomerImportWizard } from '@/components/features/customers/CustomerImportWizard';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission } from '@/lib/features/auth/permissions';

/** Customer list import (CSV), for roles that may create customers. */
export default function CustomerImportPage() {
  const { user, isLoading } = useAuth();
  const allowed = Boolean(user && hasPermission(user.role, 'customers.create'));
  return (
    <div className="rf-page space-y-5">
      <PageHeader
        eyebrow="Müşteriler"
        title="Müşteri listesini içe aktar"
        hint="Kayıtlı müşterileri tekrarlamadan toplu ekleyin; kaydetmeden önce her satırın sonucunu görürsünüz."
      />
      {isLoading ? (
        <SkeletonRows />
      ) : allowed ? (
        <CustomerImportWizard
          key={`${user?.tenantId}:${user?.id}`}
          canFill={Boolean(user && hasPermission(user.role, 'customers.edit'))}
        />
      ) : (
        <p className="rf-panel p-4 text-sm">Müşteri ekleme yetkiniz yok.</p>
      )}
    </div>
  );
}
