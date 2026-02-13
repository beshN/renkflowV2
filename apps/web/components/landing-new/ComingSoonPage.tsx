'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { ArrowRight, CheckCircle2, Factory, Mail, ShieldCheck, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { WaitlistNavbar } from './WaitlistNavbar';
import { DashboardPreview } from './DashboardPreview';
import { useTranslation } from '@/lib/i18n/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const COPY = {
  tr: {
    badge: 'Private Beta Doğrulama Sürecinde',
    title: 'RenkFlow üretim operasyonları için hazırlanıyor.',
    description:
      'Pilot saha doğrulamaları devam ediyor. Ürün erişimi kademeli açılacak. Erken erişim listesine katılarak bilgilendirilen ilk ekiplerden olun.',
    emailPlaceholder: 'İş e-posta adresiniz',
    submit: 'Erken Erişim Talep Et',
    success: 'Talebiniz alındı. Uygun olduğunda ekibimiz sizinle iletişime geçecek.',
    invalid: 'Lütfen geçerli bir e-posta adresi girin.',
    error: 'Talep gönderilemedi. Lütfen tekrar deneyin.',
    highlights: ['Canlı üretim akış görünürlüğü', 'Gecikme erken uyarı kuralları', 'Tenant bazlı veri izolasyonu'],
    footer: 'Üretim erişim talepleri için: info@renkflow.com',
    login: 'Giriş Sayfası',
  },
  en: {
    badge: 'Private Beta Validation in Progress',
    title: 'RenkFlow is preparing for production teams.',
    description:
      'Field pilots are currently running. Access will be opened in phases. Join the early access list to be notified first.',
    emailPlaceholder: 'Your work email',
    submit: 'Request Early Access',
    success: 'Request received. Our team will contact you when a slot is available.',
    invalid: 'Please enter a valid email address.',
    error: 'Unable to submit request. Please try again.',
    highlights: ['Live production flow visibility', 'Delay early warning rules', 'Tenant-level data isolation'],
    footer: 'For production access requests: info@renkflow.com',
    login: 'Login Page',
  },
  ar: {
    badge: 'التحقق من النسخة التجريبية الخاصة قيد التنفيذ',
    title: 'RenkFlow يستعد لفرق الإنتاج.',
    description:
      'تجارب التشغيل الميدانية مستمرة حالياً. سيتم فتح الوصول على مراحل. انضم لقائمة الوصول المبكر ليتم إشعارك أولاً.',
    emailPlaceholder: 'بريد العمل الإلكتروني',
    submit: 'طلب وصول مبكر',
    success: 'تم استلام الطلب. سيتواصل فريقنا معك عند توفر مقعد.',
    invalid: 'يرجى إدخال بريد إلكتروني صالح.',
    error: 'تعذر إرسال الطلب. حاول مرة أخرى.',
    highlights: ['رؤية مباشرة لتدفق الإنتاج', 'قواعد إنذار مبكر للتأخير', 'عزل بيانات على مستوى المستأجر'],
    footer: 'لطلبات وصول الإنتاج: info@renkflow.com',
    login: 'صفحة تسجيل الدخول',
  },
} as const;

export const ComingSoonPage: React.FC = () => {
  const { locale, isRtl } = useTranslation();
  const { resolvedTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const isDark = resolvedTheme === 'dark';

  const text = useMemo(() => COPY[(locale as keyof typeof COPY) || 'tr'] ?? COPY.tr, [locale]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setStatus('error');
      toast.error(text.invalid);
      return;
    }

    setStatus('loading');
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized }),
      });

      if (!response.ok) {
        setStatus('error');
        toast.error(text.error);
        return;
      }

      setStatus('success');
      setEmail('');
      toast.success(text.success);
    } catch {
      setStatus('error');
      toast.error(text.error);
    }
  };

  return (
    <div className="rf-app-shell min-h-[100svh]">
      <WaitlistNavbar />

      <main className="rf-page-wrap pb-16 pt-28 lg:pb-20 lg:pt-32">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-10">
          <section className={cn('space-y-5', isRtl && 'text-right')}>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700 shadow-sm dark:border-sky-500/30 dark:bg-slate-900/70 dark:text-sky-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {text.badge}
            </span>

            <h1 className="text-3xl font-black leading-tight text-slate-950 dark:text-white sm:text-4xl lg:text-5xl">
              {text.title}
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
              {text.description}
            </p>

            <ul className="space-y-2">
              {text.highlights.map((item, index) => {
                const Icon = index === 0 ? Factory : index === 1 ? Timer : ShieldCheck;
                return (
                  <li
                    key={item}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border border-slate-200 bg-white/85 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/75 dark:text-slate-200',
                      isRtl && 'flex-row-reverse'
                    )}
                  >
                    <Icon className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                    <span>{item}</span>
                  </li>
                );
              })}
            </ul>

            <form id="waitlist" onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.4)] dark:border-slate-800 dark:bg-slate-900/85">
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative flex-1">
                  <Mail
                    className={cn('pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400', isRtl ? 'right-3' : 'left-3')}
                  />
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (status === 'error') setStatus('idle');
                    }}
                    placeholder={text.emailPlaceholder}
                    className={cn(
                      'h-12 border-transparent bg-slate-50/80',
                      isRtl ? 'pr-10 text-right' : 'pl-10',
                      status === 'error' && 'border-rose-300 focus-visible:ring-rose-300'
                    )}
                    disabled={status === 'loading'}
                  />
                </label>
                <Button type="submit" className="h-12 px-5 text-sm font-semibold" disabled={status === 'loading'}>
                  {text.submit}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              {status === 'success' ? (
                <p className="mt-2 px-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">{text.success}</p>
              ) : null}
            </form>

            <div className={cn('flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300', isRtl && 'justify-end')}>
              <Link
                href="/auth/login"
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {text.login}
              </Link>
              <a href="mailto:info@renkflow.com" className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                {text.footer}
              </a>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white/75 p-2 shadow-[0_30px_65px_-45px_rgba(15,23,42,0.55)] dark:border-slate-700 dark:bg-slate-950/70">
            <DashboardPreview isDark={isDark} locale={locale === 'en' || locale === 'ar' ? locale : 'tr'} />
          </section>
        </div>
      </main>
    </div>
  );
};
