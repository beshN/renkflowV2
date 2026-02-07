'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Printer, ArrowLeft } from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { useOrders } from '@/lib/hooks/useOrders';
import { useAuth } from '@/lib/context/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function OrderInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { getOrderById, isLoading } = useOrders();

  const orderId = params.id as string;
  const order = getOrderById(orderId);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/auth/login');
    }
  }, [isAuthLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/70 dark:bg-slate-950/60">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Fatura bulunamadı</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Sipariş bilgileri yüklenemedi.</p>
          <Button variant="primary" onClick={() => router.push('/orders')}>
            Siparişlere dön
          </Button>
        </div>
      </div>
    );
  }

  const quantity = order.quantity || 1;
  const unitPrice = order.totalAmount / quantity;
  const invoiceNumber = order.orderNumber || order.id;

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950/60">
      <div className="print:hidden">
        <Navbar title={`Fatura #${invoiceNumber.slice(0, 8)}`} showSearch={false} />
      </div>

      <main className="mx-auto max-w-4xl px-4 pb-12 pt-6 print:pt-4">
        <div className="print:hidden flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <Link
            href={`/orders/${order.id}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Siparişe dön
          </Link>
          <Button onClick={() => window.print()} variant="primary" className="gap-2">
            <Printer size={16} />
            Yazdır / PDF
          </Button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm print:border-none print:shadow-none">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Fatura</p>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                #{invoiceNumber.slice(0, 10)}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Tarih: {formatDate(order.date)}
              </p>
              {order.deliveryDate && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Teslimat: {formatDate(order.deliveryDate)}
                </p>
              )}
            </div>

            <div className="text-sm text-right text-slate-500 dark:text-slate-400">
              <p className="font-semibold text-slate-900 dark:text-white">RenkFlow</p>
              <p>Üretim ve Akış Yönetimi</p>
              <p>support@renkflow.com</p>
              <p>İstanbul, TR</p>
            </div>
          </div>

          <div className="grid gap-6 mt-8 md:grid-cols-2">
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Fatura Edilen</p>
              <p className="text-base font-bold text-slate-900 dark:text-white">{order.customerName}</p>
              {order.email && <p className="text-sm text-slate-500 dark:text-slate-400">{order.email}</p>}
              {order.phone && <p className="text-sm text-slate-500 dark:text-slate-400">{order.phone}</p>}
            </div>
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sipariş Bilgisi</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Sipariş No: <span className="text-slate-900 dark:text-white font-medium">#{invoiceNumber}</span>
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Durum: <span className="text-slate-900 dark:text-white font-medium">{order.status}</span>
              </p>
            </div>
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2 text-slate-500 font-semibold">Ürün</th>
                  <th className="py-2 text-right text-slate-500 font-semibold">Adet</th>
                  <th className="py-2 text-right text-slate-500 font-semibold">Birim Fiyat</th>
                  <th className="py-2 text-right text-slate-500 font-semibold">Tutar</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-3 font-medium text-slate-900 dark:text-white">{order.productName || 'Ürün'}</td>
                  <td className="py-3 text-right text-slate-600 dark:text-slate-300">{quantity}</td>
                  <td className="py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(unitPrice, order.currency)}</td>
                  <td className="py-3 text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(order.totalAmount, order.currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Ara Toplam</span>
                <span>{formatCurrency(order.totalAmount, order.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>KDV</span>
                <span>₺0,00</span>
              </div>
              <div className="flex items-center justify-between text-slate-900 dark:text-white font-semibold border-t border-slate-200 dark:border-slate-800 pt-2">
                <span>Toplam</span>
                <span>{formatCurrency(order.totalAmount, order.currency)}</span>
              </div>
            </div>
          </div>

          {order.notes && (
            <div className="mt-8 rounded-xl border border-slate-100 dark:border-slate-800 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notlar</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{order.notes}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
