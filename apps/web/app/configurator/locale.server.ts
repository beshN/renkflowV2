import 'server-only';
import { headers } from 'next/headers';
import { isLocale, type Locale } from '@/lib/features/fair/i18n';

/** The visitor's language from the browser (en / de / tr), English otherwise. */
export async function browserLocale(): Promise<Locale> {
  const accepted = (await headers()).get('accept-language') || '';
  for (const part of accepted.split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return 'en';
}
