import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDate, getAllPosts } from '@/lib/blog/content';
import { openGraphFor } from '@/lib/seo';
import docs from '@/components/docs/docs.module.scss';
import styles from './blog.module.scss';

const title = 'Blog do Bentifiles: coleta e organização de documentos de clientes';
const description =
    'Guias práticos para escritórios de contabilidade, advocacia e RH pedirem, receberem e conferirem documentos de clientes.';

export const metadata: Metadata = {
    title: { absolute: title },
    description,
    alternates: { canonical: '/blog' },
    openGraph: openGraphFor({ title, description, path: '/blog' }),
};

export default async function BlogIndex() {
    const posts = await getAllPosts();

    return (
        <main className={docs.article}>
            <h1 className={docs.title}>Blog do Bentifiles</h1>
            <p className={docs.lead}>{description}</p>
            <ul className={styles.list}>
                {posts.map((post) => (
                    <li key={post.slug}>
                        <Link href={post.href} className={styles.card}>
                            <time className={styles.date} dateTime={post.updated}>{formatDate(post.updated)}</time>
                            <h2>{post.title}</h2>
                            <p>{post.description}</p>
                        </Link>
                    </li>
                ))}
            </ul>
        </main>
    );
}
