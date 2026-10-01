import Image from 'next/image';
import Logo from './Logo';
import ui from '../landing.module.scss';
import styles from './LandingFooter.module.scss';

export default function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${ui.wrap} ${styles.foot}`}>
        <Logo size={46} />
        <nav className={styles.nav} aria-label="Rodapé">
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
          <a href="#faq">FAQ</a>
          <a href="/terms-of-service">Termos de Serviço e Privacidade</a>
        </nav>
        <div className={styles.maker}>
          <span>Um produto</span>
          <a href="https://www.silfi-tech.net/" aria-label="sil-fi tech">
            <Image src="/brand/silfi-tech.png" alt="sil-fi tech" width={135} height={26} />
          </a>
        </div>
      </div>
      <p className={`${ui.wrap} ${styles.copy}`}>© 2026 Bentifiles. Todos os direitos reservados.</p>
    </footer>
  );
}
