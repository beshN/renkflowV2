'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export default function LandingNav() {
  const pathname = usePathname();
  
  const navItems = [
    { label: 'Özellikler', href: '/features' },
    { label: 'Fiyatlandırma', href: '/pricing' },
    { label: 'Hakkımızda', href: '/about' },
    { label: 'İletişim', href: '/contact' },
  ];

  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <svg className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
              <path d="M2 7L12 12L22 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
              <path d="M12 22V12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
            </svg>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">Renkflow</span>
          </Link>

          {/* Nav Items */}
          <nav className="hidden md:flex items-center space-x-8 bg-gray-50/70 dark:bg-gray-800/50 px-6 py-2 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors relative group ${
                  pathname === item.href
                    ? 'text-primary'
                    : 'text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary'
                }`}
              >
                {item.label}
                {pathname === item.href && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center space-x-4">
            <Link href="/login" className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors hidden sm:block">
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
        </div>
      </div>
    </motion.header>
  );
}
