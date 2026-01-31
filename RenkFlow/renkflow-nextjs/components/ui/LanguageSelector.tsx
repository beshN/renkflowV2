'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n/client';
import { locales, localeNames, localeFlags, Locale } from '@/lib/i18n/config';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'inline';
  showFlag?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function LanguageSelector({
  variant = 'dropdown',
  showFlag = true,
  showLabel = true,
  className = '',
}: LanguageSelectorProps) {
  const { locale, changeLanguage, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = async (newLocale: Locale) => {
    await changeLanguage(newLocale);
    setIsOpen(false);
  };

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleLanguageChange(loc)}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${locale === loc
                ? 'bg-primary text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }
            `}
          >
            {showFlag && <span className="mr-1">{localeFlags[loc]}</span>}
            {showLabel ? localeNames[loc] : loc.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-2 px-3 py-2 rounded-lg
          bg-white dark:bg-slate-800 
          border border-slate-200 dark:border-slate-700
          hover:bg-slate-50 dark:hover:bg-slate-700
          text-slate-700 dark:text-slate-200
          transition-all duration-200
          shadow-sm hover:shadow
        "
        aria-label={t('common.language')}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe size={18} className="text-slate-500 dark:text-slate-400" />
        {showFlag && <span>{localeFlags[locale]}</span>}
        {showLabel && (
          <span className="text-sm font-medium hidden sm:inline">
            {localeNames[locale]}
          </span>
        )}
        <ChevronDown 
          size={16} 
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="
              absolute top-full right-0 mt-2 z-50
              min-w-[160px] py-1
              bg-white dark:bg-slate-800
              border border-slate-200 dark:border-slate-700
              rounded-xl shadow-lg
              overflow-hidden
            "
            role="listbox"
            aria-label={t('common.language')}
          >
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => handleLanguageChange(loc)}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5
                  text-sm font-medium
                  transition-colors duration-150
                  ${locale === loc
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }
                `}
                role="option"
                aria-selected={locale === loc}
              >
                <span className="text-lg">{localeFlags[loc]}</span>
                <span className="flex-1 text-left">{localeNames[loc]}</span>
                {locale === loc && (
                  <Check size={16} className="text-primary" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
