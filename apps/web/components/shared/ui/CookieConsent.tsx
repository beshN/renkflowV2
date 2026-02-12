'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/client';

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const { locale } = useTranslation();
  const isRtl = locale === 'ar';

  const labels = {
    tr: {
      title: 'Çerez Kullanımı',
      description:
        'Web sitemizde deneyiminizi iyileştirmek için çerezler kullanıyoruz. Gerekli çerezler sitenin çalışması için zorunludur. Analitik ve pazarlama çerezleri ise size daha iyi hizmet vermemize yardımcı olur. Daha fazla bilgi için',
      policy: 'Gizlilik Politikamızı',
      necessary: 'Sadece Gerekli',
      acceptAll: 'Tümünü Kabul Et',
    },
    en: {
      title: 'Cookie Usage',
      description:
        'We use cookies to improve your experience. Essential cookies are required for the site to work. Analytics and marketing cookies help us serve you better. For more details, see our',
      policy: 'Privacy Policy',
      necessary: 'Necessary Only',
      acceptAll: 'Accept All',
    },
    ar: {
      title: 'استخدام ملفات الارتباط',
      description:
        'نستخدم ملفات الارتباط لتحسين تجربتك. الملفات الضرورية مطلوبة لعمل الموقع. ملفات التحليلات والتسويق تساعدنا على تقديم خدمة أفضل. لمزيد من التفاصيل راجع',
      policy: 'سياسة الخصوصية',
      necessary: 'الضروري فقط',
      acceptAll: 'قبول الكل',
    },
  } as const;
  const text = labels[locale as keyof typeof labels] ?? labels.tr;

  useEffect(() => {
    // Check if user has already accepted/rejected cookies
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      // Small delay to avoid hydration issues and improve UX
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem('cookie-consent', JSON.stringify({
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString()
    }));
    setShowBanner(false);
  };

  const acceptNecessary = () => {
    localStorage.setItem('cookie-consent', JSON.stringify({
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString()
    }));
    setShowBanner(false);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 72, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 72, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed bottom-3 left-0 right-0 z-50 px-3 sm:bottom-4 sm:px-4"
        >
          <div className="mx-auto max-w-4xl rounded-2xl border border-border-light bg-white/96 p-4 shadow-[0_30px_55px_-38px_rgba(12,18,32,0.75)] backdrop-blur-md dark:border-border-dark dark:bg-gray-900/92 sm:p-5">
            <div className={`flex flex-col ${isRtl ? 'md:flex-row-reverse text-right' : 'md:flex-row text-left'} items-start gap-4 md:items-center md:gap-5`}>
              {/* Icon and Text */}
              <div className="flex items-start gap-4 flex-1">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Cookie className="h-5 w-5 text-primary" />
                </div>
                <div className={isRtl ? 'text-right' : 'text-left'}>
                  <h3 className="mb-1 font-semibold text-base text-text-light dark:text-text-dark sm:text-lg">
                    {text.title}
                  </h3>
                  <p className="max-w-2xl text-sm leading-relaxed text-subtle-light dark:text-subtle-dark">
                    {text.description}{' '}
                    <Link href="/privacy" className="text-primary hover:underline">
                      {text.policy}
                    </Link>.
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className={`grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:w-auto ${isRtl ? 'md:flex-row-reverse' : ''}`}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={acceptNecessary}
                  className="h-10 rounded-lg border border-border-light px-4 text-sm font-medium text-text-light transition-colors hover:bg-gray-100 dark:border-border-dark dark:text-text-dark dark:hover:bg-gray-800 whitespace-nowrap"
                >
                  {text.necessary}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={acceptAll}
                  className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90 whitespace-nowrap"
                >
                  {text.acceptAll}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
