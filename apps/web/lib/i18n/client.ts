/**
 * i18n Client Configuration
 * 
 * React-i18next setup for client-side translations
 */

'use client';

import React from 'react';
import i18n from 'i18next';
import { initReactI18next, useTranslation as useI18nTranslation } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { defaultLocale, locales, Locale, isRTL } from './config';

// ============================================
// Static Locale Imports (SSR-safe)
// ============================================
// All locales are statically imported to ensure SSR compatibility.
// Dynamic import() can cause hydration mismatches in Next.js SSR.
// Bundle size impact is minimal (~15KB per locale for JSON).

import trTranslations from './locales/tr.json';
import enTranslations from './locales/en.json';
import arTranslations from './locales/ar.json';

// ============================================
// Resources (all locales pre-loaded for SSR)
// ============================================

const resources = {
  tr: { translation: trTranslations },
  en: { translation: enTranslations },
  ar: { translation: arTranslations },
};

const localeSet = new Set<string>(locales);

export function normalizeLocale(locale?: string | null): Locale {
  if (!locale) return defaultLocale;
  const normalized = locale.toLowerCase().replace('_', '-');
  if (localeSet.has(normalized)) {
    return normalized as Locale;
  }
  const baseLocale = normalized.split('-')[0];
  if (localeSet.has(baseLocale)) {
    return baseLocale as Locale;
  }
  return defaultLocale;
}

/**
 * Get translations for a locale (sync, SSR-safe)
 */
export function getLocaleTranslations(locale: Locale): Record<string, unknown> {
  return resources[locale]?.translation || resources[defaultLocale].translation;
}

// ============================================
// Initialization
// ============================================

let isInitialized = false;

export function initI18n(): typeof i18n {
  if (isInitialized) return i18n;

  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: defaultLocale,
      supportedLngs: locales,
      nonExplicitSupportedLngs: true,
      load: 'languageOnly',
      
      interpolation: {
        escapeValue: false,
      },

      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        caches: ['localStorage'],
        lookupLocalStorage: 'renkflow-language',
      },

      react: {
        useSuspense: false,
      },
    });

  isInitialized = true;
  return i18n;
}

// Initialize on import
if (typeof window !== 'undefined') {
  initI18n();
}

// ============================================
// Hooks
// ============================================

/**
 * useTranslation hook with type safety (SSR-safe)
 * All locales are pre-loaded, no dynamic imports needed
 */
export function useTranslation(namespace?: string) {
  const { t, i18n: i18nInstance, ready } = useI18nTranslation(namespace);
  
  const currentLocale = normalizeLocale(i18nInstance.language);
  const isRtl = isRTL(currentLocale);

  const changeLanguage = React.useCallback(async (locale: Locale) => {
    // All locales are already loaded (static imports)
    const normalizedLocale = normalizeLocale(locale);
    await i18nInstance.changeLanguage(normalizedLocale);
    
    // Update document direction for RTL languages
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRTL(normalizedLocale) ? 'rtl' : 'ltr';
      document.documentElement.lang = normalizedLocale;
    }
  }, [i18nInstance]);

  return {
    t,
    i18n: i18nInstance,
    ready,
    locale: currentLocale,
    isRtl,
    changeLanguage,
  };
}

/**
 * Dynamically load RTL stylesheet
 */
function loadRTLStyles(): void {
  if (typeof document === 'undefined') return;
  
  const rtlStyleId = 'rtl-styles';
  if (document.getElementById(rtlStyleId)) return;
  
  const link = document.createElement('link');
  link.id = rtlStyleId;
  link.rel = 'stylesheet';
  link.href = '/globals.rtl.css';
  document.head.appendChild(link);
}

/**
 * Get current locale
 */
export function getCurrentLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  return normalizeLocale(i18n.language);
}

/**
 * Change language
 */
export async function changeLanguage(locale: Locale): Promise<void> {
  const normalizedLocale = normalizeLocale(locale);
  await i18n.changeLanguage(normalizedLocale);
  
  if (typeof document !== 'undefined') {
    document.documentElement.dir = isRTL(normalizedLocale) ? 'rtl' : 'ltr';
    document.documentElement.lang = normalizedLocale;
  }
}

// ============================================
// Export i18n instance
// ============================================

export { i18n };
