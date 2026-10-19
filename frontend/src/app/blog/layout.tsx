import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import docs from '@/components/docs/docs.module.scss';
import styles from './blog.module.scss';

export const metadata: Metadata = {
    title: { default: 'Blog do Bentifiles', template: '%s — Blog Bentifiles' },
};

// Mesmo visual da documentação (cabeçalho, tipografia e rodapé), sem o menu lateral.
export default function BlogLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={docs.shell}>
            <header className={docs.topbar}>
                <div className={docs.topbarInner}>
                    <Link href="/blog" className={docs.brand}>
                        <Image src="/brand/bentifiles-mark.png" alt="" width={72} height={72} className={docs.brandMark} />
                        <span className={docs.brandName}>Bentifiles</span>
                        <span className={docs.brandSection}>Blog</span>
                    </Link>
                    <nav className={docs.topLinks} aria-label="Acesso">
                        <Link href="/docs" className={docs.topLink}>Documentação</Link>
                        <Link href="/login?mode=register" className={`${docs.topLink} ${docs.topLinkPrimary}`}>Criar conta</Link>
                    </nav>
                </div>
            </header>
            <div className={styles.container}>{children}</div>
            <footer className={docs.footer}>
                Bentifiles é um produto Silfi-Tech. <Link href="/">Conheça a plataforma</Link>.
            </footer>
        </div>
    );
}
