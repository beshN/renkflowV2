'use client';

import { ReactNode, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { i18n, initI18n } from './client';
import { isRTL, Locale } from './config';

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  useEffect(() => {
    // Initialize i18n
    initI18n();

    // Set initial direction based on language
    const currentLocale = i18n.language as Locale;
    document.documentElement.dir = isRTL(currentLocale) ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLocale;

    // Listen for language changes
    const handleLanguageChange = (lng: string) => {
      const locale = lng as Locale;
      document.documentElement.dir = isRTL(locale) ? 'rtl' : 'ltr';
      document.documentElement.lang = locale;
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  );
}
