'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, LogIn } from 'lucide-react';
import styles from '../landing.module.scss';

export default function CtaSection() {
  const router = useRouter();

  return (
    <section className={styles.cta} id="cta-section">
      <div className={styles.ctaOrb1} />
      <div className={styles.ctaOrb2} />

      <div className={styles.ctaContent}>
        <h2 className={styles.ctaTitle}>
          Pronto para organizar<br />
          <span className={styles.ctaTitleAccent}>de vez seus projetos?</span>
        </h2>
        <p className={styles.ctaSubtitle}>
          Comece agora, sem complicação. Crie sua conta gratuitamente e experimente
          uma nova forma de trabalhar com documentos.
        </p>

        <div className={styles.ctaButtons}>
          <button
            className={styles.ctaBtnPrimary}
            onClick={() => router.push('/login?mode=register')}
            id="cta-btn-register"
          >
            Começar agora
            <ArrowRight size={18} />
          </button>
          <button
            className={styles.ctaBtnSecondary}
            onClick={() => router.push('/login')}
            id="cta-btn-login"
          >
            <LogIn size={16} />
            Acessar plataforma
          </button>
        </div>
      </div>
    </section>
  );
}
