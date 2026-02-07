'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createStockMovement, type StockMovementType } from '@/app/actions/inventory.actions';
import { Modal } from '@/components/shared/ui/Modal';
import { Button } from '@/components/shared/ui/Button';
import { useToast } from '@/lib/context/ToastContext';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission, type UserRole } from '@/lib/auth/permissions';

interface AddStockMovementModalProps {
  itemId: string;
}

export function AddStockMovementModal({ itemId }: AddStockMovementModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const canCreateMovement = user?.role
    ? hasPermission(user.role as UserRole, 'inventory.movements.create')
    : false;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateMovement) {
      showToast('Bu işlem için yetkiniz bulunmuyor', 'error');
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      setSubmitting(true);
      await createStockMovement({
        itemId,
        type: String(data.get('type') || 'IN') as StockMovementType,
        quantity: Number(data.get('quantity') || 0),
        orderId: String(data.get('orderId') || '').trim() || undefined,
        note: String(data.get('note') || '').trim() || undefined,
      });

      showToast('Stok hareketi kaydedildi', 'success');
      setOpen(false);
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Hareket kaydedilemedi', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!canCreateMovement} title={!canCreateMovement ? 'Yetkiniz yok' : undefined}>
        Hareket Ekle
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Stok Hareketi Ekle">
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="space-y-1 block text-sm">
            <span className="font-medium">Tip</span>
            <select name="type" className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2">
              <option value="IN">IN (Giriş)</option>
              <option value="OUT">OUT (Çıkış)</option>
              <option value="ADJUST">ADJUST (Düzeltme / Delta)</option>
            </select>
          </label>

          <label className="space-y-1 block text-sm">
            <span className="font-medium">Miktar</span>
            <input name="quantity" type="number" step="0.01" min={0.01} required className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
          </label>

          <label className="space-y-1 block text-sm">
            <span className="font-medium">Sipariş ID (opsiyonel)</span>
            <input name="orderId" className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
          </label>

          <label className="space-y-1 block text-sm">
            <span className="font-medium">Not</span>
            <textarea name="note" rows={3} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>İptal</Button>
            <Button type="submit" isLoading={submitting}>Kaydet</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
