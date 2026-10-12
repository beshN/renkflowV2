'use client';
import { AwningDialog } from '@/components/features/awning/AwningConfigurator';
import type { AwningConfiguration } from '@/lib/features/awning/configuration';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, FileText, Package, Truck, Edit2, MoreHorizontal,
  Calendar, User, DollarSign, Tag, ClipboardList, Building2,
  Phone, Mail, Palette, Maximize2, LayoutGrid, MessageSquare, 
  ChevronDown, CheckCircle2, AlertTriangle, Clock, Wallet
} from 'lucide-react';

import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { StatusStepper, StatusBadge, ORDER_STATUS_STEPS, LEGACY_STATUS_MAP } from '@/components/shared/ui/StatusStepper';
import { HealthBadge, HintTip, LifecycleStrip } from '@/components/kit';
import { orderHealth } from '@/lib/features/orders/lifecycle';
import { Lock } from 'lucide-react';
import { businessDate } from '@/lib/features/orders/workspace';
import { Chatter } from '@/components/shared/ui/Chatter';
import { RecordButton, RecordPanel } from '@/components/records/RecordDrawer';
import { OrderSalesPanel } from '@/components/sales/OrderSalesPanel';
import { OrderChainPanel } from '@/components/field/OrderChainPanel';
import { OrderBillingPanel } from '@/components/finance/OrderBillingPanel';
import { Receipt, Wrench } from 'lucide-react';
import { ORDER_TRANSITIONS, transitionNeedsReason } from '@/lib/features/orders/transition-rules';
import { useAuth } from '@/lib/context/AuthContext';
import { canAccessFinance, hasPermission } from '@/lib/auth/permissions';
import { requestJson } from '@/lib/shared/network';
import { ColorChip } from '@/components/colors/ColorSwatch';
import { colorKey } from '@/lib/features/colors/color-spec';
import { useToast } from '@/lib/context/ToastContext';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { CopyChip } from '@/components/spells/CopyChip';

type PdfViewerProps = { fileUrl: string; fileName: string; onClose?: () => void };
const PDFViewer = dynamic<PdfViewerProps>(() => import('@/components/pdf-viewer/PDFViewerV2').then((m) => m.default), { ssr: false });

// ============================================
// Types
// ============================================

