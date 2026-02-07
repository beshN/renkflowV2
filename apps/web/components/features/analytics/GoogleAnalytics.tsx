'use client';

import Script from 'next/script';

export default function GoogleAnalytics({ GA_MEASUREMENT_ID }: { GA_MEASUREMENT_ID: string }) {
  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  if (!/^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID) && !/^UA-\d+-\d+$/i.test(GA_MEASUREMENT_ID)) {
    return null;
  }

  return (
    <>
      <Script
        id="gtag-external"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}
