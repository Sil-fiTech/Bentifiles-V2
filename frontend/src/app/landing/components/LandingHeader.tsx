import Link from 'next/link';
import Logo from './Logo';
import RegisterLink from './RegisterLink';
import ui from '../landing.module.scss';
import styles from './LandingHeader.module.scss';

const navLinks = [
  { label: 'Validação', href: '#validacao' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Recursos', href: '#recursos' },
  { label: 'Planos', href: '#planos' },
  { label: 'FAQ', href: '#faq' },
];

const docsHref = '/docs';

export default function LandingHeader() {
  return (
    <header className={styles.top}>
      <div className={`${ui.wrap} ${styles.bar}`}>
        <a href="#inicio" className={styles.brand} aria-label="Bentifiles, início">
          <Logo size={52} />
        </a>
        <nav className={styles.nav} aria-label="Principal">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <Link href={docsHref}>Documentação</Link>
        </nav>
        <div className={styles.actions}>
          <Link className={styles.docs} href={docsHref}>
            Documentação
          </Link>
          <Link className={styles.enter} href="/login">
            Entrar
          </Link>
          <RegisterLink className={`${ui.btn} ${ui.btnAmber} ${styles.cta}`}>
            Criar conta
          </RegisterLink>
        </div>
      </div>
    </header>
  );
}
