/**
 * i18n Configuration Tests
 */

import { defaultLocale, locales, isRTL, localeNames, localeFlags } from '@/lib/i18n/config';

describe('i18n Configuration', () => {
  describe('Locales', () => {
    it('should have Turkish as default locale', () => {
      expect(defaultLocale).toBe('tr');
    });

    it('should support three locales', () => {
      expect(locales).toHaveLength(3);
      expect(locales).toContain('tr');
      expect(locales).toContain('en');
      expect(locales).toContain('ar');
    });

    it('should have names for all locales', () => {
      expect(localeNames.tr).toBe('Türkçe');
      expect(localeNames.en).toBe('English');
      expect(localeNames.ar).toBe('العربية');
    });

    it('should have flags for all locales', () => {
      expect(localeFlags.tr).toBe('🇹🇷');
      expect(localeFlags.en).toBe('🇬🇧');
      expect(localeFlags.ar).toBe('🇸🇦');
    });
  });

  describe('RTL Support', () => {
    it('should identify Arabic as RTL', () => {
      expect(isRTL('ar')).toBe(true);
    });

    it('should identify Turkish as LTR', () => {
      expect(isRTL('tr')).toBe(false);
    });

    it('should identify English as LTR', () => {
      expect(isRTL('en')).toBe(false);
    });
  });
});
