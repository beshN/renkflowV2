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
      short: 'Deneyimi iyileştirmek için çerez kullanıyoruz.',
      description:
        'Web sitemizde deneyiminizi iyileştirmek için çerezler kullanıyoruz. Gerekli çerezler sitenin çalışması için zorunludur. Analitik ve pazarlama çerezleri ise size daha iyi hizmet vermemize yardımcı olur. Daha fazla bilgi için',
      policy: 'Gizlilik Politikamızı',
      necessary: 'Sadece Gerekli',
      acceptAll: 'Tümünü Kabul Et',
    },
    en: {
      title: 'Cookie Usage',
      short: 'We use cookies to improve your experience.',
      description:
        'We use cookies to improve your experience. Essential cookies are required for the site to work. Analytics and marketing cookies help us serve you better. For more details, see our',
      policy: 'Privacy Policy',
      necessary: 'Necessary Only',
      acceptAll: 'Accept All',
    },
    ar: {
      title: 'استخدام ملفات الارتباط',
      short: 'نستخدم ملفات الارتباط لتحسين تجربتك.',
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
      const timer = setTimeout(() => setShowBanner(true), 2500);
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
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-50 p-2.5 md:p-5"
        >
          <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-border-light dark:border-border-dark p-4 md:p-6">
            <div className={`flex flex-col ${isRtl ? 'md:flex-row-reverse text-right' : 'md:flex-row text-left'} items-start md:items-center gap-6`}>
              {/* Icon and Text */}
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Cookie className="h-6 w-6 text-primary" />
                </div>
                <div className={isRtl ? 'text-right' : 'text-left'}>
                  <h3 className="font-bold text-lg text-text-light dark:text-text-dark mb-2">
                    {text.title}
                  </h3>
                  <p className="text-subtle-light dark:text-subtle-dark text-sm leading-relaxed sm:hidden">
                    {text.short}
                  </p>
                  <p className="hidden sm:block text-subtle-light dark:text-subtle-dark text-sm leading-relaxed">
                    {text.description}{' '}
                    <Link href="/privacy" className="text-primary hover:underline">
                      {text.policy}
                    </Link>.
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className={`flex flex-col sm:flex-row gap-3 w-full md:w-auto ${isRtl ? 'md:flex-row-reverse' : ''}`}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={acceptNecessary}
                  className="px-6 py-3 rounded-lg border border-border-light dark:border-border-dark font-medium text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm whitespace-nowrap"
                >
                  {text.necessary}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={acceptAll}
                  className="px-6 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors text-sm whitespace-nowrap"
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
