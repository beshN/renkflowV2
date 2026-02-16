'use client';

import { useEffect } from 'react';

export function ServiceWorkerUnregister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const RELOAD_MARKER = 'rf.sw.cleaned.v2';

    const unregisterServiceWorkers = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length === 0) return;

        await Promise.all(
          registrations.map((registration) =>
            registration.unregister().catch(() => false),
          ),
        );

        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
        }

        if (!sessionStorage.getItem(RELOAD_MARKER)) {
          sessionStorage.setItem(RELOAD_MARKER, '1');
          window.location.reload();
        }
      } catch (error) {
        console.warn('[ServiceWorkerUnregister] Cleanup failed:', error);
      }
    };

    void unregisterServiceWorkers();
  }, []);

  return null;
}
