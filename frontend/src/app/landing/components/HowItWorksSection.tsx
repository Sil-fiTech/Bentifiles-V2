'use client';

import { FolderPlus, LayoutTemplate, Upload, BarChart2 } from 'lucide-react';
import styles from '../landing.module.scss';

const steps = [
  {
    number: '01',
    icon: FolderPlus,
    title: 'Crie um projeto',
    desc: 'Inicie um projeto em segundos. Dê um nome, adicione uma descrição e convide sua equipe para colaborar.',
  },
  {
    number: '02',
    icon: LayoutTemplate,
    title: 'Defina templates e tipos',
    desc: 'Configure os tipos de documento e crie templates padronizados para que todo novo arquivo siga sua estrutura.',
  },
  {
    number: '03',
    icon: Upload,
    title: 'Organize e faça uploads',
    desc: 'Envie documentos diretamente pela plataforma, categorize por tipo e associe cada arquivo ao projeto correto.',
  },
  {
    number: '04',
    icon: BarChart2,
    title: 'Acompanhe tudo em um lugar',
    desc: 'Visualize o status de todos os documentos, projetos e membros no seu dashboard centralizado.',
  },
];

export default function HowItWorksSection() {
  return (
    <section className={styles.howItWorks} id="como-funciona">
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionBadge}>Como funciona</div>
          <h2 className={styles.sectionTitle}>
            Simples do início{' '}
            <span className={styles.sectionTitleAccent}>ao fim</span>
          </h2>
          <p className={styles.sectionSubtitle}>
            Em apenas quatro passos, sua equipe já estará organizando documentos de forma profissional e escalável.
          </p>
        </div>

        <div className={styles.stepsGrid}>
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div className={styles.stepCard} key={i}>
                <div className={styles.stepNumber}>{step.number}</div>
                <div className={styles.stepIconWrap}>
                  <Icon size={24} />
                </div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.desc}</p>
                {i < steps.length - 1 && (
                  <div className={styles.stepConnector} aria-hidden="true">→</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
