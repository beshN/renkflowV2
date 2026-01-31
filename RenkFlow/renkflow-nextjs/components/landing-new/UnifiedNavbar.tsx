'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Menu, X } from 'lucide-react';
import { useTheme } from '@/lib/context/ThemeContext';

interface UnifiedNavbarProps {
  largeLogo?: boolean;
}

export const UnifiedNavbar = ({ largeLogo = false }: UnifiedNavbarProps) => {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Prevent scrolling when mobile menu is open
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
    { label: 'Özellikler', href: '/features' },
    { label: 'Fiyatlandırma', href: '/pricing' },
    { label: 'Entegrasyonlar', href: '/integrations' },
    { label: 'İletişim', href: '/contact' },
  ];

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 z-50 bg-transparent transition-all duration-300 ${
          isScrolled 
            ? `backdrop-blur-xl shadow-[0_20px_50px_-35px_rgba(15,23,42,0.5)] ${largeLogo ? '' : 'border-b border-slate-200/60 dark:border-slate-800/60'}` 
            : ''
        }`}
      >
        {/* 
          Navbar container: h-24 (96px) compact height
          The logo uses negative margins to extend beyond the navbar bounds
        */}
        <div className="w-full px-6 md:px-12">
          <div className="flex justify-between items-center h-24">
            {/* 
              Logo Section - Large logo that overflows the navbar
              - h-40 (160px) for large logo, h-24 (96px) for standard
              - -my-8 negative margin to extend beyond h-24 navbar container
              - overflow-visible to prevent clipping
            */}
            <Link 
              href="/" 
              className={`flex items-center flex-shrink-0 cursor-pointer group overflow-visible ${
                largeLogo ? 'absolute top-4 left-6 md:top-6 md:left-12 z-[60]' : ''
              }`}
            >
              <div 
                className={`relative overflow-hidden transition-all duration-500 ${
                  largeLogo 
                    ? 'h-20 w-56 md:h-24 md:w-80 group-hover:scale-105' 
                    : 'h-16 w-48 md:h-20 md:w-64 group-hover:scale-105'
                }`}
              >
                <Image
                  src="/logo-full.png"
                  alt="Renkflow"
                  fill
                  sizes={largeLogo ? "(max-width: 768px) 70vw, 480px" : "(max-width: 768px) 40vw, 250px"}
                  className="object-contain object-left scale-[1.99] origin-left"
                  priority
                />
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-2 py-1 text-sm font-medium shadow-sm backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/60">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 transition-colors ${
                    pathname === item.href 
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' 
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="hidden md:flex items-center gap-4">
               {/* Theme Toggle */}
               <button
                  onClick={toggleTheme}
                  className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Temayı Değiştir"
                >
                  {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>

              <Link href="/auth/login" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
                Giriş Yap
              </Link>
              <Link href="/signup">
                <button className="bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 text-white text-sm font-semibold py-2.5 px-6 rounded-full hover:opacity-90 transition-all shadow-[0_18px_30px_-18px_rgba(14,165,233,0.7)]">
                  Ücretsiz Başlayın
                </button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-600 dark:text-slate-300"
            >
              <Menu size={24} />
            </button>
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
                      <span className="text-sm text-slate-500">Görünüm</span>
                      <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300"
                      >
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                      </button>
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
};
