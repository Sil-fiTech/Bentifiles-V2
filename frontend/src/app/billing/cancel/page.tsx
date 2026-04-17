'use client';

import React from 'react';
import { XCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import styles from './page.module.scss';

export default function CancelPage() {
  return (
    <main className={styles.root}>
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <div className={styles.iconCircle}>
            <XCircle size={48} />
          </div>
        </div>

        <h1 className={styles.title}>
          Pagamento Cancelado
        </h1>
        
        <p className={styles.description}>
          Ops! Parece que o processo de contratação do plano não foi concluído. 
          Nenhuma cobrança foi realizada.
        </p>

        <div className={styles.actions}>
          <Link 
            href="/plans"
            className={styles.retryBtn}
          >
            Tentar Novamente
          </Link>

          <Link 
            href="/dashboard"
            className={styles.backBtn}
          >
            <ArrowLeft size={16} />
            Voltar para o Dashboard
          </Link>
        </div>

        <p className={styles.footerNote}>
          Se você teve algum problema técnico durante o pagamento, entre em contato conosco em <span className={styles.contact}>contato@bentifiles.com</span>
        </p>
      </div>
    </main>
  );
}
