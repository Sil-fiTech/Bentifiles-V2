import type { MetadataRoute } from 'next';
import { getAllPages } from '@/lib/docs/content';
import { SITE_URL } from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const docs = await getAllPages();

    return [
        { url: `${SITE_URL}/`, changeFrequency: 'monthly', priority: 1 },
        { url: `${SITE_URL}/docs`, changeFrequency: 'monthly', priority: 0.7 },
        { url: `${SITE_URL}/docs/videos`, changeFrequency: 'monthly', priority: 0.5 },
        ...docs.map((page) => ({
            url: `${SITE_URL}${page.href}`,
            changeFrequency: 'monthly' as const,
            priority: 0.6,
        })),
        { url: `${SITE_URL}/login`, changeFrequency: 'yearly', priority: 0.3 },
        { url: `${SITE_URL}/terms-of-service`, changeFrequency: 'yearly', priority: 0.2 },
    ];
}
