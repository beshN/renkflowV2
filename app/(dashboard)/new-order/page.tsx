'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { NewOrderForm } from '@/components/forms/NewOrderForm';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { NewOrderFormData, Document } from '@/lib/types';
import { generateId } from '@/lib/utils';

export default function NewOrderPage() {
  const router = useRouter();
  const { addOrder } = useOrders();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return null; 
  }

  const handleSubmit = async (formData: FormData) => {
    try {
      await addOrder(formData);
      
      // Show success message and redirect
      showToast('Sipariş başarıyla oluşturuldu!', 'success');
      router.push('/orders');
    } catch (error) {
      console.error('Error creating order:', error);
      showToast('Sipariş oluşturulurken bir hata oluştu', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Yeni Sipariş" showSearch={false} />
      
      <main className="flex-1 p-8">
        <NewOrderForm onSubmit={handleSubmit} />
      </main>
    </div>
  );
}
