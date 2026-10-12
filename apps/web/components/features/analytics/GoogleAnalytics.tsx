'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

// Cast Script to a narrowed type to keep TS happy with inline analytics snippets.
const ScriptComponent = Script as React.ComponentType<{
  id?: string;
  strategy?: 'afterInteractive' | 'lazyOnload' | 'beforeInteractive' | 'worker';
  src?: string;
  children?: React.ReactNode;
}>;

export const COOKIE_CONSENT_KEY = 'cookie-consent';
export const COOKIE_CONSENT_EVENT = 'cookie-consent-change';

function hasAnalyticsConsent() {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    return Boolean(raw && JSON.parse(raw)?.analytics === true);
  } catch {
    return false;
  }
}

export default function GoogleAnalytics({ GA_MEASUREMENT_ID }: { GA_MEASUREMENT_ID: string }) {
  // Analytics only loads after the visitor accepts analytics cookies (KVKK / cookie policy).
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const sync = () => setConsented(hasAnalyticsConsent());
    sync();
    window.addEventListener(COOKIE_CONSENT_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!GA_MEASUREMENT_ID || !consented) {
    return null;
  }

  if (!/^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID) && !/^UA-\d+-\d+$/i.test(GA_MEASUREMENT_ID)) {
    return null;
  }

  return (
    <>
      <ScriptComponent
        id="gtag-external"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <ScriptComponent
        id="google-analytics"
        strategy="afterInteractive"
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
            anonymize_ip: true,
          });
        `}
      </ScriptComponent>
    </>
  );
}
