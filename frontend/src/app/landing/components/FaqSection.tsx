import { faqs } from '../data/faqs';
import ui from '../landing.module.scss';
import styles from './FaqSection.module.scss';

export default function FaqSection() {
  return (
    <section className={styles.faq} id="faq">
      <div className={`${ui.wrap} ${styles.grid}`}>
        <div className={styles.side}>
          <p className={ui.kicker}>Perguntas frequentes</p>
          <h2>O que costumam perguntar antes de assinar.</h2>
        </div>
        <div className={styles.list}>
          {faqs.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
