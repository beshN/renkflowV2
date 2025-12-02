'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

export default function LandingNav() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const rafId = useRef<number>();

  useEffect(() => {
    const handleScroll = () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
      
      rafId.current = requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 20);
      });
    };
    
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  const navItems = [
    { label: 'Özellikler', href: '/features' },
    { label: 'Fiyatlandırma', href: '/pricing' },
    { label: 'Entegrasyonlar', href: '/integrations' },
    { label: 'İletişim', href: '/contact' },
  ];

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
        isScrolled 
          ? 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-lg' 
          : 'bg-transparent'
      }`}
      style={{ 
        willChange: 'background-color, backdrop-filter, box-shadow',
        transform: 'translateZ(0)',
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-full">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="flex items-center flex-shrink-0 ml-8">
            <div className="relative h-20 transition-all duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)]" style={{ width: '384px' }}>
              <Image
                src="/logo.png"
                alt="Renkflow"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
          </Link>

          <nav className={`hidden md:flex items-center space-x-8 px-6 py-2 rounded-full transition-all duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
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

          <div className="flex items-center space-x-4 flex-shrink-0">
            <Link href="/auth/login" className="text-sm font-semibold text-subtle-light dark:text-subtle-dark hover:text-primary dark:hover:text-primary transition-colors duration-300 hidden sm:block">
              Giriş Yap
            </Link>
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="bg-primary text-white font-semibold py-2.5 px-6 rounded-full shadow-sm hover:shadow-md transition-all duration-300 flex items-center space-x-2"
              >
                <span>Ücretsiz Başlayın</span>
                <span className="material-symbols-outlined !text-xl">arrow_forward</span>
              </motion.button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
