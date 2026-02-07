'use client';

/**
 * Professional Invoice Template
 * Designed for both screen viewing and high-quality printing (PDF generation)
 */

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { formatFinanceCurrency } from '@/lib/utils/finance';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceProps {
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  from: {
    name: string;
    address?: string;
    taxId?: string;
    email?: string;
    phone?: string;
    logo?: string;
  };
  to: {
    name: string;
    address?: string;
    taxId?: string;
    email?: string;
    phone?: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  notes?: string;
  status?: 'paid' | 'pending' | 'overdue';
  className?: string;
}

export const InvoiceTemplate = forwardRef<HTMLDivElement, InvoiceProps>(({
  invoiceNumber,
  date,
  dueDate,
  from,
  to,
  items,
  subtotal,
  taxTotal,
  total,
  currency,
  notes,
  status = 'pending',
  className,
}, ref) => {
  return (
    <div 
      ref={ref}
      className={cn(
        'w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white p-12 md:p-16 shadow-lg print:shadow-none print:m-0 print:w-full print:max-w-none text-slate-900',
        className
      )}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-12">
        <div>
          {from.logo ? (
            <img src={from.logo} alt={from.name} className="h-12 w-auto mb-4" />
          ) : (
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{from.name}</h1>
          )}
          <div className="text-sm text-slate-500 space-y-1">
            {from.address && <p className="whitespace-pre-line">{from.address}</p>}
            {from.email && <p>{from.email}</p>}
            {from.phone && <p>{from.phone}</p>}
            {from.taxId && <p>Vergi No: {from.taxId}</p>}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-4xl font-light text-slate-200 mb-4">FATURA</h2>
          <div className="space-y-2">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Fatura No</span>
              <span className="text-lg font-medium">{invoiceNumber}</span>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Tarih</span>
              <span className="text-slate-600">{new Date(date).toLocaleDateString('tr-TR')}</span>
            </div>
            {dueDate && (
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Vade Tarihi</span>
                <span className="text-slate-600">{new Date(dueDate).toLocaleDateString('tr-TR')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div className="mb-12">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Sayın</h3>
        <p className="text-xl font-bold text-slate-900 mb-2">{to.name}</p>
        <div className="text-sm text-slate-500 space-y-1">
          {to.address && <p className="whitespace-pre-line">{to.address}</p>}
          {to.email && <p>{to.email}</p>}
          {to.phone && <p>{to.phone}</p>}
          {to.taxId && <p>Vergi No: {to.taxId}</p>}
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full mb-12">
        <thead>
          <tr className="border-b-2 border-slate-100">
            <th className="text-left py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-1/2">Açıklama</th>
            <th className="text-right py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Miktar</th>
            <th className="text-right py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Birim Fiyat</th>
            <th className="text-right py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Toplam</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {items.map((item, index) => (
            <tr key={index}>
              <td className="py-4 text-sm text-slate-900 font-medium">{item.description}</td>
              <td className="py-4 text-sm text-slate-600 text-right">{item.quantity}</td>
              <td className="py-4 text-sm text-slate-600 text-right">
                {formatFinanceCurrency(item.unitPrice, currency)}
              </td>
              <td className="py-4 text-sm text-slate-900 font-bold text-right">
                {formatFinanceCurrency(item.total, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-12">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Ara Toplam</span>
            <span>{formatFinanceCurrency(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>KDV Toplam</span>
            <span>{formatFinanceCurrency(taxTotal, currency)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-slate-900 pt-3 border-t-2 border-slate-100">
            <span>Genel Toplam</span>
            <span>{formatFinanceCurrency(total, currency)}</span>
          </div>
        </div>
      </div>

      {/* Footer / Notes */}
      <div className="border-t border-slate-100 pt-8">
        {notes && (
          <div className="mb-8">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notlar</h4>
            <p className="text-sm text-slate-500">{notes}</p>
          </div>
        )}
        
        <div className="text-center text-xs text-slate-400">
          <p>RenkFlow ile oluşturulmuştur</p>
        </div>
      </div>

      {/* Status Watermark (Print Only) */}
      {status === 'paid' && (
        <div className="hidden print:block absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 transform -rotate-45 border-4 border-green-500 text-green-500 text-8xl font-black opacity-20 px-8 py-4 rounded-xl uppercase tracking-widest">
          ÖDENDİ
        </div>
      )}
    </div>
  );
});

InvoiceTemplate.displayName = 'InvoiceTemplate';
