import { MetadataRoute } from 'next';
import { isComingSoonMode } from '@/lib/launch/comingSoonGate';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://renkflow.com';
  const launchModeEnabled = isComingSoonMode(process.env.PUBLIC_SITE_MODE || 'off');

  if (launchModeEnabled) {
    const launchRoutes = ['', '/coming-soon'];
    return launchRoutes.map((route) => ({
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
      changeFrequency: route === '' ? 'daily' : 'weekly',
      priority: 1,
    }));
  }
  
  const staticPages = [
    '',
    '/features',
    '/pricing',
    '/integrations',
    '/about',
    '/contact',
    '/faq',
    '/blog',
    '/careers',
    '/privacy',
    '/terms',
    '/cookies',
    '/roadmap',
    '/changelog',
    '/press',
    '/docs',
    '/security',
    '/status',
    '/full-landing',
    '/auth/login',
    '/signup',
  ];

  return staticPages.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route === '/pricing' ? 0.9 : 0.8,
  }));
}
