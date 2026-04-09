'use client';

import {
  FolderOpen,
  FileText,
  LayoutTemplate,
  Users,
  Zap,
  Search,
} from 'lucide-react';
import styles from '../landing.module.scss';

const benefits = [
  {
    icon: FolderOpen,
    title: 'Organização centralizada',
    desc: 'Reúna todos os documentos do seu time em um único lugar, estruturados por projeto e categoria.',
    color: '#f59e0b',
  },
  {
    icon: LayoutTemplate,
    title: 'Padronização com templates',
    desc: 'Crie e reutilize templates para garantir que todos os documentos sigam o mesmo padrão corporativo.',
    color: '#6d28d9',
  },
  {
    icon: Users,
    title: 'Colaboração eficiente',
    desc: 'Adicione membros ao projeto, defina permissões e trabalhe em conjunto sem e-mails perdidos.',
    color: '#0ea5e9',
  },
  {
    icon: Zap,
    title: 'Menos retrabalho',
    desc: 'Com processos padronizados e histórico organizado, sua equipe para de repetir tarefas já feitas.',
    color: '#10b981',
  },
  {
    icon: Search,
    title: 'Encontre qualquer arquivo',
    desc: 'Busca inteligente e categorização por tipo, projeto e data para achar o documento certo rapidamente.',
    color: '#ef4444',
  },
  {
    icon: FileText,
    title: 'Gestão por projeto',
    desc: 'Cada projeto tem seu próprio espaço, com documentos, membros e templates independentes.',
    color: '#f59e0b',
  },
];

export default function BenefitsSection() {
  return (
    <section className={styles.benefits} id="beneficios">
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionBadge}>Benefícios</div>
          <h2 className={styles.sectionTitle}>
            Tudo que sua equipe precisa para{' '}
            <span className={styles.sectionTitleAccent}>trabalhar melhor</span>
          </h2>
          <p className={styles.sectionSubtitle}>
            O Bentifiles foi desenhado para eliminar o caos documental das equipes e trazer clareza,
            consistência e velocidade ao seu fluxo de trabalho.
          </p>
        </div>

        <div className={styles.benefitsGrid}>
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <div className={styles.benefitCard} key={i}>
                <div
                  className={styles.benefitIconWrap}
                  style={{ '--card-color': b.color } as React.CSSProperties}
                >
                  <Icon size={22} />
                </div>
                <h3 className={styles.benefitTitle}>{b.title}</h3>
                <p className={styles.benefitDesc}>{b.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
