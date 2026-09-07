'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, FileText, Package, Truck, Edit2, MoreHorizontal,
  Calendar, User, DollarSign, Tag, ClipboardList, Building2,
  Phone, Mail, Palette, Maximize2, LayoutGrid, MessageSquare, 
  ChevronDown, CheckCircle2, AlertTriangle, Clock
} from 'lucide-react';

import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { StatusStepper, StatusBadge, ORDER_STATUS_STEPS, LEGACY_STATUS_MAP } from '@/components/shared/ui/StatusStepper';
import { Chatter } from '@/components/shared/ui/Chatter';
import { useToast } from '@/lib/context/ToastContext';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

type PdfViewerProps = { fileUrl: string; fileName: string; onClose?: () => void };
const PDFViewer = dynamic<PdfViewerProps>(() => import('@/components/pdf-viewer/PDFViewerV2').then((m) => m.default), { ssr: false });

// ============================================
// Types
// ============================================

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  customerName: string;
  customerCompany?: string;
  email?: string;
  phone?: string;
  productName?: string;
  quantity?: number;
  totalAmount: number;
  currency: string;
  deliveryDate?: string;
  notes?: string;
  specialNotes?: string;
  color?: string;
  widthMm?: number;
  heightMm?: number;
  motorType?: string;
  ledType?: string;
  fabricType?: string;
  paymentStatus?: string;
  shipmentStatus?: string;
  createdAt: string;
  updatedAt: string;
  items?: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    color?: string;
    widthMm?: number;
    heightMm?: number;
    notes?: string;
  }>;
  documents?: Array<{
    id: string;
    name: string;
    fileType?: string;
    size?: number;
    createdAt: string;
  }>;
}

// ============================================
// Info Row
// ============================================

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-neutral-100 dark:border-neutral-800/60 last:border-0">
      <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
        <Icon size={13} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
        <div className="text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}

