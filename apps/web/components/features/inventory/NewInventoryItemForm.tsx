'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createInventoryItem } from '@/app/actions/inventory.actions';
import { Button } from '@/components/shared/ui/Button';
import { useToast } from '@/lib/context/ToastContext';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission, type UserRole } from '@/lib/auth/permissions';

export function NewInventoryItemForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const canCreate = user?.role ? hasPermission(user.role as UserRole, 'inventory.edit') : false;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) {
      showToast('Bu işlem için yetkiniz bulunmuyor', 'error');
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      setSubmitting(true);
      const created = await createInventoryItem({
        sku: String(formData.get('sku') || '').trim(),
        name: String(formData.get('name') || '').trim(),
        unit: String(formData.get('unit') || 'adet').trim() || 'adet',
        minStock: Number(formData.get('minStock') || 0),
        location: String(formData.get('location') || '').trim() || undefined,
        active: formData.get('active') === 'on',
      });

      showToast('Stok kalemi oluşturuldu', 'success');
      router.push(`/inventory/${created.id}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Stok kalemi oluşturulamadı', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
      {!canCreate && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
          Envanter kalemi oluşturmak için yetkiniz yok.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">SKU</span>
          <input name="sku" required disabled={!canCreate} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 disabled:opacity-60" />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Ad</span>
          <input name="name" required disabled={!canCreate} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 disabled:opacity-60" />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Birim</span>
          <input name="unit" defaultValue="adet" disabled={!canCreate} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 disabled:opacity-60" />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Minimum Stok</span>
          <input name="minStock" type="number" min={0} step="0.01" defaultValue={0} disabled={!canCreate} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 disabled:opacity-60" />
        </label>
      </div>

      <label className="space-y-1.5 text-sm block">
        <span className="font-medium">Lokasyon (opsiyonel)</span>
        <input name="location" disabled={!canCreate} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 disabled:opacity-60" />
      </label>

      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked disabled={!canCreate} />
        Aktif
      </label>

      <div className="flex justify-end">
        <Button type="submit" isLoading={submitting} disabled={!canCreate}>Kaydet</Button>
      </div>
    </form>
  );
}
