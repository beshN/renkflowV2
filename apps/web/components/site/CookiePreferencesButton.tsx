'use client';

import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_KEY } from '@/components/features/analytics/GoogleAnalytics';

/** Forgets the visitor's cookie choice and the analytics cookies, so the banner asks again. */
export function CookiePreferencesButton() {
  const reset = () => {
    try { localStorage.removeItem(COOKIE_CONSENT_KEY); } catch { /* storage blocked: nothing was kept */ }
    const host = window.location.hostname;
    const parent = host.split('.').slice(-2).join('.');
    document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((name) => name.startsWith('_ga')).forEach((name) => {
      for (const domain of ['', `; domain=${host}`, `; domain=.${parent}`]) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
      }
    });
    window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
    window.location.reload();
  };
  return (
    <button type="button" onClick={reset} className="x-btn x-btn-quiet mt-8">
      Çerez tercihlerini sıfırla
    </button>
  );
}