// ============================================
// Priority Badge
// ============================================

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Düşük', color: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' },
  medium: { label: 'Normal', color: 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400' },
  high: { label: 'Yüksek', color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  urgent: { label: 'Acil!', color: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400' },
};

// ============================================
// Main Page
// ============================================

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'items' | 'documents' | 'activity'>('info');
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  const loadOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) throw new Error('Sipariş yüklenemedi');
      const data = await res.json();
      setOrder(data.order || data);
    } catch (err) {
      showToast('Sipariş yüklenemedi', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  const handleStatusTransition = async (newStatus: string) => {
    if (!order || isTransitioning) return;
    setIsTransitioning(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Durum güncellenemedi');
      
      setOrder((prev) => prev ? { ...prev, status: newStatus } : null);
      showToast(`Sipariş durumu "${ORDER_STATUS_STEPS.find(s => s.key === newStatus)?.label || newStatus}" olarak güncellendi.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Durum güncellenemedi', 'error');
    } finally {
      setIsTransitioning(false);
    }
  };

  const normalizedStatus = order ? (LEGACY_STATUS_MAP[order.status] || order.status) : 'new';

  // Allowed next transitions
  const VALID_TRANSITIONS: Record<string, string[]> = {
    new: ['pending_approval', 'approved'],
    pending: ['pending_approval', 'approved'],
    pending_approval: ['approved', 'cancelled'],
    approved: ['preparing_materials', 'cancelled'],
    preparing_materials: ['ready_for_production'],
    ready_for_production: ['in_production'],
    in_production: ['quality_check', 'ready_for_shipment'],
    quality_check: ['ready_for_shipment', 'in_production'],
    ready_for_shipment: ['shipped'],
    shipped: ['completed'],
    delivered: ['completed'],
    on_hold: ['approved', 'preparing_materials', 'in_production'],
  };
  const allowedTransitions = VALID_TRANSITIONS[normalizedStatus] || [];

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950">
        <AppleNavbar title="Sipariş Detayı" />
        <main className="flex-1 p-6 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {[1,2,3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950">
        <AppleNavbar title="Sipariş Bulunamadı" />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-4xl">🔍</div>
            <h2 className="text-xl font-bold text-foreground">Sipariş Bulunamadı</h2>
            <p className="text-muted-foreground">Bu sipariş mevcut değil veya erişim izniniz yok.</p>
            <Link href="/orders" className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">
              Siparişlere Dön
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const priorityConf = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG.medium;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
      <AppleNavbar title={`Sipariş #${order.orderNumber}`} showSearch={false} />

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Breadcrumb + Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/orders"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              Siparişlere Dön
            </Link>
            <div className="flex items-center gap-2">
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', priorityConf.color)}>
                {priorityConf.label}
              </span>
              <StatusBadge status={order.status} />
            </div>
          </div>

          {/* Order Header Card */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Sipariş #{order.orderNumber}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {order.customerName}
                  {order.customerCompany && ` · ${order.customerCompany}`}
                  {' · '}
                  {formatDate(order.createdAt)} tarihinde oluşturuldu
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Toplam Tutar</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </p>
                </div>
              </div>
            </div>

            {/* Status Stepper */}
            <div className="overflow-x-auto pb-2">
              <StatusStepper
                steps={ORDER_STATUS_STEPS}
                currentStatus={order.status}
                onTransition={handleStatusTransition}
                isTransitioning={isTransitioning}
                allowedTransitions={allowedTransitions}
              />
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">

            {/* Left: Details */}
            <div className="lg:col-span-2 space-y-6">

              {/* Tabs */}
              <div className="flex gap-1 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 p-1">
                {[
                  { key: 'info', label: 'Bilgiler', icon: ClipboardList },
                  { key: 'items', label: 'Ürün Satırları', icon: Package },
                  { key: 'documents', label: 'Dosyalar', icon: FileText },
                  { key: 'activity', label: 'Aktivite', icon: MessageSquare },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key as any)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
                      activeTab === key
                        ? 'bg-white dark:bg-neutral-950 text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon size={13} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'info' && (
                <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Sipariş Bilgileri</h3>
                  <div className="space-y-0">
                    <InfoRow icon={User} label="Müşteri" value={
                      <span>{order.customerName}{order.customerCompany && <span className="text-muted-foreground"> · {order.customerCompany}</span>}</span>
                    } />
                    <InfoRow icon={Phone} label="Telefon" value={order.phone} />
                    <InfoRow icon={Mail} label="E-posta" value={order.email} />
                    <InfoRow icon={Package} label="Ürün" value={order.productName} />
                    <InfoRow icon={Tag} label="Adet" value={order.quantity ? `${order.quantity} adet` : null} />
                    <InfoRow icon={Palette} label="Renk" value={order.color} />
                    {(order.widthMm || order.heightMm) && (
                      <InfoRow icon={Maximize2} label="Ölçüler" value={
                        `${order.widthMm || '?'} × ${order.heightMm || '?'} mm`
                      } />
                    )}
                    <InfoRow icon={LayoutGrid} label="Motor Tipi" value={order.motorType} />
                    <InfoRow icon={LayoutGrid} label="LED Tipi" value={order.ledType} />
                    <InfoRow icon={LayoutGrid} label="Kumaş Tipi" value={order.fabricType} />
                    <InfoRow icon={Calendar} label="Teslim Tarihi" value={
                      order.deliveryDate ? (
                        <span className={cn(
                          new Date(order.deliveryDate) < new Date() &&
                          !['completed', 'shipped', 'delivered'].includes(normalizedStatus)
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : ''
                        )}>
                          {formatDate(order.deliveryDate)}
                          {new Date(order.deliveryDate) < new Date() &&
                           !['completed', 'shipped', 'delivered'].includes(normalizedStatus) &&
                           ' ⚠️ Gecikmiş'}
                        </span>
                      ) : null
                    } />
                    <InfoRow icon={DollarSign} label="Ödeme Durumu" value={
                      order.paymentStatus === 'paid' ? '✅ Ödendi' :
                      order.paymentStatus === 'partial' ? '🟡 Kısmi Ödeme' : '⏳ Ödeme Bekleniyor'
                    } />
                    {order.notes && (
                      <InfoRow icon={ClipboardList} label="Notlar" value={
                        <span className="whitespace-pre-wrap">{order.notes}</span>
                      } />
                    )}
                    {order.specialNotes && (
                      <InfoRow icon={AlertTriangle} label="Teknik Notlar" value={
                        <span className="whitespace-pre-wrap text-amber-700 dark:text-amber-400">{order.specialNotes}</span>
                      } />
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'items' && (
                <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Ürün Satırları</h3>
                  {(!order.items || order.items.length === 0) ? (
                    <div className="py-8 text-center">
                      <Package size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">Bu siparişe ait ürün satırı yok.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {order.items.map((item, idx) => (
                        <div key={item.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{item.productName}</p>
                              <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {item.quantity && <span>{item.quantity} adet</span>}
                                {item.color && <span>· {item.color}</span>}
                                {(item.widthMm || item.heightMm) && <span>· {item.widthMm}×{item.heightMm} mm</span>}
                              </div>
                              {item.notes && <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-foreground">{formatCurrency(item.totalPrice, order.currency)}</p>
                            {item.unitPrice && <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice, order.currency)}/adet</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Dosyalar ve Belgeler</h3>
                  {(!order.documents || order.documents.length === 0) ? (
                    <div className="py-8 text-center">
                      <FileText size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">Bu siparişe ait dosya yok.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {order.documents.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => setSelectedDocument(doc)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                            <FileText size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'activity' && (
                <Chatter
                  entityType="order"
                  entityId={orderId}
                  maxHeight="600px"
                />
              )}
            </div>

            {/* Right: Summary */}
            <div className="space-y-4">
              {/* Quick Stats */}
              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Özet</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Sipariş No</span>
                    <span className="text-sm font-bold text-foreground">#{order.orderNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Durum</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Teslim</span>
                    <span className="text-sm font-medium text-foreground">
                      {order.deliveryDate ? formatDate(order.deliveryDate) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Para Birimi</span>
                    <span className="text-sm font-medium text-foreground">{order.currency}</span>
                  </div>
                  <div className="border-t border-neutral-100 dark:border-neutral-800 pt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">Toplam</span>
                    <span className="text-lg font-bold text-foreground">{formatCurrency(order.totalAmount, order.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Hızlı İşlemler</h3>
                <div className="space-y-2">
                  <Link
                    href={`/orders/${orderId}/invoice`}
                    className="flex items-center gap-2 w-full rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                  >
                    <FileText size={15} className="text-primary" />
                    Fatura / Teklif Görüntüle
                  </Link>
                  <Link
                    href={`/work-orders?orderId=${orderId}`}
                    className="flex items-center gap-2 w-full rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                  >
                    <ClipboardList size={15} className="text-primary" />
                    İş Emirlerini Görüntüle
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* PDF Viewer Modal */}
      {selectedDocument && (
        <PDFViewer
          fileUrl={`/api/orders/documents/${selectedDocument.id}/content`}
          fileName={selectedDocument.name}
          onClose={() => setSelectedDocument(null)}
        />
      )}
    </div>
  );
}
