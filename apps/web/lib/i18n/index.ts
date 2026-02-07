/**
 * i18n Module Exports
 */

export { defaultLocale, locales, localeNames, localeFlags, isRTL, i18nConfig } from './config';
export type { Locale } from './config';

export { useTranslation, getCurrentLocale, changeLanguage, i18n, initI18n } from './client';

export { I18nProvider } from './provider';
