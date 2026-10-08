'use client';
import { RecordPanel } from '@/components/records/RecordDrawer';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppleNavbar } from '@/components/layout/AppleNavbar';
import { RFFormView } from '@/components/shared/views/RFFormView';
import { Chatter } from '@/components/shared/ui/Chatter';
import { useToast } from '@/lib/context/ToastContext';
import { Building2, Phone, Mail, MapPin, FileText, ShoppingBag, CreditCard, Clock } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCustomer = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/customers/${customerId}`);
      if (!res.ok) throw new Error('Müşteri yüklenemedi');
      const data = await res.json();
      setCustomer(data.customer);
    } catch (err) {
      showToast('Müşteri bulunamadı veya yüklenemedi.', 'error');
      router.push('/crm');
    } finally {
      setIsLoading(false);
    }
  }, [customerId, router, showToast]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
        <AppleNavbar title="Müşteri Detayı" showSearch={false} />
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-6xl mx-auto h-[400px] rounded-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-6 animate-pulse" />
        </main>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50/50 dark:bg-neutral-950/80">
      <AppleNavbar title={customer.full_name} showSearch={false} />
      
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto h-full">
          <RFFormView
            title={customer.full_name}
            subtitle={customer.company_name || 'Bireysel Müşteri'}
            backUrl="/crm"
            aside={<RecordPanel type="customer" id={customerId} fallback={<Chatter entityType="customer" entityId={customerId} />} />}
          >
            <div className="space-y-6">
              {/* Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Contact Info */}
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Phone size={16} className="text-primary" />
                    İletişim Bilgileri
                  </h3>
                  <div className="space-y-3">
                    {customer.email && (
                      <div className="flex items-start gap-3">
                        <Mail size={14} className="mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">E-posta</p>
                          <p className="text-sm font-medium text-foreground">{customer.email}</p>
                        </div>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-start gap-3">
                        <Phone size={14} className="mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Telefon</p>
                          <p className="text-sm font-medium text-foreground">{customer.phone}</p>
                        </div>
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-start gap-3">
                        <MapPin size={14} className="mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Adres</p>
                          <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{customer.address}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Info */}
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <CreditCard size={16} className="text-emerald-500" />
                    Ticari Bilgiler
                  </h3>
                  <div className="space-y-3">
                    {customer.tax_number && (
                      <div className="flex items-start gap-3">
                        <FileText size={14} className="mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Vergi No / Dairesi</p>
                          <p className="text-sm font-medium text-foreground">
                            {customer.tax_number} {customer.tax_office && `(${customer.tax_office})`}
                          </p>
                        </div>
                      </div>
                    )}
                    {customer.credit_limit && (
                      <div className="flex items-start gap-3">
                        <CreditCard size={14} className="mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Kredi Limiti</p>
                          <p className="text-sm font-medium text-foreground">{formatCurrency(customer.credit_limit, 'TRY')}</p>
                        </div>
                      </div>
                    )}
                    {customer.payment_terms && (
                      <div className="flex items-start gap-3">
                        <Clock size={14} className="mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Ödeme Vadesi (Gün)</p>
                          <p className="text-sm font-medium text-foreground">{customer.payment_terms}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Notes */}
              {customer.notes && (
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <FileText size={16} className="text-amber-500" />
                    Müşteri Notları
                  </h3>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{customer.notes}</p>
                </div>
              )}
            </div>
          </RFFormView>
        </div>
      </main>
    </div>
  );
}
