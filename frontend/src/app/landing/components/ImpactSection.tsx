'use client';

import styles from '../landing.module.scss';

const impacts = [
  {
    value: 'Projetos',
    label: 'mais organizados',
    desc: 'Cada projeto tem sua própria estrutura, membros e documentos — sem mistura, sem confusão.',
    emoji: '📁',
  },
  {
    value: 'Menos tempo',
    label: 'procurando arquivos',
    desc: 'Categorias, tipos e busca inteligente tornam a localização de qualquer arquivo quase instantânea.',
    emoji: '⚡',
  },
  {
    value: 'Mais',
    label: 'padronização documental',
    desc: 'Templates garantem que todos os documentos da equipe sigam o mesmo formato — sempre.',
    emoji: '✅',
  },
  {
    value: 'Fluxo',
    label: 'mais claro para equipes',
    desc: 'Os membros do projeto sabem exatamente onde encontrar e onde colocar cada documento.',
    emoji: '🤝',
  },
];

export default function ImpactSection() {
  return (
    <section className={styles.impact}>
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionBadge}>Resultados</div>
          <h2 className={styles.sectionTitle}>
            O impacto que você{' '}
            <span className={styles.sectionTitleAccent}>vai sentir</span>
          </h2>
          <p className={styles.sectionSubtitle}>
            Adotar o Bentifiles não é só trocar de ferramenta.
            É transformar a forma como sua equipe trabalha com documentos.
          </p>
        </div>

        <div className={styles.impactGrid}>
          {impacts.map((item, i) => (
            <div className={styles.impactCard} key={i}>
              <div className={styles.impactEmoji}>{item.emoji}</div>
              <div className={styles.impactText}>
                <span className={styles.impactValue}>{item.value}</span>
                <span className={styles.impactLabel}>{item.label}</span>
              </div>
              <p className={styles.impactDesc}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
