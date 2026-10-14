import type { Metadata } from 'next';

// URL pública do site. Em outros ambientes (ex.: dev), defina NEXT_PUBLIC_SITE_URL no build.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://bentifiles.com').replace(/\/$/, '');

export const SITE_NAME = 'Bentifiles';

// Open Graph de uma página. O Next substitui o objeto `openGraph` inteiro quando uma página define o seu,
// então siteName/locale e a imagem (src/app/opengraph-image.tsx) precisam ser repetidos aqui.
export function openGraphFor(opts: {
    title: string;
    description: string;
    path: string;
    type?: 'website' | 'article';
}): NonNullable<Metadata['openGraph']> {
    return {
        type: opts.type ?? 'website',
        siteName: SITE_NAME,
        locale: 'pt_BR',
        title: opts.title,
        description: opts.description,
        url: opts.path,
        images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Bentifiles: peça o documento, receba legível' }],
    };
}
