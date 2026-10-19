import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate, getAllPosts, getPost } from '@/lib/blog/content';
import { SITE_URL, openGraphFor } from '@/lib/seo';
import docs from '@/components/docs/docs.module.scss';
import styles from '../blog.module.scss';

type Params = { slug: string };

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
    const posts = await getAllPosts();
    return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
    const { slug } = await params;
    const post = await getPost(slug);
    if (!post) return {};
    const path = `/blog/${slug}`;
    return {
        title: { absolute: post.meta.title },
        description: post.meta.description,
        alternates: { canonical: path },
        openGraph: {
            ...openGraphFor({ title: post.meta.title, description: post.meta.description, path }),
            type: 'article',
            publishedTime: post.meta.date,
            modifiedTime: post.meta.updated,
        },
    };
}

export default async function BlogPost({ params }: { params: Promise<Params> }) {
    const { slug } = await params;
    const post = await getPost(slug);
    if (!post) notFound();
    const { Content, meta } = post;
    const url = `${SITE_URL}/blog/${slug}`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: meta.title,
        description: meta.description,
        datePublished: meta.date,
        dateModified: meta.updated,
        inLanguage: 'pt-BR',
        url,
        mainEntityOfPage: url,
        author: { '@type': 'Organization', name: 'Equipe Bentifiles' },
        publisher: { '@id': `${SITE_URL}/#organization` },
        about: { '@id': `${SITE_URL}/#app` },
    };

    return (
        <main className={docs.article}>
            <script
                type="application/ld+json"
                // `<` escapado para que nenhum texto dos dados feche a tag <script>.
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
            />
            <p className={docs.crumb}><Link href="/blog">Blog</Link></p>
            <h1 className={docs.title}>{meta.title}</h1>
            <p className={docs.lead}>{meta.description}</p>
            <time className={styles.date} dateTime={meta.updated}>Atualizado em {formatDate(meta.updated)}</time>
            <div className={docs.prose}>
                <Content />
            </div>
            <aside className={styles.cta}>
                <strong>Peça o documento. Receba legível.</strong>
                <p>Teste o Bentifiles por 10 dias no plano Individual. Quem envia documentos não paga nada.</p>
                <Link href="/login?mode=register">Criar conta</Link> · <Link href="/#planos">Ver planos</Link>
            </aside>
        </main>
    );
}
