import RegisterLink from './RegisterLink';
import ui from '../landing.module.scss';
import styles from './ClosingSection.module.scss';

export default function ClosingSection() {
  return (
    <section className={styles.closing}>
      <div className={`${ui.wrap} ${styles.row}`}>
        <h2>Crie o primeiro projeto e peça o primeiro documento.</h2>
        <div className={styles.act}>
          <p>Comece pelo plano Individual e teste por 10 dias antes do primeiro pagamento.</p>
          <RegisterLink className={`${ui.btn} ${ui.btnInk}`}>
            Criar conta
          </RegisterLink>
        </div>
      </div>
    </section>
  );
}