interface OrderDetail {
  version?: number;
  productionManaged?: boolean;
  financialHidden?: boolean;
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
    awningConfiguration?: AwningConfiguration;
    awningPreview?: string;
    projectionMm?: number;
    mountingHeightMm?: number;
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
  const { user } = useAuth();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionRetry = useRef<{key:string;commandId:string} | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'items' | 'sales' | 'billing' | 'chain' | 'documents' | 'activity'>('info');
  const [reasonFor, setReasonFor] = useState<{ status: string; note: string } | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  const loadOrder = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError('');
    const result = await requestJson<{ success: boolean; data: OrderDetail }>(`/api/v1/orders/${orderId}`, { signal, cache: 'no-store' }, { timeoutMs: 20000, fallbackError: 'Sipariş yüklenemedi.' });
    if (signal?.aborted) return;
    setNotFound(result.status === 404);
    if (result.ok && result.data?.data) setOrder(result.data.data);
    else setLoadError(result.error || 'Sipariş yüklenemedi.');
    setIsLoading(false);
  }, [orderId, user?.id, user?.tenantId, user?.role]);

  useEffect(() => { const controller = new AbortController(); void loadOrder(controller.signal); return () => controller.abort(); }, [loadOrder]);

  const handleStatusTransition = async (newStatus: string, note = '') => {
    if (!order || isTransitioning) return;
    // Stopping, cancelling or sending work back needs a written reason (the server enforces it too).
    if (transitionNeedsReason(order.status, newStatus) && note.trim().length < 3) { setReasonFor({ status: newStatus, note: '' }); return; }
    setReasonFor(null);
    setIsTransitioning(true);
    const key = JSON.stringify([orderId, order.version, newStatus]);
    const commandId = transitionRetry.current?.key === key ? transitionRetry.current.commandId : crypto.randomUUID();
    transitionRetry.current = {key, commandId};
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus, version: order.version, commandId, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Durum güncellenemedi');
      
      transitionRetry.current = null;
      setOrder((prev) => prev ? { ...prev, status: newStatus, version: data.version } : null);
      showToast(`Sipariş durumu "${ORDER_STATUS_STEPS.find(s => s.key === newStatus)?.label || newStatus}" olarak güncellendi.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Durum güncellenemedi', 'error');
    } finally {
      setIsTransitioning(false);
    }
  };

  const normalizedStatus = order ? (LEGACY_STATUS_MAP[order.status] || order.status) : 'new';

  // Allowed next transitions: the same map the server enforces.
  const allowedTransitions = order?.productionManaged ? [] : ORDER_TRANSITIONS[normalizedStatus] || [];

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950">
        <AppleNavbar title="Sipariş Detayı" />
        <main className="flex-1 p-6 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {[1,2,3].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950">
        <AppleNavbar title={notFound ? "Sipariş bulunamadı" : "Sipariş yüklenemedi"} />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertTriangle size={28} className="mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground">{notFound ? "Sipariş bulunamadı" : "Sipariş yüklenemedi"}</h2>
            <p role="alert" className="text-sm text-muted-foreground">{loadError}</p>
            {!notFound && <button type="button" onClick={() => loadOrder()} className="rf-primary-button px-4 py-2 text-sm">Tekrar dene</button>}
            <Link href="/orders" className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">
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
          <div className="rf-panel border border-border p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
              <div>
                <h1 className="group flex items-center gap-1.5 text-2xl font-bold tracking-tight text-foreground">
                  Sipariş #{order.orderNumber}
                  <CopyChip value={order.orderNumber} label="Sipariş numarasını" className="h-7 w-7 [&_svg]:h-3.5 [&_svg]:w-3.5" />
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[order.customerName, order.customerCompany, formatDate(order.createdAt)].filter(Boolean).join(' · ')}
                </p>
                <span className="mt-2 flex items-center gap-2"><HealthBadge health={orderHealth(order, businessDate())} />{!order.financialHidden && <RecordButton type="order" id={orderId} label="Kayıt" />}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right" hidden={order.financialHidden}>
                  <p className="text-xs text-muted-foreground">Toplam Tutar</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </p>
                </div>
              </div>
            </div>

            <LifecycleStrip status={order.status} className="mb-5" />
            {order.productionManaged && <p className="flex items-center gap-2 rounded-md border border-border bg-accent px-4 py-2 text-xs text-muted-foreground"><Lock size={14} aria-hidden /> Üretimden güncellenir <HintTip text="Bu siparişin durumu üretim ve sevkiyat işlemlerinden hesaplanır; elle değiştirilemez." /><Link href={user?.role === 'worker' ? '/factory' : '/production'} className="ml-auto font-medium text-primary hover:underline">Operasyon</Link></p>}
            {/* Status Stepper */}
            <div className="overflow-x-auto pb-2">
              <StatusStepper
                steps={ORDER_STATUS_STEPS}
                currentStatus={order.status}
                onTransition={!order.productionManaged && user && hasPermission(user.role, 'orders.edit') ? handleStatusTransition : undefined}
                isTransitioning={isTransitioning}
                allowedTransitions={allowedTransitions}
              />
            </div>
            {!order.productionManaged && user && hasPermission(user.role, 'orders.edit') && !reasonFor && allowedTransitions.some((t) => t === 'on_hold' || t === 'cancelled') && (
              <div className="mt-2 flex justify-end gap-2">
                {allowedTransitions.includes('on_hold') && <button type="button" disabled={isTransitioning} className="rf-input text-xs" onClick={() => void handleStatusTransition('on_hold')}>Beklet</button>}
                {allowedTransitions.includes('cancelled') && <button type="button" disabled={isTransitioning} className="rf-input text-xs text-rose-700 dark:text-rose-300" onClick={() => void handleStatusTransition('cancelled')}>İptal et</button>}
              </div>
            )}
            {reasonFor && (
              <form className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-600/35 p-3" onSubmit={(e) => { e.preventDefault(); void handleStatusTransition(reasonFor.status, reasonFor.note); }}>
                <span className="text-xs font-medium">{ORDER_STATUS_STEPS.find((s) => s.key === reasonFor.status)?.label ?? reasonFor.status}: gerekçe</span>
                <input autoFocus required minLength={3} aria-label="Gerekçe" className="rf-input min-w-0 flex-1" value={reasonFor.note} onChange={(e) => setReasonFor({ ...reasonFor, note: e.target.value })} />
                <button disabled={isTransitioning || reasonFor.note.trim().length < 3} className="rf-primary-button">Onayla</button>
                <button type="button" className="rf-input" onClick={() => setReasonFor(null)}>Vazgeç</button>
              </form>
            )}
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">

            {/* Left: Details */}
            <div className="lg:col-span-2 space-y-6">

              {/* Tabs */}
              <div className="flex gap-1 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 p-1">
                {[
                  { key: 'info', label: 'Bilgiler', icon: ClipboardList },
                  { key: 'items', label: 'Ürün Satırları', icon: Package },
                  { key: 'sales', label: 'Teslim & ödeme', icon: Wallet },
                  { key: 'billing', label: 'Fatura & tahsilat', icon: Receipt },
                  { key: 'chain', label: 'Montaj & servis', icon: Wrench },
                  { key: 'documents', label: 'Dosyalar', icon: FileText },
                  { key: 'activity', label: 'Aktivite', icon: MessageSquare },
                ].filter(tab => !order.financialHidden || !['sales','documents','activity'].includes(tab.key)).filter(tab => tab.key !== 'billing' || Boolean(user && canAccessFinance(user.role) && !order.financialHidden)).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    aria-label={label}
                    aria-pressed={activeTab === key}
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
                <div className="rf-panel border border-border p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Sipariş Bilgileri</h3>
                  <div className="space-y-0">
                    {!order.financialHidden && <>
                      <InfoRow icon={User} label="Müşteri" value={
                        <span>{order.customerName}{order.customerCompany && <span className="text-muted-foreground"> · {order.customerCompany}</span>}</span>
                      } />
                      <InfoRow icon={Phone} label="Telefon" value={order.phone} />
                      <InfoRow icon={Mail} label="E-posta" value={order.email} />
                    </>}
                    <InfoRow icon={Package} label="Ürün" value={order.productName} />
                    <InfoRow icon={Tag} label="Adet" value={order.quantity ? `${order.quantity} adet` : null} />
                    <InfoRow icon={Palette} label="Renk" value={(() => {
                      // The order's colours are its lines' colours (the order-level field is not filled).
                      const colors = [order.color, ...(order.items ?? []).map((i: { color?: string | null }) => i.color)].filter((c): c is string => Boolean(c && c.trim()));
                      const distinct = colors.filter((c, i) => colors.findIndex((x) => colorKey(x) === colorKey(c)) === i);
                      return distinct.length ? <span className="flex flex-wrap gap-x-3 gap-y-1">{distinct.map((c) => <ColorChip key={c} color={c} size={18} showName />)}</span> : null;
                    })()} />
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
                          order.deliveryDate < businessDate() &&
                          !['completed', 'shipped', 'delivered'].includes(normalizedStatus)
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : ''
                        )}>
                          {formatDate(order.deliveryDate)}
                          {order.deliveryDate < businessDate() &&
                           !['completed', 'shipped', 'delivered'].includes(normalizedStatus) &&
                           ' · Termin geçti'}
                        </span>
                      ) : null
                    } />
                    <InfoRow icon={DollarSign} label="Ödeme Durumu" value={
                      order.paymentStatus === 'paid' ? 'Ödendi' :
                      order.paymentStatus === 'partial' ? 'Kısmi ödeme' : 'Ödeme bekleniyor'
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
                <div className="rf-panel border border-border p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Ürün Satırları</h3>
                  {(!order.items || order.items.length === 0) ? (
                    <div className="py-8 text-center">
                      <Package size={32} className="mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">Bu siparişe ait ürün satırı yok.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {order.items.map((item, idx) => (
                        <div key={item.id} className="flex items-start justify-between gap-3 p-3 rounded-md border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{item.productName}</p>
                              <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {item.quantity && <span>{item.quantity} adet</span>}
                                {item.color && <span className="inline-flex items-center gap-1">· <ColorChip color={item.color} size={16} /></span>}
                                {(item.widthMm || item.heightMm) && <span>· {item.widthMm}×{item.heightMm} mm</span>}
                                {item.awningConfiguration && <AwningDialog configuration={item.awningConfiguration} previewImage={item.awningPreview} readOnly label="3D görünüm"/>}
                              </div>
                              {item.notes && <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0" hidden={order.financialHidden}>
                            <p className="text-sm font-bold text-foreground">{formatCurrency(item.totalPrice, order.currency)}</p>
                            {item.unitPrice && <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice, order.currency)}/adet</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'sales' && !order.financialHidden && (
                <OrderSalesPanel
                  orderId={orderId}
                  canEdit={Boolean(user && hasPermission(user.role, 'orders.edit'))}
                  canPlan={Boolean(user && (hasPermission(user.role, 'orders.edit') || user.role === 'accountant'))}
                  onOrderChanged={() => void loadOrder()}
                />
              )}

              {activeTab === 'billing' && user && canAccessFinance(user.role) && !order.financialHidden && <OrderBillingPanel orderId={orderId} />}

              {activeTab === 'chain' && <OrderChainPanel orderId={orderId} />}

              {activeTab === 'documents' && !order.financialHidden && (
                <div className="rf-panel border border-border p-6 shadow-sm">
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
                          className="w-full flex items-center gap-3 p-3 rounded-md border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
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

              {activeTab === 'activity' && !order.financialHidden && (
                <RecordPanel type="order" id={orderId} fallback={<Chatter entityType="order" entityId={orderId} maxHeight="600px" />} />
              )}
            </div>

            {/* Right: Summary */}
            <div className="space-y-4">
              {/* Quick Stats */}
              <div className="rf-panel border border-border p-5 shadow-sm">
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
                  <div className={order.financialHidden ? 'hidden' : 'flex items-center justify-between'}>
                    <span className="text-sm text-muted-foreground">Para Birimi</span>
                    <span className="text-sm font-medium text-foreground">{order.currency}</span>
                  </div>
                  <div className={order.financialHidden ? 'hidden' : 'border-t border-neutral-100 dark:border-neutral-800 pt-3 flex items-center justify-between'}>
                    <span className="text-sm font-semibold text-foreground">Toplam</span>
                    <span className="text-lg font-bold text-foreground">{formatCurrency(order.totalAmount, order.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="rf-panel border border-border p-5 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Hızlı İşlemler</h3>
                <div className="space-y-2">
                  {!order.financialHidden && <Link
                    href={`/orders/${orderId}/invoice`}
                    className="flex items-center gap-2 w-full rounded-md border border-neutral-200 dark:border-neutral-700 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                  >
                    <FileText size={15} className="text-primary" />
                    Sipariş dökümünü yazdır
                  </Link>}
                  <Link
                    href={`/work-orders?orderId=${orderId}`}
                    className="flex items-center gap-2 w-full rounded-md border border-neutral-200 dark:border-neutral-700 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
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
