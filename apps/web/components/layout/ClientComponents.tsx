'use client';

import dynamic from 'next/dynamic';

// Lazy load non-critical components for better initial load
// These use ssr: false which requires a Client Component

const CookieConsent = dynamic(
  () => import('@/components/ui/CookieConsent'), 
  {
    ssr: false,
    loading: () => null,
  }
);

const PWAInstallPrompt = dynamic(
  () => import('@/components/ui/PWAInstallPrompt'), 
  {
    ssr: false,
    loading: () => null,
  }
);

export function ClientComponents() {
  return (
    <>
      <CookieConsent />
      <PWAInstallPrompt />
    </>
  );
}
