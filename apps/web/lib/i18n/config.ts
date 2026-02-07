/**
 * i18n Configuration
 * 
 * Supports:
 * - Turkish (tr) - Default
 * - English (en)
 * - Arabic (ar) - RTL support
 */

export const defaultLocale = 'tr';

export const locales = ['tr', 'en', 'ar'] as const;

export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  tr: 'Türkçe',
  en: 'English',
  ar: 'العربية',
};

export const localeFlags: Record<Locale, string> = {
  tr: '🇹🇷',
  en: '🇬🇧',
  ar: '🇸🇦',
};

export const rtlLocales: Locale[] = ['ar'];

export function isRTL(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

export const i18nConfig = {
  defaultLocale,
  locales,
  localeDetection: true,
};
