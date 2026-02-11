'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  Mail,
  CheckCircle2,
  Star,
  Github,
  Twitter,
  Linkedin,
  ArrowRight,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/lib/i18n/client';
import { WaitlistNavbar } from './WaitlistNavbar';
import { DashboardPreview } from './DashboardPreview';

// ─── Countdown Timer ───
const LAUNCH_DATE = new Date('2026-03-15T00:00:00+03:00');

function useCountdown(targetDate: Date) {
  const calcTimeLeft = useCallback(() => {
    const diff = targetDate.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState(calcTimeLeft);

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(calcTimeLeft()), 1000);
    return () => clearInterval(id);
  }, [calcTimeLeft]);

  return timeLeft;
}

const CountdownBlock = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 flex items-center justify-center shadow-lg overflow-hidden">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="text-2xl sm:text-3xl font-bold tabular-nums text-slate-900 dark:text-white"
        >
          {String(value).padStart(2, '0')}
        </motion.span>
      </AnimatePresence>
    </div>
    <span className="mt-2 text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">
      {label}
    </span>
  </div>
);

const Separator = () => (
  <span className="text-2xl sm:text-3xl font-bold text-slate-300 dark:text-slate-600 self-start mt-4 sm:mt-5 select-none">
    :
  </span>
);

// ─── Main Component ───

