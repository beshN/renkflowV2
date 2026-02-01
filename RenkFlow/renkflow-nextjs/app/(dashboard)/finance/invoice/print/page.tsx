'use client';

/**
 * Invoice Preview & Print Page
 * Displays the invoice template in a modal-like view ready for printing
 */

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import { InvoiceTemplate } from '@/components/finance/InvoiceTemplate';
import { Printer, X, Download, Share2 } from 'lucide-react';
import { useToast } from '@/lib/context/ToastContext';
// In a real app, you'd fetch this data from server
// import { getOrderDetails } from '@/app/actions/orders';

export default function InvoicePrintPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const printMode = searchParams.get('print') === 'true';
  const componentRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Fatura-${orderId || 'Taslak'}`,
    onAfterPrint: () => showToast('Yazdırma işlemi tamamlandı', 'success'),
  });

  useEffect(() => {
    if (printMode && componentRef.current) {
      // Small delay to ensure render
      setTimeout(handlePrint, 500);
    }
  }, [printMode]);

  // Mock data - replace with actual data fetching
  const invoiceData = {
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    from: {
      name: 'RenkFlow Teknoloji A.Ş.',
      address: 'Teknopark İstanbul\nSanayi Mah. Teknoloji Bulvarı No:1\nPendik/İstanbul',
      taxId: '1234567890',
      email: 'muhasebe@renkflow.com',
      phone: '+90 850 123 45 67',
    },
    to: {
      name: 'Müşteri Örnek Ltd. Şti.',
      address: 'Örnek Mah. Çınar Cad. No:15\nBeşiktaş/İstanbul',
      taxId: '9876543210',
      email: 'info@musteri.com',
    },
    items: [
      { description: 'Web Yazılım Geliştirme Hizmeti', quantity: 1, unitPrice: 15000, total: 15000 },
      { description: 'Sunucu Bakım Hizmeti (Yıllık)', quantity: 1, unitPrice: 2500, total: 2500 },
      { description: 'Domain Yenileme', quantity: 2, unitPrice: 150, total: 300 },
    ],
    subtotal: 17800,
    taxTotal: 3560, // %20
    total: 21360,
    currency: 'TRY',
    notes: 'Ödemenizi yukarıdaki IBAN numarasına gerçekleştirebilirsiniz.',
    status: 'pending' as const,
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-4 md:p-8 flex flex-col items-center">
      {/* Toolbar */}
      <div className="w-full max-w-[210mm] flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm mb-8 print:hidden">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => window.history.back()}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
          >
            <X size={20} />
          </button>
          <h1 className="font-semibold text-slate-900 dark:text-white">Fatura Önizleme</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handlePrint()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Printer size={18} />
            Yazdır / PDF
          </button>
        </div>
      </div>

      {/* Invoice Area */}
      <div className="w-full overflow-auto flex justify-center pb-12">
        <InvoiceTemplate ref={componentRef} {...invoiceData} />
      </div>
    </div>
  );
}
