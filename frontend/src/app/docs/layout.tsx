import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { getNav } from '@/lib/docs/content';
import styles from '@/components/docs/docs.module.scss';

export const metadata: Metadata = {
    title: { default: 'Documentação — Bentifiles', template: '%s — Documentação Bentifiles' },
    description: 'Aprenda a usar o Bentifiles: criar projetos, pedir documentos, validar envios e acompanhar tudo em um só lugar.',
};

// Pública de propósito: quem recebe um convite ainda não tem conta e é quem mais precisa de ajuda.
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
    const nav = await getNav();

    return (
        <div className={styles.shell}>
            {/* O globals.scss usa overflow-x: hidden em html/body, o que impede o position: sticky
                (cabeçalho, menu e índice fixos). Aqui, clip evita a rolagem horizontal sem esse efeito. */}
            <style>{'html,body{overflow-x:clip}'}</style>
            <header className={styles.topbar}>
                <div className={styles.topbarInner}>
                    <Link href="/docs" className={styles.brand}>
                        <Image src="/brand/bentifiles-mark.png" alt="" width={72} height={72} className={styles.brandMark} />
                        <span className={styles.brandName}>Bentifiles</span>
                        <span className={styles.brandSection}>Documentação</span>
                    </Link>
                    <nav className={styles.topLinks} aria-label="Acesso">
                        <Link href="/login" className={styles.topLink}>Entrar</Link>
                        <Link href="/dashboard" className={`${styles.topLink} ${styles.topLinkPrimary}`}>Abrir o app</Link>
                    </nav>
                </div>
            </header>
            <div className={styles.grid}>
                <DocsSidebar nav={nav} />
                {children}
            </div>
            <footer className={styles.footer}>
                Bentifiles é um produto Silfi-Tech. Encontrou algo desatualizado? Avise a equipe pelo canal de suporte.
            </footer>
        </div>
    );
}
