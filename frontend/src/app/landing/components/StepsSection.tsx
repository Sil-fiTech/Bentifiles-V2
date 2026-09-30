import ui from '../landing.module.scss';
import styles from './StepsSection.module.scss';

const steps = [
  {
    n: '01',
    t: 'Crie um projeto',
    d: 'Dê um nome, descreva e convide a equipe. Cada projeto é um espaço isolado, com documentos, membros e templates próprios.',
  },
  {
    n: '02',
    t: 'Solicite os documentos',
    d: 'Defina os tipos de documento e use templates para pedir exatamente o que você precisa, sempre no mesmo padrão.',
  },
  {
    n: '03',
    t: 'Acompanhe os envios',
    d: 'Veja o envio de cada usuário em tempo real e o status de documentos, projetos e membros no painel.',
  },
  {
    n: '04',
    t: 'Valide e decida',
    d: 'A validação automática confere a legibilidade. Depois é com você: aprove ou rejeite, com o histórico organizado no projeto.',
  },
];

export default function StepsSection() {
  return (
    <section className={styles.steps} id="como-funciona">
      <div className={`${ui.wrap} ${styles.grid}`}>
        <div className={styles.side}>
          <p className={ui.kicker}>Como funciona</p>
          <h2>Do pedido à aprovação, num lugar só.</h2>
          <p>Quatro passos para tirar a cobrança de documentos das conversas e das pastas espalhadas.</p>
        </div>
        <ol className={styles.list}>
          {steps.map((s) => (
            <li key={s.n}>
              <span className={styles.n}>{s.n}</span>
              <div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
