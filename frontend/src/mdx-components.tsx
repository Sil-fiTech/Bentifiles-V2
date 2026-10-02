import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { slugify } from '@/lib/docs/slugify';
import { Callout } from '@/components/docs/Callout';
import { Video } from '@/components/docs/Video';
import { Steps } from '@/components/docs/Steps';

function textOf(children: ReactNode): string {
    if (typeof children === 'string' || typeof children === 'number') return String(children);
    if (Array.isArray(children)) return children.map(textOf).join('');
    if (children && typeof children === 'object' && 'props' in children) {
        return textOf((children as { props: { children?: ReactNode } }).props.children);
    }
    return '';
}

// Componentes disponíveis em todos os arquivos .mdx de /docs, sem precisar importar.
export function useMDXComponents(components: MDXComponents): MDXComponents {
    return {
        h2: ({ children }) => <h2 id={slugify(textOf(children))}>{children}</h2>,
        h3: ({ children }) => <h3 id={slugify(textOf(children))}>{children}</h3>,
        a: ({ href = '', children }) =>
            href.startsWith('/') || href.startsWith('#') ? (
                <Link href={href}>{children}</Link>
            ) : (
                <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            ),
        Video,
        Callout,
        Steps,
        ...components,
    };
}
