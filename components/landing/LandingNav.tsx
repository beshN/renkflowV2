'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export default function LandingNav() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    
    handleScroll();
    window.addEventListener('scroll', handleScroll);
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
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={`flex justify-between items-center sticky top-0 z-50 transition-all duration-500 ease-in-out ${
        isScrolled 
          ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg shadow-sm py-4' 
          : 'bg-transparent py-5'
      } container mx-auto px-4 sm:px-6 lg:px-8 max-w-full`}
    >
      <Link href="/" className="flex items-center space-x-3">
        <div className="relative w-96 h-24 transition-all duration-500 ease-in-out">
          <Image
            src="/logo.png"
            alt="Renkflow"
            fill
            className="object-contain object-left"
            priority
          />
        </div>
      </Link>

      <nav className={`hidden md:flex items-center space-x-8 px-6 py-2 rounded-full transition-all duration-500 ease-in-out ${
        isScrolled 
          ? 'bg-transparent border-transparent' 
          : 'bg-white/70 dark:bg-slate-800/50 border border-gray-200 dark:border-gray-700 shadow-sm'
      }`}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm font-medium text-subtle-light dark:text-subtle-dark hover:text-primary dark:hover:text-primary transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center space-x-4">
        <Link href="/auth/login" className="text-sm font-semibold text-subtle-light dark:text-subtle-dark hover:text-primary dark:hover:text-primary transition-colors hidden sm:block">
          Giriş Yap
        </Link>
        <Link href="/signup">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-primary text-white font-semibold py-2.5 px-6 rounded-full shadow-sm hover:shadow-md transition-shadow flex items-center space-x-2"
          >
            <span>Ücretsiz Başlayın</span>
            <span className="material-symbols-outlined !text-xl">arrow_forward</span>
          </motion.button>
        </Link>
      </div>
    </motion.header>
  );
}
