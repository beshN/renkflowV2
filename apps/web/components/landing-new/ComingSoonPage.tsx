'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/lib/i18n/client';
import { WaitlistNavbar } from './WaitlistNavbar';

type UiLocale = 'tr' | 'en' | 'ar';

export const ComingSoonPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const { locale, isRtl } = useTranslation();

  const uiLocale: UiLocale = locale === 'en' || locale === 'ar' ? locale : 'tr';
  const localeIsRtl = isRtl;

  const copy = useMemo(
    () => ({
      tr: {
        badge: 'Private Beta',
        title: 'RenkFlow üretim ekipleri için hazırlanıyor.',
        subtitle:
          'Sipariş takibi, stok kontrolü ve ekip koordinasyonunu tek bir sade platformda birleştiriyoruz.',
        points: [
          'Gerçek zamanlı üretim takibi',
          'Stok ve malzeme görünürlüğü',
          'Planlama ve operasyon ekipleri için ortak çalışma alanı',
        ],
        formTitle: 'Erken erişim için kaydolun',
        placeholder: 'İş e-posta adresiniz',
        cta: 'Erken Erişim Talep Et',
        success: 'Kaydınız alındı. Uygun olduğunda sizinle iletişime geçeceğiz.',
        note: 'Lansman tarihi netleştiğinde bekleme listesindeki ekiplere öncelik verilecektir.',
        sideTitle: 'Bu sayfada ne var?',
        sideSubtitle:
          'Şu anda ürün erişimi kademeli açılıyor. Bu sayfa, erken erişim başvurusu ve ürün özeti için kullanılır.',
        sideItems: [
          'Kurumsal ürün özeti',
          'Bekleme listesi kaydı',
          'Guncel bilgi için tek giriş noktası',
        ],
        validation: {
          required: 'Lütfen e-posta adresinizi girin.',
          invalid: 'Lütfen geçerli bir e-posta adresi girin.',
          generic: 'Bir hata oluştu.',
          network: 'Bağlantı hatası. Lütfen tekrar deneyin.',
          success: 'Bekleme listesine eklendiniz.',
        },
      },
      en: {
        badge: 'Private Beta',
        title: 'RenkFlow is being prepared for production teams.',
        subtitle:
          'We are combining production tracking, inventory control, and team collaboration in one practical platform.',
        points: [
          'Real-time production tracking',
          'Inventory and material visibility',
          'Shared workspace for planning and operations',
        ],
        formTitle: 'Request early access',
        placeholder: 'Work email',
        cta: 'Request Early Access',
        success: "You're on the list. We'll contact you when access is available.",
        note: 'Waitlist teams will be informed first when launch timing is confirmed.',
        sideTitle: 'What is on this page?',
        sideSubtitle:
          'Product access is being rolled out in stages. This page is the single point for early-access requests and product context.',
        sideItems: [
          'Company and product summary',
          'Waitlist registration',
          'Single source for launch updates',
        ],
        validation: {
          required: 'Please enter your email address.',
          invalid: 'Please enter a valid email address.',
          generic: 'Something went wrong.',
          network: 'Network error. Please try again.',
          success: 'You are on the waitlist.',
        },
      },
      ar: {
        badge: 'Private Beta',
        title: 'RenkFlow قيد الإعداد لفرق الإنتاج.',
        subtitle:
          'نجمع تتبع الإنتاج وإدارة المخزون وتعاون الفريق في منصة واحدة عملية وسهلة.',
        points: [
          'تتبع الإنتاج بشكل فوري',
          'رؤية واضحة للمخزون والمواد',
          'مساحة عمل مشتركة للتخطيط والتشغيل',
        ],
        formTitle: 'اطلب الوصول المبكر',
        placeholder: 'بريد العمل الإلكتروني',
        cta: 'اطلب الوصول المبكر',
        success: 'تم تسجيلك في القائمة. سنتواصل معك عند فتح الوصول.',
        note: 'سيتم إبلاغ فرق قائمة الانتظار أولاً عند تأكيد توقيت الإطلاق.',
        sideTitle: 'ماذا يوجد في هذه الصفحة؟',
        sideSubtitle:
          'يتم فتح الوصول إلى المنتج بشكل تدريجي. هذه الصفحة هي نقطة الدخول لطلب الوصول المبكر ومعرفة معلومات المنتج.',
        sideItems: [
          'ملخص الشركة والمنتج',
          'تسجيل قائمة الانتظار',
          'مرجع واحد لتحديثات الإطلاق',
        ],
        validation: {
          required: 'يرجى إدخال بريدك الإلكتروني.',
          invalid: 'يرجى إدخال بريد إلكتروني صحيح.',
          generic: 'حدث خطأ غير متوقع.',
          network: 'خطأ في الشبكة. حاول مرة أخرى.',
          success: 'تمت إضافتك إلى قائمة الانتظار.',
        },
      },
    }),
    []
  );

  const text = copy[uiLocale];

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      if (!email) {
        toast.error(text.validation.required);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error(text.validation.invalid);
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
          setEmail('');
          toast.success(data.message || text.validation.success);
        } else {
          setStatus('idle');
          toast.error(data.error || text.validation.generic);
        }
      } catch {
        setStatus('idle');
        toast.error(text.validation.network);
      }
    },
    [email, text.validation]
  );

  return (
    <div className="rf-app-shell min-h-[100svh] bg-slate-50 dark:bg-slate-950">
      <WaitlistNavbar />

      <main className="px-4 pb-16 pt-28 sm:px-6">
        <section className="rf-page-wrap">
          <div
            dir={localeIsRtl ? 'rtl' : 'ltr'}
            className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {text.badge}
              </div>

              <h1 className="mt-5 text-balance text-4xl font-bold leading-tight text-slate-900 dark:text-white sm:text-5xl">
                {text.title}
              </h1>

              <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
                {text.subtitle}
              </p>

              <ul className="mt-6 grid gap-2 text-sm text-slate-700 dark:text-slate-200">
                {text.points.map((item) => (
                  <li key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
                    {item}
                  </li>
                ))}
              </ul>

              <div id="waitlist" className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{text.formTitle}</p>
                <AnimatePresence mode="wait">
                  {status === 'success' ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex min-h-[50px] items-center gap-2 rounded-xl bg-emerald-500/10 px-3 text-sm text-emerald-700 dark:text-emerald-300"
                    >
                      <CheckCircle2 size={18} />
                      {text.success}
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
                          size={16}
                          className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400"
                          style={localeIsRtl ? { right: '0.75rem' } : { left: '0.75rem' }}
                        />
                        <Input
                          type="email"
                          placeholder={text.placeholder}
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          disabled={status === 'loading'}
                          className={`h-11 bg-white dark:bg-slate-900 ${localeIsRtl ? 'pr-9 text-right' : 'pl-9'}`}
                        />
                      </div>
                      <Button type="submit" disabled={status === 'loading'} className="h-11 rounded-xl px-5">
                        {status === 'loading' ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        ) : (
                          <>
                            <span>{text.cta}</span>
                            <ArrowRight size={16} />
                          </>
                        )}
                      </Button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>

              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{text.note}</p>
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8"
            >
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{text.sideTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{text.sideSubtitle}</p>

              <div className="mt-5 space-y-2">
                {text.sideItems.map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200"
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/70">
                <p className="font-semibold text-slate-900 dark:text-white">info@renkflow.com</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">Istanbul, Turkiye</p>
              </div>
            </motion.aside>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="rf-page-wrap flex flex-col items-center justify-between gap-2 px-4 text-xs text-slate-500 sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} RenkFlow</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-700 dark:hover:text-slate-200">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-700 dark:hover:text-slate-200">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
