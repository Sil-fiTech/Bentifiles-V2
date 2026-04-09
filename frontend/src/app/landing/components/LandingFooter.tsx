'use client';

import styles from '../landing.module.scss';

const footerLinks = [
  { label: 'Início', href: '#inicio' },
  { label: 'Recursos', href: '#recursos' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'FAQ', href: '#faq' },
];

export default function LandingFooter() {
  const year = new Date().getFullYear();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <div className={styles.footerLogo}>
            <img src="/favicon.ico" alt="Bentifiles" className={styles.footerLogoImg} />
            <span className={styles.footerLogoText}>
              Benti<span className={styles.footerLogoAccent}>Files</span>
            </span>
          </div>
          <p className={styles.footerTagline}>
            Documentos organizados. Equipes produtivas.
          </p>
        </div>

        <nav className={styles.footerNav} aria-label="Links do rodapé">
          {footerLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={styles.footerNavLink}
              onClick={(e) => handleNavClick(e, link.href)}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <div className={styles.footerBottom}>
        <span className={styles.footerCopy}>
          © {year} Bentifiles. Todos os direitos reservados.
        </span>
      </div>
    </footer>
  );
}
