'use client';

import {
  FolderKanban,
  Upload,
  LayoutTemplate,
  Tag,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import styles from '../landing.module.scss';

const features = [
  {
    icon: FolderKanban,
    title: 'Gestão completa de projetos',
    desc: 'Crie projetos com estrutura própria, membros dedicados, status e histórico. Cada projeto é um workspace isolado e completo para sua equipe.',
    tag: 'Projetos',
  },
  {
    icon: Upload,
    title: 'Upload e organização de documentos',
    desc: 'Envie arquivos de qualquer formato. Categorize por tipo, associe a projetos e mantenha tudo versionado e rastreável.',
    tag: 'Documentos',
  },
  {
    icon: LayoutTemplate,
    title: 'Templates padronizados',
    desc: 'Defina estruturas reutilizáveis para contratos, relatórios, propostas e muito mais. Garanta consistência sem esforço extra.',
    tag: 'Templates',
  },
  {
    icon: Tag,
    title: 'Categorias e tipos de arquivo',
    desc: 'Classifique documentos por categorias personalizadas e tipos. Filtre e encontre rapidamente o que precisa, mesmo em projetos com centenas de arquivos.',
    tag: 'Organização',
  },
  {
    icon: ShieldCheck,
    title: 'Controle de usuários',
    desc: 'Adicione e remova membros por projeto. Defina permissões claras para garantir que cada pessoa acesse somente o que precisa.',
    tag: 'Segurança',
  },
  {
    icon: Globe,
    title: 'Escalável para equipes e empresas',
    desc: 'Cresceu a equipe? Criou novos projetos? O Bentifiles acompanha seu ritmo sem complicar a operação. Estrutura robusta para negócios em expansão.',
    tag: 'Escala',
  },
];

export default function FeaturesSection() {
  return (
    <section className={styles.features} id="recursos">
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionBadge}>Recursos</div>
          <h2 className={styles.sectionTitle}>
            Uma plataforma,{' '}
            <span className={styles.sectionTitleAccent}>tudo que você precisa</span>
          </h2>
          <p className={styles.sectionSubtitle}>
            Recursos pensados para equipes que precisam de organização real, não só de ferramentas genéricas.
          </p>
        </div>

        <div className={styles.featuresGrid}>
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div className={styles.featureCard} key={i}>
                <div className={styles.featureCardTop}>
                  <div className={styles.featureIconWrap}>
                    <Icon size={20} />
                  </div>
                  <span className={styles.featureTag}>{feature.tag}</span>
                </div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
