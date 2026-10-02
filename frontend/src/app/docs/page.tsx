import Link from 'next/link';
import { getNav } from '@/lib/docs/content';
import styles from '@/components/docs/docs.module.scss';

export default async function DocsHome() {
    const nav = await getNav();

    return (
        <main className={styles.main} style={{ gridColumn: 'span 2' }}>
            <div className={styles.hero}>
                <p className={styles.crumb}>Documentação</p>
                <h1 className={styles.title}>Como usar o Bentifiles</h1>
                <p className={styles.lead}>
                    Guias passo a passo, em texto e em vídeo, para pedir documentos, enviá-los e acompanhar a validação.
                    Escolha por onde começar.
                </p>
            </div>

            <div className={styles.audience}>
                <Link href="/docs/pedir/criar-um-projeto" className={styles.audienceCard}>
                    <h2>Eu peço documentos</h2>
                    <p>Sou eu quem cria projetos, convida clientes ou colaboradores e revisa o que chega.</p>
                </Link>
                <Link href="/docs/enviar/aceitar-um-convite" className={styles.audienceCard}>
                    <h2>Eu envio documentos</h2>
                    <p>Recebi um convite e preciso enviar meus arquivos.</p>
                </Link>
            </div>

            {nav.map((section) => (
                <section key={section.id} className={styles.sectionList}>
                    <h2>{section.title}</h2>
                    <p>{section.description}</p>
                    <ul className={styles.pageList}>
                        {section.pages.map((page) => (
                            <li key={page.href}>
                                <Link href={page.href}>
                                    <strong>{page.title}</strong>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}

            <p>
                Prefere assistir? Veja <Link href="/docs/videos"><strong>todos os vídeos</strong></Link>.
            </p>
        </main>
    );
}
