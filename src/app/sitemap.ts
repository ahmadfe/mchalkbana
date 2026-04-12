import { MetadataRoute } from 'next';
import { CITIES } from '@/lib/cities';

const BASE = 'https://www.uppsalahalkbana.se';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    { path: '/sv',          priority: 1.0, freq: 'weekly'  as const },
    { path: '/sv/courses',  priority: 0.9, freq: 'daily'   as const },
    { path: '/sv/faq',      priority: 0.8, freq: 'monthly' as const },
    { path: '/sv/about',    priority: 0.7, freq: 'monthly' as const },
    { path: '/sv/contact',  priority: 0.7, freq: 'monthly' as const },
  ];

  const cityPages = CITIES.map((city) => ({
    url: `${BASE}/sv/riskutbildning/${city.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [
    ...staticPages.map((p) => ({
      url: `${BASE}${p.path}`,
      lastModified: new Date(),
      changeFrequency: p.freq,
      priority: p.priority,
    })),
    ...cityPages,
  ];
}
