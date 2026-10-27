'use client';
import { configuratorBase } from '@/lib/features/fair/client';

/** Loads every 3D module now, so the worker caches them before the connection drops. */
async function warm3d() {
  await Promise.allSettled([
    import('@/lib/features/product-3d/stage'),
    import('@/lib/features/product-3d/model'),
    import('@/lib/features/product-3d/roof-model'),
    import('@/lib/features/product-3d/glass-model'),
    import('@/lib/features/product-3d/screen-model'),
    import('@/lib/features/awning/scene'),
  ]);
}

/**
 * Registers the configurator's service worker (production builds only) and hands it everything
 * this page has loaded, so the kiosk keeps working without a connection.
 */
export async function registerConfiguratorWorker(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return false;
  try {
    const registration = await navigator.serviceWorker.register('/configurator-sw.js', { scope: configuratorBase() ? '/configurator/' : '/' });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
        window.setTimeout(resolve, 3000);
      });
    await warm3d();
    const urls = new Set<string>([window.location.href.split('#')[0]]);
    for (const entry of performance.getEntriesByType('resource')) if (entry.name.startsWith(`${window.location.origin}/_next/`)) urls.add(entry.name);
    (navigator.serviceWorker.controller ?? registration.active)?.postMessage({ type: 'warm', urls: [...urls] });
    return true;
  } catch {
    return false;
  }
}
