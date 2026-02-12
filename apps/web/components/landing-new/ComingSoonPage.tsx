'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Factory,
  Mail,
  ShieldCheck,
  TimerReset,
  TrendingUp,
} from 'lucide-react';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/lib/i18n/client';
import { WaitlistNavbar } from './WaitlistNavbar';

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--rf-border)_84%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_82%,transparent)] px-4 py-3 shadow-[0_18px_30px_-28px_rgba(23,30,52,0.35)] backdrop-blur-sm">
      <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--rf-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-base font-semibold leading-tight text-[var(--rf-text)]">{value}</div>
    </div>
  );
}

export const ComingSoonPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [mounted, setMounted] = useState(false);
  const { locale, isRtl } = useTranslation();

  useEffect(() => {
    setMounted(true);
  }, []);

  const uiLocale = mounted && (locale === 'en' || locale === 'ar') ? locale : 'tr';
  const localeIsRtl = mounted ? isRtl : false;

  const copy = useMemo(
    () => ({
      tr: {
        validation: {
          emailRequired: 'Lütfen e-posta adresinizi girin.',
          emailInvalid: 'Lütfen geçerli bir e-posta adresi girin.',
          genericError: 'Bir hata oluştu.',
          networkError: 'Bağlantı hatası. Lütfen tekrar deneyin.',
          waitlistSuccess: 'Bekleme listesine eklendiniz!',
        },
        badge: 'Currently in Private Beta',
        titleLine1: 'Üretim Hattını',
        titleLine2: 'Kontrol Eden',
        titleAccent: 'Tek Komuta Merkezi.',
        subtitle:
          'RenkFlow, siparişten sevkiyata kadar gerçek üretim akışını tek ekranda yönetir. Darboğazları erken görür, gecikmeleri büyümeden kapatır.',
        placeholder: 'İş e-posta adresiniz',
        cta: 'Erken Erişim Talep Et',
        formSuccess: 'Talebiniz alındı. Lansman öncesi sizinle iletişime geçeceğiz.',
        launchNote: 'Lansman tarihi netleştiğinde bekleme listesindeki ekipleri öncelikli bilgilendireceğiz.',
        launchStatusTitle: 'Lansman Durumu',
        launchStatus: [
          { label: 'Lansman Tarihi', value: 'Henüz net değil' },
          { label: 'Erken Erişim', value: 'Başvurular açık' },
          { label: 'Yayın Kriteri', value: 'Stabilite tamamlandığında' },
        ],
        monitorTitle: 'Hazırlık Monitörü',
        monitorSubtitle: 'Saha doğrulama ve ürün stabilizasyonu',
        metrics: [
          { label: 'Platform Stabilitesi', value: 'İzleniyor', note: 'Kritik akış testleri sürüyor' },
          { label: 'Saha Validasyonu', value: 'Aktif', note: 'Pilot değerlendirmeler devam ediyor' },
          { label: 'Yayın Kararı', value: 'Kriter bazlı', note: 'Tarih kalite eşiğine göre belirlenecek' },
        ],
        stages: [
          { name: 'Planlama', eta: 'Tamamlandı', percent: 100 },
          { name: 'Hat Entegrasyonu', eta: 'Devam ediyor', percent: 72 },
          { name: 'Operatör Eğitimi', eta: 'Takvimleniyor', percent: 46 },
          { name: 'Canlı Geçiş', eta: 'Hazırlanıyor', percent: 28 },
        ],
        notices: [
          { icon: TrendingUp, label: 'Canlı üretim akışı paneli doğrulama aşamasında' },
          { icon: AlertTriangle, label: 'Gecikme uyarı kuralları saha verisiyle kalibre ediliyor' },
          { icon: ShieldCheck, label: 'Yetkilendirme ve veri güvenliği kontrolleri sıkılaştırıldı' },
        ],
        highlights: [
          { icon: Factory, title: 'Çoklu tesis yönetimi' },
          { icon: Clock3, title: 'Gerçek zamanlı gecikme sinyali' },
          { icon: TimerReset, title: 'Standart iş akışı otomasyonu' },
        ],
      },
      en: {
        validation: {
          emailRequired: 'Please enter your email address.',
          emailInvalid: 'Please enter a valid email address.',
          genericError: 'Something went wrong.',
          networkError: 'Network error. Please try again.',
          waitlistSuccess: 'You are on the waitlist!',
        },
        badge: 'Currently in Private Beta',
        titleLine1: 'One Control Tower',
        titleLine2: 'For Your Entire',
        titleAccent: 'Production Flow.',
        subtitle:
          'RenkFlow manages real factory flow from order intake to shipment in one place. Detect bottlenecks early and prevent cascading delays.',
        placeholder: 'Your work email',
        cta: 'Request Early Access',
        formSuccess: "You're on the list. We'll contact you before launch.",
        launchNote: "We'll notify waitlist teams first once the launch window is confirmed.",
        launchStatusTitle: 'Launch Status',
        launchStatus: [
          { label: 'Launch Date', value: 'Not finalized yet' },
          { label: 'Early Access', value: 'Applications open' },
          { label: 'Release Gate', value: 'After stability criteria' },
        ],
        monitorTitle: 'Readiness Monitor',
        monitorSubtitle: 'Field validation and product stabilization',
        metrics: [
          { label: 'Platform Stability', value: 'Monitoring', note: 'Critical flow tests in progress' },
          { label: 'Field Validation', value: 'Active', note: 'Pilot feedback cycle is ongoing' },
          { label: 'Release Decision', value: 'Criteria-based', note: 'Date depends on quality threshold' },
        ],
        stages: [
          { name: 'Planning', eta: 'Completed', percent: 100 },
          { name: 'Line Integration', eta: 'In progress', percent: 72 },
          { name: 'Operator Training', eta: 'Scheduling', percent: 46 },
          { name: 'Go-live Rollout', eta: 'Preparing', percent: 28 },
        ],
        notices: [
          { icon: TrendingUp, label: 'Live production flow module is under validation' },
          { icon: AlertTriangle, label: 'Delay warning rules are being calibrated with field data' },
          { icon: ShieldCheck, label: 'Authorization and data protection checks tightened' },
        ],
        highlights: [
          { icon: Factory, title: 'Multi-site operations' },
          { icon: Clock3, title: 'Real-time delay alerts' },
          { icon: TimerReset, title: 'Standardized flow automation' },
        ],
      },
      ar: {
        validation: {
          emailRequired: 'يرجى إدخال بريدك الإلكتروني.',
          emailInvalid: 'يرجى إدخال بريد إلكتروني صحيح.',
          genericError: 'حدث خطأ غير متوقع.',
          networkError: 'خطأ في الشبكة. حاول مرة أخرى.',
          waitlistSuccess: 'تمت إضافتك إلى قائمة الانتظار.',
        },
        badge: 'Currently in Private Beta',
        titleLine1: 'مركز قيادة واحد',
        titleLine2: 'لكامل تدفق',
        titleAccent: 'الإنتاج لديك.',
        subtitle:
          'يدير RenkFlow تدفق المصنع الحقيقي من الطلب حتى الشحن في شاشة واحدة. اكتشف الاختناقات مبكراً وتجنب تأخير التسليم.',
        placeholder: 'بريد العمل الإلكتروني',
        cta: 'اطلب الوصول المبكر',
        formSuccess: 'تم استلام طلبك. سنتواصل معك قبل الإطلاق.',
        launchNote: 'سنبلغ فرق قائمة الانتظار أولاً فور تأكيد نافذة الإطلاق.',
        launchStatusTitle: 'حالة الإطلاق',
        launchStatus: [
          { label: 'تاريخ الإطلاق', value: 'لم يتحدد بعد' },
          { label: 'الوصول المبكر', value: 'التقديم مفتوح' },
          { label: 'شرط النشر', value: 'بعد اكتمال معايير الاستقرار' },
        ],
        monitorTitle: 'مراقبة الجاهزية',
        monitorSubtitle: 'التحقق الميداني واستقرار المنتج',
        metrics: [
          { label: 'استقرار المنصة', value: 'قيد المتابعة', note: 'اختبارات التدفقات الحرجة مستمرة' },
          { label: 'التحقق الميداني', value: 'نشط', note: 'دورة ملاحظات التشغيل التجريبي مستمرة' },
          { label: 'قرار الإطلاق', value: 'وفق المعايير', note: 'التاريخ يعتمد على عتبة الجودة' },
        ],
        stages: [
          { name: 'التخطيط', eta: 'مكتمل', percent: 100 },
          { name: 'تكامل الخط', eta: 'قيد التنفيذ', percent: 72 },
          { name: 'تدريب المشغلين', eta: 'جارٍ الجدولة', percent: 46 },
          { name: 'الإطلاق التشغيلي', eta: 'قيد التحضير', percent: 28 },
        ],
        notices: [
          { icon: TrendingUp, label: 'وحدة تدفق الإنتاج المباشر قيد التحقق' },
          { icon: AlertTriangle, label: 'قواعد إنذار التأخير تُضبط ببيانات ميدانية' },
          { icon: ShieldCheck, label: 'تم تشديد ضوابط الصلاحيات وحماية البيانات' },
        ],
        highlights: [
          { icon: Factory, title: 'تشغيل متعدد المواقع' },
          { icon: Clock3, title: 'تنبيهات تأخير فورية' },
          { icon: TimerReset, title: 'أتمتة تدفق العمل القياسي' },
        ],
      },
    }),
    []
  );

  const text = copy[uiLocale];

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) {
        toast.error(text.validation.emailRequired);
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error(text.validation.emailInvalid);
        return;
      }
      setStatus('loading');
      try {
        const response = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await response.json();
        if (response.ok) {
          setStatus('success');
          toast.success(data.message || text.validation.waitlistSuccess);
          setEmail('');
        } else {
          setStatus('idle');
          toast.error(data.error || text.validation.genericError);
        }
      } catch {
        setStatus('idle');
        toast.error(text.validation.networkError);
      }
    },
    [email, text.validation]
  );

  return (
    <div className="rf-app-shell relative min-h-[100svh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(45,127,255,0.12),transparent_42%),radial-gradient(circle_at_88%_84%,rgba(182,110,60,0.16),transparent_40%)] dark:bg-[radial-gradient(circle_at_14%_20%,rgba(59,130,246,0.24),transparent_40%),radial-gradient(circle_at_85%_80%,rgba(99,102,241,0.2),transparent_42%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(113,123,147,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(113,123,147,0.14)_1px,transparent_1px)] [background-size:44px_44px] dark:opacity-20" />
        <div className="absolute inset-y-0 left-1/2 hidden w-px bg-gradient-to-b from-transparent via-[color-mix(in_srgb,var(--rf-border)_82%,transparent)] to-transparent lg:block" />
      </div>

      <WaitlistNavbar />

      <main className="relative z-10 px-4 pb-10 pt-28 sm:px-6 lg:pb-16">
        <section className="rf-page-wrap">
          <div
            dir={localeIsRtl ? 'rtl' : 'ltr'}
            className="grid min-h-[calc(100svh-7.5rem)] items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="order-2 lg:order-1"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--rf-border)_86%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_92%,transparent)] px-4 py-2 text-xs font-semibold text-[var(--rf-text-muted)] shadow-[0_16px_30px_-26px_rgba(20,25,38,0.34)] backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {text.badge}
              </div>

              <h1 className="mt-6 text-balance text-[clamp(2.3rem,4.8vw,5rem)] font-black leading-[0.95] tracking-[-0.03em] text-[var(--rf-text)]">
                <span className="block">{text.titleLine1}</span>
                <span className="block">{text.titleLine2}</span>
                <span className="block bg-gradient-to-r from-[#2462ff] via-[#4b7bff] to-[#8f5eff] bg-clip-text text-transparent">
                  {text.titleAccent}
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-[color-mix(in_srgb,var(--rf-text-muted)_88%,#8a8f9f)] sm:text-lg">
                {text.subtitle}
              </p>

              <div className="mt-7">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--rf-text-muted)]">
                  {text.launchStatusTitle}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {text.launchStatus.map((statusItem) => (
                    <StatusCard key={statusItem.label} label={statusItem.label} value={statusItem.value} />
                  ))}
                </div>
              </div>

              <div id="waitlist" className="mt-6 max-w-2xl">
                <div className="rounded-2xl border border-[color-mix(in_srgb,var(--rf-border)_86%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_94%,transparent)] p-2 shadow-[0_22px_42px_-30px_rgba(20,30,57,0.42)] backdrop-blur-md">
                  <AnimatePresence mode="wait">
                    {status === 'success' ? (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                      >
                        <CheckCircle2 size={18} />
                        {text.formSuccess}
                      </motion.div>
                    ) : (
                      <motion.form
                        key="form"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onSubmit={handleSubmit}
                        className="flex flex-col gap-2 sm:flex-row"
                      >
                        <div className="relative flex-1">
                          <Mail
                            size={17}
                            className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--rf-text-muted)]"
                            style={localeIsRtl ? { right: '0.875rem' } : { left: '0.875rem' }}
                          />
                          <Input
                            type="email"
                            placeholder={text.placeholder}
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            disabled={status === 'loading'}
                            className={`h-12 rounded-xl border-none bg-transparent text-sm text-[var(--rf-text)] shadow-none focus-visible:ring-0 ${localeIsRtl ? 'pr-10 pl-3 text-right' : 'pl-10 pr-3 text-left'}`}
                          />
                        </div>
                        <Button
                          type="submit"
                          disabled={status === 'loading'}
                          className="h-12 min-w-[210px] rounded-xl bg-gradient-to-r from-[#245dff] to-[#5f7dff] text-sm font-semibold text-white shadow-[0_18px_24px_-18px_rgba(46,94,255,0.8)] transition hover:brightness-105"
                        >
                          {status === 'loading' ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          ) : (
                            <>
                              <span>{text.cta}</span>
                              {localeIsRtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                            </>
                          )}
                        </Button>
                      </motion.form>
                    )}
                  </AnimatePresence>
                </div>
                <p className="mt-3 text-xs text-[var(--rf-text-muted)]">{text.launchNote}</p>
              </div>

              <div className="mt-6 grid gap-2 text-sm text-[var(--rf-text-muted)] sm:grid-cols-3">
                {text.highlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--rf-border)_84%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_84%,transparent)] px-3 py-2.5"
                    >
                      <Icon size={15} className="text-[var(--rf-accent)]" />
                      <span>{item.title}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="order-1 lg:order-2"
            >
              <div className="rounded-[26px] border border-[color-mix(in_srgb,var(--rf-border)_82%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_90%,transparent)] p-5 shadow-[0_30px_60px_-36px_rgba(27,35,58,0.52)] backdrop-blur-md sm:p-6">
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--rf-text-muted)]">
                    {text.monitorTitle}
                  </p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--rf-text)] sm:text-2xl">
                    {text.monitorSubtitle}
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {text.metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-2xl border border-[color-mix(in_srgb,var(--rf-border)_84%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface-soft)_74%,transparent)] p-3"
                    >
                      <p className="text-xs text-[var(--rf-text-muted)]">{metric.label}</p>
                      <p className="mt-2 text-lg font-bold text-[var(--rf-text)]">{metric.value}</p>
                      <p className="mt-1 text-xs font-medium text-[var(--rf-text-muted)]">{metric.note}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-3 rounded-2xl border border-[color-mix(in_srgb,var(--rf-border)_84%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface-soft)_70%,transparent)] p-4">
                  {text.stages.map((stage) => (
                    <div key={stage.name}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-[var(--rf-text)]">{stage.name}</span>
                        <span className="text-xs text-[var(--rf-text-muted)]">{stage.eta}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[color-mix(in_srgb,var(--rf-border)_65%,transparent)]">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-[#2b66ff] via-[#4b7dff] to-[#87a5ff]"
                          style={{ width: `${stage.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-2">
                  {text.notices.map((notice) => {
                    const Icon = notice.icon;
                    return (
                      <div
                        key={notice.label}
                        className="flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--rf-border)_78%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface-soft)_64%,transparent)] px-3 py-2.5 text-sm text-[var(--rf-text-muted)]"
                      >
                        <Icon size={15} className="text-[var(--rf-accent)]" />
                        <span>{notice.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.aside>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[color-mix(in_srgb,var(--rf-border)_82%,transparent)] bg-[color-mix(in_srgb,var(--rf-surface)_86%,transparent)] backdrop-blur-sm">
        <div className="rf-page-wrap flex flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-[var(--rf-text-muted)] sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} RenkFlow Teknoloji A.Ş.</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-[var(--rf-text)]">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-[var(--rf-text)]">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