export const ComingSoonPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [mounted, setMounted] = useState(false);
  const { locale, isRtl } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => { setMounted(true); }, []);

  const uiLocale = mounted && (locale === 'en' || locale === 'ar') ? locale : 'tr';
  const localeIsRtl = mounted ? isRtl : false;

  const timeLeft = useCountdown(LAUNCH_DATE);

  const copy = useMemo(() => ({
    tr: {
      validation: {
        emailRequired: 'Lütfen e-posta adresinizi girin.',
        emailInvalid: 'Lütfen geçerli bir e-posta adresi girin.',
        genericError: 'Bir hata oluştu.',
        networkError: 'Bağlantı hatası. Lütfen tekrar deneyin.',
        waitlistSuccess: 'Bekleme listesine eklendiniz!',
      },
      badge: 'Erken Erişim • Çok Yakında',
      titleLine1: 'Üretim Süreçlerinizi',
      titleAccent: 'Dönüştürün.',
      subtitle: 'Yapay zeka destekli üretim yönetim platformu ile karmaşık süreçleri otomatize edin, verimliliği %40 artırın.',
      placeholder: 'İş e-posta adresiniz',
      cta: 'Erken Erişim Al',
      formSuccess: 'Listeye eklendi! Sizi haberdar edeceğiz.',
      launchNote: 'Lansmana özel %50 indirim • Kredi kartı gerekmez',
      countdown: { days: 'Gün', hours: 'Saat', minutes: 'Dakika', seconds: 'Saniye' },
      ratingText: 'ortalama puan',
      betaUsers: 'beta kullanıcısı',
      footer: {
        about: 'RenkFlow, modern üretim tesisleri için tasarlanmış yeni nesil bir yönetim platformudur.',
        rights: 'Tüm hakları saklıdır.',
        privacy: 'Gizlilik Politikası',
        terms: 'Kullanım Koşulları',
      },
    },
    en: {
      validation: {
        emailRequired: 'Please enter your email address.',
        emailInvalid: 'Please enter a valid email address.',
        genericError: 'Something went wrong.',
        networkError: 'Network error. Please try again.',
        waitlistSuccess: 'You are on the waitlist!',
      },
      badge: 'Early Access • Coming Soon',
      titleLine1: 'Transform Your',
      titleAccent: 'Production.',
      subtitle: 'Automate complex processes with our AI-powered manufacturing management platform. Increase efficiency by 40%.',
      placeholder: 'Your work email',
      cta: 'Get Early Access',
      formSuccess: 'You\'re on the list! We\'ll keep you posted.',
      launchNote: 'Launch offer: 50% off • No credit card required',
      countdown: { days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds' },
      ratingText: 'average rating',
      betaUsers: 'beta users',
      footer: {
        about: 'RenkFlow is a modern operating platform built for real manufacturing environments.',
        rights: 'All rights reserved.',
        privacy: 'Privacy Policy',
        terms: 'Terms of Service',
      },
    },
    ar: {
      validation: {
        emailRequired: 'يرجى إدخال بريدك الإلكتروني.',
        emailInvalid: 'يرجى إدخال بريد إلكتروني صحيح.',
        genericError: 'حدث خطأ غير متوقع.',
        networkError: 'خطأ في الشبكة. حاول مرة أخرى.',
        waitlistSuccess: 'تمت إضافتك إلى قائمة الانتظار.',
      },
      badge: 'وصول مبكر • قريباً',
      titleLine1: 'حوّل تدفق',
      titleAccent: 'الإنتاج.',
      subtitle: 'أتمتة العمليات المعقدة بمنصة إدارة تصنيع مدعومة بالذكاء الاصطناعي. ارفع الكفاءة بنسبة 40%.',
      placeholder: 'بريد العمل الإلكتروني',
      cta: 'احصل على الوصول المبكر',
      formSuccess: 'تم التسجيل بنجاح. سنبقيك على اطلاع.',
      launchNote: 'عرض الإطلاق: خصم 50% • بدون بطاقة ائتمان',
      countdown: { days: 'يوم', hours: 'ساعة', minutes: 'دقيقة', seconds: 'ثانية' },
      ratingText: 'متوسط التقييم',
      betaUsers: 'مستخدم تجريبي',
      footer: {
        about: 'RenkFlow منصة تشغيل حديثة مصممة خصيصاً لبيئات التصنيع الواقعية.',
        rights: 'جميع الحقوق محفوظة.',
        privacy: 'سياسة الخصوصية',
        terms: 'شروط الاستخدام',
      },
    },
  }), []);

  const text = copy[uiLocale];

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error(text.validation.emailRequired); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { toast.error(text.validation.emailInvalid); return; }
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
  }, [email, text.validation]);

  // Stagger animation variants
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
  };

  const footerSocialLinks = [
    { icon: Twitter, href: 'https://twitter.com/renkflow', label: 'Twitter' },
    { icon: Linkedin, href: 'https://linkedin.com/company/renkflow', label: 'LinkedIn' },
    { icon: Github, href: 'https://github.com/renkflow', label: 'GitHub' },
  ];

  return (
    <div className="rf-app-shell min-h-[100svh] relative selection:bg-blue-100 dark:selection:bg-blue-900/40 overflow-hidden">

      {/* ─── Animated Background ─── */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Dot grid pattern */}
        <div className="absolute inset-0 coming-soon-grid" />

        {/* Aurora blobs */}
        <div className="absolute -top-[30%] -left-[20%] w-[80%] h-[80%] bg-gradient-to-br from-blue-400/20 via-indigo-400/15 to-transparent rounded-full blur-[140px] animate-aurora" />
        <div className="absolute -bottom-[20%] -right-[20%] w-[70%] h-[70%] bg-gradient-to-tl from-purple-400/15 via-cyan-400/10 to-transparent rounded-full blur-[120px] animate-aurora" style={{ animationDelay: '-8s' }} />
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-gradient-to-bl from-emerald-300/10 via-blue-300/10 to-transparent rounded-full blur-[100px] animate-aurora" style={{ animationDelay: '-14s' }} />

        {/* Top fade */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/80 dark:from-[#0B0B0F]/80 to-transparent" />
      </div>

      <WaitlistNavbar />

      {/* ─── HERO — Full Viewport ─── */}
      <section className="relative min-h-[100svh] flex flex-col items-center justify-center px-4 sm:px-6 pt-20 pb-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="relative z-10 w-full max-w-4xl mx-auto text-center flex flex-col items-center"
        >
          {/* Badge */}
          <motion.div variants={fadeUp}>
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-blue-200/60 dark:border-blue-700/40 bg-white/70 dark:bg-white/5 backdrop-blur-xl text-xs font-medium text-slate-600 dark:text-slate-300 shadow-sm mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {text.badge}
              </span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold tracking-tight leading-[1.05] mb-6 text-slate-900 dark:text-white"
          >
            {text.titleLine1}
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 animate-gradient-xy">
              {text.titleAccent}
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            className="text-base sm:text-lg lg:text-xl text-slate-500 dark:text-slate-400 mb-10 max-w-2xl leading-relaxed font-light"
          >
            {text.subtitle}
          </motion.p>

          {/* ─── Countdown Timer ─── */}
          <motion.div variants={fadeUp} className="flex items-start gap-3 sm:gap-5 mb-10">
            <CountdownBlock value={timeLeft.days} label={text.countdown.days} />
            <Separator />
            <CountdownBlock value={timeLeft.hours} label={text.countdown.hours} />
            <Separator />
            <CountdownBlock value={timeLeft.minutes} label={text.countdown.minutes} />
            <Separator />
            <CountdownBlock value={timeLeft.seconds} label={text.countdown.seconds} />
          </motion.div>

          {/* ─── Email Form ─── */}
          <motion.div
            variants={fadeUp}
            id="waitlist"
            className="w-full max-w-lg mx-auto"
          >
            <div className="relative p-1.5 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 shadow-xl animate-glow-pulse">
              <AnimatePresence mode="wait">
                {status === 'success' ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-3 p-4 text-emerald-600 dark:text-emerald-400 font-medium justify-center"
                  >
                    <CheckCircle2 size={20} />
                    <p>{text.formSuccess}</p>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit}
                    className="flex flex-col sm:flex-row gap-2"
                  >
                    <div className="relative flex-1">
                      <Mail
                        className="absolute top-1/2 -translate-y-1/2 text-slate-400"
                        style={localeIsRtl ? { right: '0.875rem' } : { left: '0.875rem' }}
                        size={18}
                      />
                      <Input
                        type="email"
                        placeholder={text.placeholder}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={status === 'loading'}
                        className={`h-12 rounded-xl bg-transparent border-none focus-visible:ring-0 text-slate-900 dark:text-white placeholder:text-slate-400 shadow-none ${localeIsRtl ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4 text-left'}`}
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={status === 'loading'}
                      className="h-12 px-6 sm:px-8 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 w-full sm:w-auto text-sm sm:text-[15px]"
                    >
                      {status === 'loading' ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className={localeIsRtl ? 'ml-2' : 'mr-2'}>{text.cta}</span>
                          <ArrowRight size={16} className={localeIsRtl ? 'rotate-180' : ''} />
                        </>
                      )}
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
              {text.launchNote}
            </p>
          </motion.div>

          {/* ─── Social Proof ─── */}
          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-col sm:flex-row items-center gap-5"
          >
            <div className="flex -space-x-2.5">
              {['AY', 'ED', 'MK', 'SK', 'BT'].map((initials, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border-2 border-white dark:border-[#0B0B0F] flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-slate-400 shadow-sm"
                >
                  {initials}
                </div>
              ))}
              <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white dark:border-[#0B0B0F] flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                +500
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={14} fill="#FACC15" className="text-yellow-400" />
                ))}
              </div>
              <span>
                <strong className="text-slate-800 dark:text-white">500+</strong> {text.betaUsers} •{' '}
                <strong className="text-slate-800 dark:text-white">4.9/5</strong> {text.ratingText}
              </span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── DASHBOARD PREVIEW — Floating Below ─── */}
      <section className="relative pb-24 lg:pb-32 px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative max-w-6xl mx-auto"
        >
          {/* Glow behind dashboard */}
          <div className="absolute -inset-8 bg-gradient-to-t from-blue-500/10 via-indigo-500/5 to-transparent blur-3xl rounded-3xl pointer-events-none" />

          {/* Dashboard container */}
          <div className="relative animate-float">
            <div className="relative rounded-2xl p-1.5 bg-white/40 dark:bg-white/5 ring-1 ring-slate-900/10 dark:ring-white/10 backdrop-blur-sm shadow-2xl dark:shadow-blue-900/20 overflow-hidden">
              {/* Sheen overlay */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-[70]">
                <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/15 dark:via-white/5 to-transparent skew-x-[-20deg] animate-[sheen_4s_ease-in-out_infinite]" />
              </div>
              <DashboardPreview isDark={isDark} locale={uiLocale} />
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── FOOTER — Minimal ─── */}
      <footer className="relative border-t border-slate-200 dark:border-slate-800/60 pt-12 pb-8 bg-white/30 dark:bg-[#0B0B0F]/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8">
            <div className="flex items-center gap-3">
              <div className="relative h-6 w-24">
                <Image
                  src="/renkflow-logo-new.png"
                  alt="RenkFlow"
                  fill
                  className="object-contain object-left"
                />
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md text-center md:text-left">
              {text.footer.about}
            </p>
            <div className="flex items-center gap-3">
              {footerSocialLinks.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="p-2 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} RenkFlow Teknoloji A.Ş. {text.footer.rights}
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                {text.footer.privacy}
              </a>
              <a href="#" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                {text.footer.terms}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
