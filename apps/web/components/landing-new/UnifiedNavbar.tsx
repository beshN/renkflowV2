'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Menu, X, ChevronRight } from 'lucide-react';
import { useTheme } from 'next-themes';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/client';

interface UnifiedNavbarProps {
  largeLogo?: boolean;
  transparent?: boolean;
}

export const UnifiedNavbar = memo(({ largeLogo = false, transparent = false }: UnifiedNavbarProps) => {
  const pathname = usePathname();
  const { locale } = useTranslation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const uiLocale = mounted ? locale : 'tr';

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "light" ? "dark" : "light");
  }, [resolvedTheme, setTheme]);

  const labels = {
    tr: {
      login: 'Giriş Yap',
      start: 'Erken Erişim',
      menu: 'Menü',
      features: 'Özellikler',
      pricing: 'Fiyatlandırma',
      integrations: 'Entegrasyonlar',
      contact: 'İletişim',
      faq: 'SSS',
      blog: 'Blog',
    },
    en: {
      login: 'Sign In',
      start: 'Request Access',
      menu: 'Menu',
      features: 'Features',
      pricing: 'Pricing',
      integrations: 'Integrations',
      contact: 'Contact',
      faq: 'FAQ',
      blog: 'Blog',
    },
    ar: {
      login: 'تسجيل الدخول',
      start: 'طلب الوصول',
      menu: 'القائمة',
      features: 'الميزات',
      pricing: 'الأسعار',
      integrations: 'التكاملات',
      contact: 'تواصل',
      faq: 'الأسئلة الشائعة',
      blog: 'المدونة',
    },
  } as const;
  const text = labels[uiLocale as keyof typeof labels] ?? labels.tr;
  const navItems = [
    { label: text.features, href: '/features' },
    { label: text.pricing, href: '/pricing' },
    { label: text.integrations, href: '/integrations' },
    { label: text.contact, href: '/contact' },
  ];

  return (
    <>
      <header 
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
          isScrolled 
            ? 'rf-topbar shadow-[0_1px_0_0_rgba(0,0,0,0.05),0_4px_20px_-4px_rgba(0,0,0,0.1)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05),0_4px_20px_-4px_rgba(0,0,0,0.3)]'
            : transparent ? 'bg-transparent' : 'bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm'
        )}
      >
        <div className="rf-page-wrap">
          <div className="flex justify-between items-center h-20 lg:h-24">
            {/* Logo */}
            <Link 
              href="/" 
              className={cn(
                'flex items-center flex-shrink-0 cursor-pointer group overflow-visible',
                largeLogo && 'absolute top-4 left-6 md:top-6 md:left-12 z-[60]'
              )}
            >
              <motion.div 
                className={cn(
                  'relative overflow-hidden transition-all duration-500',
                  largeLogo 
                    ? 'h-10 md:h-12' 
                    : 'h-8 md:h-9'
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Image
                  src="/email-assets/header-logo.png"
                  alt="RenkFlow"
                  width={442}
                  height={88}
                  sizes={largeLogo ? "(max-width: 768px) 150px, 190px" : "(max-width: 768px) 140px, 170px"}
                  className="h-full w-auto object-contain"
                  priority
                />
              </motion.div>
            </Link>

            {/* Desktop Navigation - Pill Style */}
            <nav className="hidden lg:flex items-center">
              <div className="flex items-center gap-1 rounded-full border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-1.5 py-1.5 shadow-sm">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onMouseEnter={() => setActiveItem(item.href)}
                      onMouseLeave={() => setActiveItem(null)}
                      className={cn(
                        'relative px-4 py-2 text-sm font-medium rounded-full transition-all duration-300',
                        isActive 
                          ? 'text-white dark:text-slate-900' 
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="navbar-active"
                          className="absolute inset-0 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-100 rounded-full"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      {activeItem === item.href && !isActive && (
                        <motion.div
                          layoutId="navbar-hover"
                          className="absolute inset-0 bg-slate-100 dark:bg-slate-800 rounded-full"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        />
                      )}
                      <span className="relative z-10">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Right Actions */}
            <div className="hidden lg:flex items-center gap-2">
              <LanguageSelector variant="dropdown" showLabel={false} className="mr-1" />

              {/* Theme Toggle - Professional */}
              {mounted && (
                <motion.button
                  onClick={toggleTheme}
                  className={cn(
                    'relative p-2.5 rounded-xl transition-all duration-300',
                    'bg-slate-100 dark:bg-slate-800',
                    'hover:bg-slate-200 dark:hover:bg-slate-700',
                    'text-slate-600 dark:text-slate-300'
                  )}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Temayı Değiştir"
                >
                  <AnimatePresence mode="wait">
                    {resolvedTheme === "light" ? (
                      <motion.div
                        key="moon"
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Moon size={18} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="sun"
                        initial={{ rotate: 90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: -90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Sun size={18} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              )}

              <Link 
                href="/auth/login" 
                className={cn(
                  'px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-300',
                  'text-slate-700 dark:text-slate-300',
                  'hover:text-slate-900 dark:hover:text-white',
                  'hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                {text.login}
              </Link>

              <Link href="/signup">
                <motion.button 
                  className={cn(
                    'group relative px-5 py-2.5 text-sm font-semibold rounded-xl overflow-hidden',
                    'bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 text-white',
                    'shadow-[0_8px_30px_-8px_rgba(184,116,68,0.5)]',
                    'hover:shadow-[0_12px_40px_-8px_rgba(184,116,68,0.6)]',
                    'transition-shadow duration-300'
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {text.start}
                    <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                </motion.button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Menu size={22} />
            </motion.button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/60 z-[60] md:hidden backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[320px] bg-white/90 dark:bg-slate-950/90 z-[70] md:hidden shadow-2xl border-l border-slate-200/70 dark:border-slate-800 backdrop-blur"
            >
              <div className="flex flex-col h-full p-6">
                <div className="flex items-center justify-between mb-8">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{text.menu}</span>
                  <button onClick={() => setIsMobileMenuOpen(false)}>
                    <X size={24} className="text-slate-500 hover:text-slate-900 dark:hover:text-white" />
                  </button>
                </div>

                <nav className="flex-1 space-y-4">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block text-lg font-medium ${
                        pathname === item.href
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                      <Link href="/faq" className="block text-lg font-medium text-slate-600 dark:text-slate-300 py-2">{text.faq}</Link>
                      <Link href="/blog" className="block text-lg font-medium text-slate-600 dark:text-slate-300 py-2">{text.blog}</Link>
                  </div>
                </nav>

                <div className="mt-auto space-y-4">
                   <div className="flex justify-between items-center py-4 border-t border-gray-100 dark:border-gray-800">
                      <span className="text-sm text-slate-500">Dil & Görünüm</span>
                      <div className="flex items-center gap-3">
                        <LanguageSelector variant="dropdown" showLabel={false} />
                        {mounted ? (
                          <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300"
                          >
                            {resolvedTheme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
                          </button>
                        ) : (
                          <div className="w-6 h-6" />
                        )}
                      </div>
                   </div>
                  <Link href="/auth/login" className="block w-full">
                    <button className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200">
                      {text.login}
                    </button>
                  </Link>
                  <Link href="/signup" className="block w-full">
                    <button className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 text-white font-semibold shadow-md">
                      {text.start}
                    </button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});

UnifiedNavbar.displayName = 'UnifiedNavbar';
