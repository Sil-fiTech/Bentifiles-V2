'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Search, X } from 'lucide-react';
import styles from './docs.module.scss';

interface NavSection {
    id: string;
    title: string;
    pages: { title: string; href: string }[];
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function DocsSidebar({ nav }: { nav: NavSection[] }) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const q = norm(query.trim());
    const sections = nav
        .map((s) => ({ ...s, pages: q ? s.pages.filter((p) => norm(p.title).includes(q)) : s.pages }))
        .filter((s) => s.pages.length > 0);

    return (
        <>
            <button type="button" className={styles.menuToggle} onClick={() => setOpen(true)} aria-expanded={open} aria-controls="docs-nav">
                <Menu size={16} aria-hidden="true" /> Menu da documentação
            </button>

            {open && <div className={styles.scrim} onClick={() => setOpen(false)} aria-hidden="true" />}

            <nav id="docs-nav" aria-label="Documentação" className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarHead}>
                    <div className={styles.search}>
                        <Search size={15} aria-hidden="true" />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar página..."
                            aria-label="Buscar página da documentação"
                        />
                    </div>
                    <button type="button" className={styles.sidebarClose} onClick={() => setOpen(false)} aria-label="Fechar menu">
                        <X size={18} />
                    </button>
                </div>

                <Link href="/docs/videos" onClick={() => setOpen(false)} className={`${styles.navLink} ${pathname === '/docs/videos' ? styles.navActive : ''}`}>
                    Todos os vídeos
                </Link>

                {sections.map((section) => (
                    <div key={section.id} className={styles.navSection}>
                        <p className={styles.navSectionTitle}>{section.title}</p>
                        <ul>
                            {section.pages.map((page) => (
                                <li key={page.href}>
                                    <Link
                                        href={page.href}
                                        onClick={() => setOpen(false)}
                                        className={`${styles.navLink} ${pathname === page.href ? styles.navActive : ''}`}
                                        aria-current={pathname === page.href ? 'page' : undefined}
                                    >
                                        {page.title}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}

                {q && sections.length === 0 && <p className={styles.navEmpty}>Nenhuma página encontrada.</p>}
            </nav>
        </>
    );
}
