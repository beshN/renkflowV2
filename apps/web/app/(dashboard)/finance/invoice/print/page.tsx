'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import { ArrowLeft, FileWarning, Printer } from 'lucide-react';

import { InvoiceTemplate } from '@/components/finance/InvoiceTemplate';
import { getOrderByIdAction } from '@/app/actions/order.actions';
import { listPaymentsByOrder } from '@/app/actions/finance.payments.actions';
import { normalizeCurrencyInput } from '@/lib/utils/currency';
import { type Order } from '@/lib/types';
import { type Payment } from '@/lib/types/finance';

interface InvoiceModel {
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  from: {
    name: string;
    address?: string;
    taxId?: string;
    email?: string;
    phone?: string;
  };
  to: {
    name: string;
    address?: string;
    taxId?: string;
    email?: string;
    phone?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  notes?: string;
  status: 'paid' | 'pending' | 'overdue';
}

function buildInvoice(order: Order, payments: Payment[]): InvoiceModel {
  const quantity = Math.max(order.quantity || 1, 1);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = Math.max(0, order.totalAmount - totalPaid);

  const dueDate = order.deliveryDate ? new Date(order.deliveryDate) : null;
  const isOverdue = Boolean(dueDate && dueDate < new Date() && outstanding > 0);

  return {
    invoiceNumber: `FAT-${order.orderNumber}`,
    date: order.createdAt || order.date || new Date().toISOString(),
    dueDate: order.deliveryDate || undefined,
    from: {
      name: 'RenkFlow',
      email: 'finance@renkflow.com',
      address: 'Türkiye',
    },
    to: {
      name: order.customerName,
      email: order.email || undefined,
      phone: order.phone || undefined,
    },
    items: [
      {
        description: order.productName || 'Sipariş Kalemi',
        quantity,
        unitPrice: order.totalAmount / quantity,
        total: order.totalAmount,
      },
    ],
    subtotal: order.totalAmount,
    taxTotal: 0,
    total: order.totalAmount,
    currency: normalizeCurrencyInput(order.currency),
    notes: order.notes || undefined,
    status: outstanding <= 0 ? 'paid' : isOverdue ? 'overdue' : 'pending',
  };
}

export default function InvoicePrintPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const autoPrint = searchParams.get('print') === 'true';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  const ref = useRef<HTMLDivElement>(null);

  const invoice = useMemo(() => {
    if (!order) return null;
    return buildInvoice(order, payments);
  }, [order, payments]);

  const handlePrint = useReactToPrint({
    contentRef: ref,
    documentTitle: `Fatura-${invoice?.invoiceNumber || orderId || 'Taslak'}`,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!orderId) {
        setError('Sipariş parametresi bulunamadı.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [orderData, paymentData] = await Promise.all([
          getOrderByIdAction(orderId),
          listPaymentsByOrder(orderId).catch(() => []),
        ]);

        if (cancelled) return;

        if (!orderData) {
          setError('Sipariş kaydı bulunamadı.');
          return;
        }

        setOrder(orderData);
        setPayments(paymentData);
      } catch (err) {
        if (!cancelled) {
          console.error('Invoice print load error:', err);
          setError('Fatura verileri yüklenemedi.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    if (!autoPrint || !invoice || loading || error) return;
    const timer = setTimeout(() => handlePrint(), 450);
    return () => clearTimeout(timer);
  }, [autoPrint, invoice, loading, error, handlePrint]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-100 p-4 dark:bg-slate-900 md:p-8">
      <div className="mb-6 flex w-full max-w-[210mm] items-center justify-between rounded-xl bg-white p-4 shadow-sm print:hidden dark:bg-slate-800">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ArrowLeft size={16} />
          Önceki ekrana dön
        </button>

        {!loading && !error && invoice ? (
          <button
            type="button"
            onClick={() => handlePrint()}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
          >
            <Printer size={16} />
            Yazdır / PDF oluştur
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="w-full max-w-[210mm] rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
          <p className="text-sm text-slate-600">Fatura şablonu hazırlanıyor...</p>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="w-full max-w-[210mm] rounded-xl border border-rose-200 bg-white p-10 text-center shadow-sm">
          <FileWarning className="mx-auto mb-3 h-8 w-8 text-rose-500" />
          <p className="text-sm font-medium text-rose-600">{error}</p>
        </div>
      ) : null}

      {!loading && !error && invoice ? (
        <div className="flex w-full justify-center overflow-auto pb-12">
          <InvoiceTemplate ref={ref} {...invoice} />
        </div>
      ) : null}
    </div>
  );
}
