'use client';

import Script, { type ScriptProps } from 'next/script';

// Extended props to include standard HTML script attributes
type ExtendedScriptProps = ScriptProps & React.ScriptHTMLAttributes<HTMLScriptElement>;

export default function GoogleAnalytics({ GA_MEASUREMENT_ID }: { GA_MEASUREMENT_ID: string }) {
  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  if (!/^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID) && !/^UA-\d+-\d+$/i.test(GA_MEASUREMENT_ID)) {
    return null;
  }

  const scriptSrc = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;

  return (
    <>
      <Script
        id="gtag-external"
        strategy="afterInteractive"
        {...({ src: scriptSrc } as ExtendedScriptProps)}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
    </>
  );
}
