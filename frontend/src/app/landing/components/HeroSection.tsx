'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronRight, FolderOpen, FileText, LayoutGrid, Users } from 'lucide-react';
import styles from '../landing.module.scss';

export default function HeroSection() {
  const router = useRouter();

  const handleScrollToFeatures = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.querySelector('#recursos');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className={styles.hero} id="hero-section">
      {/* Background orbs */}
      <div className={styles.heroOrb1} />
      <div className={styles.heroOrb2} />
      <div className={styles.heroGrid} />

      <div className={styles.heroContent}>
        {/* Left column */}
        <div className={styles.heroText}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Plataforma de Gestão Documental
          </div>

          <h1 className={styles.heroTitle}>
            Garanta imagens{' '}
            <span className={styles.heroTitleAccent}>legíveis</span>
            {' '}antes que elas travem sua operação
          </h1>

          <p className={styles.heroSubtitle}>
            O Bentifiles valida automaticamente a legibilidade das imagens, gerencia os uploads e centraliza os arquivos em um só lugar.
            Além disso, renomeia cada documento para manter o fluxo organizado e sem retrabalho.
          </p>

          <div className={styles.heroCtas}>
            <button
              className={styles.heroCtaPrimary}
              onClick={() => router.push('/login?mode=register')}
              id="hero-cta-primary"
            >
              Começar agora
              <ArrowRight size={18} />
            </button>
            <button
              className={styles.heroCtaSecondary}
              onClick={handleScrollToFeatures}
              id="hero-cta-secondary"
            >
              Ver recursos
              <ChevronRight size={16} />
            </button>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>24/7</span>
              <span className={styles.heroStatLabel}>Validação</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>-</span>
              <span className={styles.heroStatLabel}>Menos falhas</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatValue}>+</span>
              <span className={styles.heroStatLabel}>Fluxo contínuo</span>
            </div>
          </div>
        </div>

        {/* Right column - Dashboard mockup */}
        <div className={styles.heroVisual}>
          <div className={styles.dashboardMockup}>
            {/* Mockup header */}
            <div className={styles.mockupHeader}>
              <div className={styles.mockupDots}>
                <span className={styles.mockupDot} style={{ background: '#ef4444' }} />
                <span className={styles.mockupDot} style={{ background: '#f59e0b' }} />
                <span className={styles.mockupDot} style={{ background: '#10b981' }} />
              </div>
              <div className={styles.mockupTitle}>Dashboard - Bentifiles</div>
            </div>

            {/* Mockup body */}
            <div className={styles.mockupBody}>
              {/* Sidebar */}
              <div className={styles.mockupSidebar}>
                <div className={styles.mockupSidebarItem + ' ' + styles.mockupSidebarActive}>
                  <LayoutGrid size={12} /> Dashboard
                </div>
                <div className={styles.mockupSidebarItem}>
                  <FolderOpen size={12} /> Projetos
                </div>
                <div className={styles.mockupSidebarItem}>
                  <FileText size={12} /> Documentos
                </div>
                <div className={styles.mockupSidebarItem}>
                  <Users size={12} /> Equipe
                </div>
              </div>

              {/* Main panel */}
              <div className={styles.mockupMain}>
                <div className={styles.mockupStatsRow}>
                  <div className={styles.mockupStatCard}>
                    <span className={styles.mockupStatNum}>24</span>
                    <span className={styles.mockupStatLbl}>Projetos</span>
                  </div>
                  <div className={styles.mockupStatCard}>
                    <span className={styles.mockupStatNum}>187</span>
                    <span className={styles.mockupStatLbl}>Documentos</span>
                  </div>
                  <div className={styles.mockupStatCard}>
                    <span className={styles.mockupStatNum}>12</span>
                    <span className={styles.mockupStatLbl}>Templates</span>
                  </div>
                </div>

                <div className={styles.mockupList}>
                  {['Contrato Social v2.pdf', 'Relatório Q1 2025.docx', 'Proposta Técnica.pdf'].map((name, i) => (
                    <div key={i} className={styles.mockupListItem}>
                      <div className={styles.mockupListIcon}>
                        <FileText size={10} />
                      </div>
                      <div className={styles.mockupListInfo}>
                        <span className={styles.mockupListName}>{name}</span>
                        <span className={styles.mockupListMeta}>Projeto Alpha</span>
                      </div>
                      <div className={styles.mockupListBadge}>OK</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating cards */}
          <div className={styles.floatingCard1}>
            <div className={styles.floatingCardIcon}>
              <FolderOpen size={16} />
            </div>
            <div>
              <div className={styles.floatingCardTitle}>Projeto Alpha</div>
              <div className={styles.floatingCardSub}>34 documentos</div>
            </div>
          </div>

          <div className={styles.floatingCard2}>
            <div className={styles.floatingCardCheckIcon}>OK</div>
            <div>
              <div className={styles.floatingCardTitle}>Imagem legível</div>
              <div className={styles.floatingCardSub}>samfersill_RG.jpg</div>
            </div>
          </div>

          <div className={styles.floatingCard3}>
            <div className={styles.floatingCardStarIcon}>*</div>
            <div>
              <div className={styles.floatingCardTitle}>Template criado</div>
              <div className={styles.floatingCardSub}>NDA Padrão</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
