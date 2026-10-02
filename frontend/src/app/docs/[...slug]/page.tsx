import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Video } from '@/components/docs/Video';
import { getAllPages, getNeighbours, getPage, getToc } from '@/lib/docs/content';
import { SECTIONS } from '@/lib/docs/sections';
import styles from '@/components/docs/docs.module.scss';

type Params = { slug: string[] };

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
    const pages = await getAllPages();
    return pages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
    const { slug } = await params;
    const page = await getPage(slug);
    if (!page) return {};
    return { title: page.meta.title, description: page.meta.description };
}

export default async function DocPage({ params }: { params: Promise<Params> }) {
    const { slug } = await params;
    const page = await getPage(slug);
    if (!page) notFound();

    const { Content, meta, file } = page;
    const href = `/docs/${file}`;
    const toc = getToc(file);
    const { prev, next } = await getNeighbours(href);
    const section = SECTIONS.find((s) => s.id === slug[0]);

    return (
        <>
            <main className={styles.main}>
                <article className={styles.article}>
                    <p className={styles.crumb}>{section?.title}</p>
                    <h1 className={styles.title}>{meta.title}</h1>
                    <p className={styles.lead}>{meta.description}</p>

                    <Video id={meta.video} title={`Vídeo: ${meta.title}`} duration={meta.duration} />

                    <div className={styles.prose}>
                        <Content />
                    </div>

                    <nav className={styles.pager} aria-label="Páginas vizinhas">
                        {prev && (
                            <Link href={prev.href} className={styles.pagerLink}>
                                <span>Anterior</span>
                                <strong>{prev.title}</strong>
                            </Link>
                        )}
                        {next && (
                            <Link href={next.href} className={`${styles.pagerLink} ${styles.pagerNext}`}>
                                <span>Próxima</span>
                                <strong>{next.title}</strong>
                            </Link>
                        )}
                    </nav>
                </article>
            </main>

            <aside className={styles.toc} aria-label="Nesta página">
                {toc.length > 0 && (
                    <>
                        <p>Nesta página</p>
                        <ul>
                            {toc.map((item) => (
                                <li key={item.id}><a href={`#${item.id}`}>{item.text}</a></li>
                            ))}
                        </ul>
                    </>
                )}
            </aside>
        </>
    );
}
