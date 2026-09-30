import Link from 'next/link';
import ui from '../landing.module.scss';
import styles from './ClosingSection.module.scss';

export default function ClosingSection() {
  return (
    <section className={styles.closing}>
      <div className={`${ui.wrap} ${styles.row}`}>
        <h2>Crie o primeiro projeto e peça o primeiro documento.</h2>
        <div className={styles.act}>
          <p>Comece pelo plano Individual e teste por 10 dias antes do primeiro pagamento.</p>
          <Link className={`${ui.btn} ${ui.btnInk}`} href="/login?mode=register">
            Criar conta
          </Link>
        </div>
      </div>
    </section>
  );
}
