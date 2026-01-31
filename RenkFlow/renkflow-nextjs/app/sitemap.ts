import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://renkflow.com';
  
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
