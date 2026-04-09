'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import styles from '../landing.module.scss';

const navLinks = [
  { label: 'Início', href: '#inicio' },
  { label: 'Recursos', href: '#recursos' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Benefícios', href: '#beneficios' },
  { label: 'FAQ', href: '#faq' },
];

export default function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`} id="inicio">
      <div className={styles.headerInner}>
        {/* Logo */}
        <div className={styles.headerLogo}>
          <img src="/favicon.ico" alt="Bentifiles" className={styles.headerLogoImg} />
          <span className={styles.headerLogoText}>
            Benti<span className={styles.headerLogoAccent}>Files</span>
          </span>
        </div>

        {/* Desktop Nav */}
        <nav className={styles.headerNav} aria-label="Navegação principal">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={styles.headerNavLink}
              onClick={(e) => handleNavClick(e, link.href)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA buttons */}
        <div className={styles.headerActions}>
          <button
            className={styles.headerBtnSecondary}
            onClick={() => router.push('/login')}
            id="header-btn-login"
          >
            Entrar
          </button>
          <button
            className={styles.headerBtnPrimary}
            onClick={() => router.push('/login?mode=register')}
            id="header-btn-cta"
          >
            Começar agora
          </button>
        </div>

        {/* Mobile toggle */}
        <button
          className={styles.headerMobileToggle}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
          id="header-mobile-menu-toggle"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className={styles.mobileMenu}>
          <nav className={styles.mobileNav}>
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={styles.mobileNavLink}
                onClick={(e) => handleNavClick(e, link.href)}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className={styles.mobileActions}>
            <button
              className={styles.headerBtnSecondary}
              onClick={() => { setMobileOpen(false); router.push('/login'); }}
            >
              Entrar
            </button>
            <button
              className={styles.headerBtnPrimary}
              onClick={() => { setMobileOpen(false); router.push('/login?mode=register'); }}
            >
              Começar agora
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
