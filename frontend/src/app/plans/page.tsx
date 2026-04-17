'use client';

import React from 'react';
import PlansGrid from '@/components/billing/PlansGrid';
import { ArrowLeft, Clock } from 'lucide-react';
import Link from 'next/link';
import styles from './page.module.scss';

export default function PlansPage() {
  return (
    <main className={styles.root}>
      <div className={styles.container}>
        <div className={styles.header}>
          <Link
            href="/dashboard"
            className={styles.backLink}
          >
            <ArrowLeft size={16} />
            Voltar ao dashboard
          </Link>

          <h1 className={styles.title}>
            Escolha o Plano Ideal para o Seu <span className={styles.accent}>Workflow</span>
          </h1>

          <p className={styles.subtitle}>
            A assinatura é necessária apenas para quem deseja <span className={styles.highlight}>criar e gerenciar novos projetos</span>.
            Convidados podem participar e interagir em projetos existentes gratuitamente.
          </p>

          <p className={styles.trialNote}>
            Comece hoje mesmo com <span className={styles.highlight}>3 dias totalmente grátis</span> em qualquer plano.
            Cancele a qualquer momento.
          </p>

          <div className={styles.features}>
            <div className={styles.featureItem}>
              <Clock size={16} style={{ color: 'var(--color-primary, #f59e0b)' }} />
              Trial de 10 dias
            </div>
            <div className={styles.dot} />
            <div className={styles.featureItem}>Prioridade de suporte</div>
            <div className={styles.dot} />
            <div className={styles.featureItem}>Sem Fidelidade</div>
          </div>
        </div>

        <PlansGrid />

        <div className={styles.faqSection}>
          <div className={styles.faqCard}>
            <h4 className={styles.faqTitle}>Alguma dúvida?</h4>
            <p className={styles.faqText}>
              Nossa equipe de suporte está pronta para te ajudar a escolher o melhor plano para sua operação.
              Entre em contato pelo email <span className={styles.email}>contato@bentifiles.com</span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
