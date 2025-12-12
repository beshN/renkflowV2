import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://renkflow.com';
  
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
