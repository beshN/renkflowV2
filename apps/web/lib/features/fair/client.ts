'use client';
import type { DesignItem } from './design';
import type { Locale } from './i18n';

/** On a configurator domain pages live at the root; inside RenkFlow under /configurator. */
export function configuratorBase(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname.startsWith('/configurator') ? '/configurator' : '';
}
export const designPath = (token: string) => `${configuratorBase()}/c/${token}`;
export const designLink = (token: string) => `${window.location.origin}${designPath(token)}`;

type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string };
async function call<T>(url: string, init: RequestInit): Promise<Result<T>> {
  try {
    const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }, cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    return response.ok ? { ok: true, data: body as T } : { ok: false, status: response.status, error: body?.error || response.statusText };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'network' };
  }
}

export type DesignPayload = { token: string; fairCode: string | null; origin: 'kiosk' | 'mobile' | 'web'; locale: Locale; items: DesignItem[] };
export const createDesign = (p: DesignPayload) => call<{ token: string; created: boolean; version: number }>('/api/v1/public/fair/designs', { method: 'POST', body: JSON.stringify(p) });
/** An edit made on version `expectedVersion`; 409 when the design changed elsewhere since. */
export const updateDesign = (token: string, items: DesignItem[], locale: Locale, expectedVersion: number) =>
  call<{ version: number }>(`/api/v1/public/fair/designs/${token}`, { method: 'PUT', body: JSON.stringify({ items, locale, expectedVersion }) });
export const fetchDesign = (token: string) =>
  call<{ design: { items: DesignItem[]; locale: Locale; version: number; fair: { code: string; name: string } | null } }>(`/api/v1/public/fair/designs/${token}`, { method: 'GET' });
export type QuotePayload = {
  token: string; submissionId: string; designVersion: number | null; fairCode: string | null; locale: Locale; items: DesignItem[]; contactName: string; email: string; phone: string; companyName: string;
  location: string; note: string; privacyAccepted: boolean; marketingConsent: boolean; website: string;
};
export const submitQuote = (p: QuotePayload) => call<{ number: string | null; emailStatus: 'sent' | 'failed' | 'not_configured' | 'pending'; designVersion?: number | null }>('/api/v1/public/fair/quotes', { method: 'POST', body: JSON.stringify(p) });

/** The 3D capture is 900 px wide; a 480 px JPEG preview is plenty and keeps requests small. */
export function shrinkPreview(dataUrl: string, width = 480): Promise<string | undefined> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round((width * img.height) / img.width);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const out = canvas.toDataURL('image/jpeg', 0.7);
      resolve(out.length < 290_000 ? out : undefined);
    };
    img.onerror = () => resolve(undefined);
    img.src = dataUrl;
  });
}
