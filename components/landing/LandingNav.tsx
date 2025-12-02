'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export default function LandingNav() {
  const pathname = usePathname();
  
  const navItems = [
    { label: 'Özellikler', href: '/features' },
    { label: 'Fiyatlandırma', href: '/pricing' },
    { label: 'Entegrasyonlar', href: '#' },
    { label: 'İletişim', href: '/contact' },
  ];

  return (
    <motion.header 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="py-6 flex justify-between items-center sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md container mx-auto px-4 sm:px-6 lg:px-8"
    >
      <Link href="/" className="flex items-center space-x-3">
        <div className="relative w-32 h-10">
          <Image
            src="/logo.png"
            alt="Renkflow"
            fill
            className="object-contain object-left"
            priority
          />
        </div>
      </Link>

      <nav className="hidden md:flex items-center space-x-8 bg-white/70 dark:bg-slate-800/50 px-6 py-2 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
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
