import { MetadataRoute } from 'next';
import { isComingSoonMode } from '@/lib/launch/comingSoonGate';
import { DISALLOWED_ROUTES, PUBLIC_PAGES } from '@/lib/core/site-routes';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://renkflow.com';
  const launchModeEnabled = isComingSoonMode(process.env.PUBLIC_SITE_MODE || 'off');

  if (launchModeEnabled) {
    // Before launch only the home and coming-soon pages are crawlable.
    return {
      rules: [
        {
          userAgent: '*',
          allow: ['/', '/coming-soon'],
          disallow: [...DISALLOWED_ROUTES, ...PUBLIC_PAGES.filter(Boolean), '/careers'],
        },
      ],
      sitemap: `${baseUrl}/sitemap.xml`,
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/auth/login'],
        disallow: DISALLOWED_ROUTES,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
