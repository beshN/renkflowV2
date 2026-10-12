'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    let promptTimer: ReturnType<typeof setTimeout> | undefined;
    setShowPrompt(false);
    const suppressOnPublicPages =
      pathname === '/' ||
      pathname.startsWith('/coming-soon') ||
      pathname.startsWith('/auth/') ||
      pathname.startsWith('/signup') ||
      pathname.startsWith('/pricing') ||
      pathname.startsWith('/features') ||
      pathname.startsWith('/about') ||
      pathname.startsWith('/contact') || pathname.startsWith('/track/') || pathname.startsWith('/factory') || pathname.startsWith('/quotations/');

    if (suppressOnPublicPages) {
      return;
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Don't show again for 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Check iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // For non-iOS devices
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after user has spent enough time in app surfaces
      if (promptTimer) clearTimeout(promptTimer);
      promptTimer = setTimeout(() => setShowPrompt(true), 45000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, show instruction prompt after delay
    if (isIOSDevice) {
      promptTimer = setTimeout(() => setShowPrompt(true), 90000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      if (promptTimer) clearTimeout(promptTimer);
    };
  }, [pathname]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
    } catch (error) {
      // Silent fail for install errors
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        role="region"
        aria-label="RenkFlow uygulamasını yükleyin"
        className="fixed bottom-24 left-4 right-4 md:bottom-20 md:left-auto md:right-4 md:w-96 z-50 print:hidden"
      >
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-border-light dark:border-border-dark p-5 relative overflow-hidden">

          
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Kapat"
          >
            <X className="h-[18px] w-[18px] text-subtle-light dark:text-subtle-dark" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            
            <div className="flex-1 pr-6">
              <h2 className="font-bold text-text-light dark:text-text-dark mb-1">
                Renkflow uygulaması
              </h2>
              
              {isIOS ? (
                <p className="text-sm text-subtle-light dark:text-subtle-dark mb-3">
                  Ana ekranınıza ekleyin: <Share className="inline h-4 w-4 align-text-bottom" /> simgesine dokunun, ardından <strong>&quot;Ana Ekrana Ekle&quot;</strong> seçin.
                </p>
              ) : (
                <p className="text-sm text-subtle-light dark:text-subtle-dark mb-3">
                  Çalışma alanınıza doğrudan erişmek için RenkFlow’u uygulama olarak yükleyin. Canlı veriler için internet bağlantısı gerekir.
                </p>
              )}

              {!isIOS && deferredPrompt && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleInstall}
                  className="rf-primary-button w-full py-2.5"
                >
                  <Download className="h-[18px] w-[18px]" />
                  Yükle
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
