import { MetadataRoute } from 'next';
import { isComingSoonMode } from '@/lib/launch/comingSoonGate';

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
    return {
      rules: [
        {
          userAgent: '*',
          allow: ['/', '/coming-soon'],
          disallow: [
            '/api/',
            '/auth/',
            '/dashboard/',
            '/orders/',
            '/new-order/',
            '/settings/',
            '/accounting/',
            '/analytics/',
            '/crm/',
            '/finance/',
            '/inventory/',
            '/kanban/',
            '/members/',
            '/notifications/',
            '/reports/',
            '/search/',
            '/suppliers/',
            '/team/',
            '/about',
            '/blog',
            '/careers',
            '/changelog',
            '/contact',
            '/cookies',
            '/docs',
            '/faq',
            '/features',
            '/full-landing',
            '/integrations',
            '/press',
            '/pricing',
            '/privacy',
            '/roadmap',
            '/security',
            '/signup',
            '/status',
            '/terms',
          ],
        },
      ],
      sitemap: `${baseUrl}/sitemap.xml`,
    };
  }
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/orders/',
          '/new-order/',
          '/settings/',
          '/auth/verify',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
