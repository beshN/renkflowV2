'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Menu, X, ChevronRight, Sparkles } from 'lucide-react';
import { useTheme } from 'next-themes';
import { LanguageSelector } from '@/components/ui/LanguageSelector';
import { cn } from '@/lib/utils';

interface UnifiedNavbarProps {
  largeLogo?: boolean;
  transparent?: boolean;
}

export const UnifiedNavbar = memo(({ largeLogo = false, transparent = false }: UnifiedNavbarProps) => {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const { setTheme } = useTheme();

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

  const navItems = [
    { label: 'Özellikler', href: '/features', description: 'Güçlü özelliklerimizi keşfedin' },
    { label: 'Fiyatlandırma', href: '/pricing', description: 'Size uygun planı bulun' },
    { label: 'Entegrasyonlar', href: '/integrations', description: 'Mevcut araçlarınızla entegre edin' },
    { label: 'İletişim', href: '/contact', description: 'Bizimle iletişime geçin' },
  ];

  const [mounted, setMounted] = useState(false);
  const [themeState, setThemeState] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem("theme") || 
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setThemeState(storedTheme as "light" | "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = themeState === "light" ? "dark" : "light";
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    setTheme(newTheme);
  }, [themeState, setTheme]);

  return (
    <>
      <header 
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
          isScrolled 
            ? 'bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl shadow-[0_1px_0_0_rgba(0,0,0,0.05),0_4px_20px_-4px_rgba(0,0,0,0.1)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05),0_4px_20px_-4px_rgba(0,0,0,0.3)]'
            : transparent ? 'bg-transparent' : 'bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm'
        )}
      >
        <div className="w-full px-4 sm:px-6 lg:px-12">
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
                    ? 'h-20 w-56 md:h-24 md:w-80' 
                    : 'h-14 w-44 md:h-16 md:w-52'
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Image
                  src="/logo-full.png"
                  alt="Renkflow"
                  fill
                  sizes={largeLogo ? "(max-width: 768px) 70vw, 480px" : "(max-width: 768px) 40vw, 250px"}
                  className="object-contain object-left scale-[1.99] origin-left"
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
                          ? 'text-white' 
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
                    {themeState === "light" ? (
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
                Giriş Yap
              </Link>

              <Link href="/signup">
                <motion.button 
                  className={cn(
                    'group relative px-5 py-2.5 text-sm font-semibold rounded-xl overflow-hidden',
                    'bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 text-white',
                    'shadow-[0_8px_30px_-8px_rgba(14,165,233,0.5)]',
                    'hover:shadow-[0_12px_40px_-8px_rgba(14,165,233,0.6)]',
                    'transition-shadow duration-300'
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Ücretsiz Başlayın
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
                  <span className="text-lg font-bold text-slate-900 dark:text-white">Menü</span>
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
                      <Link href="/faq" className="block text-lg font-medium text-slate-600 dark:text-slate-300 py-2">SSS</Link>
                      <Link href="/blog" className="block text-lg font-medium text-slate-600 dark:text-slate-300 py-2">Blog</Link>
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
                            {themeState === "light" ? <Sun size={20} /> : <Moon size={20} />}
                          </button>
                        ) : (
                          <div className="w-6 h-6" />
                        )}
                      </div>
                   </div>
                  <Link href="/auth/login" className="block w-full">
                    <button className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200">
                      Giriş Yap
                    </button>
                  </Link>
                  <Link href="/signup" className="block w-full">
                    <button className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 text-white font-semibold shadow-md">
                      Ücretsiz Başlayın
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
