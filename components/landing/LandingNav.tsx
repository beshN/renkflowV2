'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

export default function LandingNav() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Özellikler', href: '/features' },
    { label: 'Fiyatlandırma', href: '/pricing' },
    { label: 'Entegrasyonlar', href: '/integrations' },
    { label: 'İletişim', href: '/contact' },
  ];

  return (
    <motion.header 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      className={`flex justify-between items-center sticky top-0 z-50 transition-all duration-700 ease-out ${
        isScrolled 
          ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-sm py-3' 
          : 'bg-transparent py-4'
      } container mx-auto px-4 sm:px-6 lg:px-8 max-w-full`}
    >
      <Link href="/" className="flex items-center">
        <motion.div 
          className="relative h-16"
          style={{ width: '192px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <Image
            src="/logo.png"
            alt="Renkflow"
            fill
            className="object-contain object-left"
            priority
          />
        </motion.div>
      </Link>

      <nav className={`hidden md:flex items-center space-x-8 px-6 py-2 rounded-full transition-all duration-700 ease-out ${
        isScrolled 
          ? 'bg-transparent border-transparent' 
          : 'bg-white/70 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700 shadow-sm'
      }`}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm font-medium text-subtle-light dark:text-subtle-dark hover:text-primary dark:hover:text-primary transition-colors duration-300"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center space-x-4">
        <Link href="/auth/login" className="text-sm font-semibold text-subtle-light dark:text-subtle-dark hover:text-primary dark:hover:text-primary transition-colors duration-300 hidden sm:block">
          Giriş Yap
        </Link>
        <Link href="/signup">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="bg-primary text-white font-semibold py-2.5 px-6 rounded-full shadow-sm hover:shadow-md transition-all duration-300 flex items-center space-x-2"
          >
            <span>Ücretsiz Başlayın</span>
            <span className="material-symbols-outlined !text-xl">arrow_forward</span>
          </motion.button>
        </Link>
      </div>
    </motion.header>
  );
}
