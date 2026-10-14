import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Áreas logadas e rotas internas ficam fora do índice; landing, documentação e termos são públicos.
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/api/',
                    '/dashboard',
                    '/projects',
                    '/admin',
                    '/profile',
                    '/subscription',
                    '/billing',
                    '/plans',
                    '/afiliado',
                    '/verify-email',
                ],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
