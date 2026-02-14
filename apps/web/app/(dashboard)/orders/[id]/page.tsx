'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock3, ExternalLink, FileText, Package, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { useOrders } from '@/lib/hooks/useOrders';
import { formatCurrency, formatDate } from '@/lib/utils';
import { type Document, type Order } from '@/lib/types';

type PdfViewerProps = {
  fileUrl: string;
  fileName: string;
  onClose?: () => void;
};

const PDFViewer = dynamic<PdfViewerProps>(() => import('@/components/pdf-viewer/PDFViewerV2').then((mod) => mod.default), {
  ssr: false,
});

const ORDER_STATUS_STEPS: Array<{ status: Order['status']; label: string; icon: LucideIcon }> = [
  { status: 'pending', label: 'Beklemede', icon: Clock3 },
  { status: 'in_production', label: 'Üretimde', icon: Package },
  { status: 'delivered', label: 'Teslim Edildi', icon: Truck },
];

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const { getOrderById, updateOrderStatus, isLoading } = useOrders();
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  const order = getOrderById(orderId);

  const stepIndex = useMemo(() => ORDER_STATUS_STEPS.findIndex((step) => step.status === order?.status), [order?.status]);
  const getDocumentViewerUrl = (doc: Document) => `/api/orders/documents/${encodeURIComponent(String(doc.id))}/content`;

  if (isLoading && !order) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="rf-panel rounded-2xl p-8 text-center">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sipariş kaydı bulunamadı.</p>
          <Link href="/orders" className="mt-4 inline-block text-sm font-medium text-sky-600 hover:underline">
            Sipariş operasyonlarına dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
      <Navbar title={`Sipariş #${order.orderNumber}`} showSearch={false} />

      <main className="w-full flex-1 p-4 md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/orders" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} /> Sipariş listesine dön
          </Link>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/orders/${order.id}/invoice`)}>
              Fatura görünümü
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => router.push(`/orders/${order.id}?edit=true`)}>
              Kaydı düzenle
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
          <section className="space-y-6">
            <article className="rf-panel rounded-2xl p-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{order.productName || 'Sipariş Kaydı'}</h1>
              <p className="mt-1 text-sm text-slate-500">Müşteri: {order.customerName}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {ORDER_STATUS_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const active = index <= stepIndex;
                  return (
                    <button
                      key={step.status}
                      type="button"
                      onClick={() => updateOrderStatus(order.id, step.status)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                        active
                          ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-900/20 dark:text-sky-300'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                      }`}
                    >
                      <Icon size={16} />
                      {step.label}
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="rf-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sipariş Detay Özeti</h2>
              <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-slate-500">Sipariş tarihi</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{formatDate(order.date)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Planlanan teslim</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{order.deliveryDate ? formatDate(order.deliveryDate) : '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Miktar</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{order.quantity || 1}</p>
                </div>
                <div>
                  <p className="text-slate-500">Toplam tutar</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(order.totalAmount, order.currency)}</p>
                </div>
              </div>

              {order.notes ? (
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {order.notes}
                </div>
              ) : null}
            </article>
          </section>

          <aside className="space-y-6">
            <article className="rf-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Belge Merkezi</h2>
              <div className="mt-4 space-y-3">
                {order.documents?.length ? (
                  order.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="group flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                      onClick={() => setSelectedDocument(doc)}
                    >
                      <FileText size={18} className="text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{doc.name}</p>
                        <p className="text-xs text-slate-500">{formatBytes(doc.size) || 'Belge kaydi'}</p>
                      </div>
                      <a
                        href={getDocumentViewerUrl(doc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-900/20"
                        aria-label="Yeni sekmede ac"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Bu siparişe bağlı belge bulunmuyor.</p>
                )}
              </div>
            </article>

            <article className="rf-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Kayıt Durumu</h2>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                <CheckCircle2 size={14} />
                Aktif takipte
              </div>
            </article>
          </aside>
        </div>
      </main>

      {selectedDocument ? (
        <PDFViewer
          fileUrl={getDocumentViewerUrl(selectedDocument)}
          fileName={selectedDocument.name}
          onClose={() => setSelectedDocument(null)}
        />
      ) : null}
    </div>
  );
}
