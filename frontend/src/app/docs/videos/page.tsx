import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPages } from '@/lib/docs/content';
import { SECTIONS } from '@/lib/docs/sections';
import styles from '@/components/docs/docs.module.scss';

export const metadata: Metadata = {
    title: 'Vídeos',
    description: 'Todos os vídeos tutoriais do Bentifiles, organizados por tema.',
};

export default async function VideosPage() {
    const pages = await getAllPages();
    const ready = pages.filter((p) => p.video).length;

    return (
        <main className={styles.main} style={{ gridColumn: 'span 2' }}>
            <div className={styles.hero}>
                <p className={styles.crumb}>Documentação</p>
                <h1 className={styles.title}>Vídeos</h1>
                <p className={styles.lead}>
                    Cada guia tem um vídeo curto no topo da página. {ready > 0 ? `${ready} de ${pages.length} já estão no ar.` : 'Os vídeos estão sendo gravados e aparecem aqui assim que forem publicados.'}
                </p>
            </div>

            {SECTIONS.map((section) => {
                const list = pages.filter((p) => p.section === section.id);
                if (list.length === 0) return null;
                return (
                    <section key={section.id} className={styles.sectionList}>
                        <h2>{section.title}</h2>
                        <div className={styles.videoGrid} style={{ marginTop: '0.75rem' }}>
                            {list.map((p) => (
                                <Link key={p.href} href={p.href} className={styles.videoCard}>
                                    <span className={`${styles.badge} ${p.video ? styles.badgeReady : styles.badgeSoon}`}>
                                        {p.video ? `Disponível${p.duration ? ` · ${p.duration}` : ''}` : 'Em breve'}
                                    </span>
                                    <strong>{p.title}</strong>
                                    <p>{p.description}</p>
                                </Link>
                            ))}
                        </div>
                    </section>
                );
            })}
        </main>
    );
}
