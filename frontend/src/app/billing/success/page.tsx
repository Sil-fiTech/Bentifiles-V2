'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { getAccessStatus } from '@/lib/billing/getAccessStatus';
import styles from './page.module.scss';

export default function SuccessPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'delay'>('loading');
  const { data: session } = useSession();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const checkCountRef = useRef(0);

  const checkStatus = useCallback(async () => {
    try {
      // Prioritize session token, then localStorage
      const token = session?.user?.token || localStorage.getItem('token');
      
      if (!token) {
        // If we are waiting for session to load, keep loading
        if (!session) return;
        
        // If session loaded and still no token, just show success as fallback
        setStatus('success');
        if (pollingRef.current) clearInterval(pollingRef.current);
        return;
      }

      const data = await getAccessStatus(token);

      if (data?.canCreateProject) {
        setStatus('success');
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else {
        // If not ready yet, try to force a sync (every 2 checks)
        if (checkCountRef.current % 2 === 0) {
          axios.post(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/billing/sync-subscription`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          ).catch(e => console.warn('Background sync failed', e));
        }
      }
    } catch (error) {
      console.error('Status check error:', error);
    }
    checkCountRef.current++;
  }, [session?.user?.token]);

  useEffect(() => {
    // Initial check
    checkStatus();

    // Polling interval
    pollingRef.current = setInterval(checkStatus, 3000);

    // Timeout for delay message
    const timeoutId = setTimeout(() => {
      setStatus(prev => prev === 'loading' ? 'delay' : prev);
    }, 15000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      clearTimeout(timeoutId);
    };
  }, [checkStatus]);

  return (
    <main className={styles.root}>
      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <div className={styles.iconCircle}>
            <CheckCircle2 size={48} />
          </div>
        </div>

        <h1 className={styles.title}>
          Pagamento Confirmado!
        </h1>
        
        <p className={styles.description}>
          Sua assinatura foi processada com sucesso. Estamos liberando seu acesso agora mesmo.
        </p>

        <div className={styles.statusPanel}>
          {status === 'loading' || status === 'delay' ? (
            <div className={styles.loadingState}>
              <Loader2 className={styles.loader} size={24} />
              <p className={styles.statusText}>
                {status === 'loading' ? 'Verificando acesso...' : 'A sincronização está demorando um pouco mais...'}
              </p>
            </div>
          ) : (
            <div className={styles.successState}>
              <div className={styles.successBadge}>
                <CheckCircle2 size={20} />
              </div>
              <p className={styles.successLabel}>
                Acesso Liberado!
              </p>
            </div>
          )}
        </div>

        <Link 
          href="/dashboard"
          className={`${styles.dashboardBtn} ${status !== 'success' ? styles.disabled : ''}`}
          onClick={(e) => status !== 'success' && e.preventDefault()}
          aria-disabled={status !== 'success'}
        >
          Ir para o Dashboard
          <ArrowRight size={18} />
        </Link>

        {status === 'delay' && (
          <div className={styles.delayContainer}>
            <p className={styles.tip}>
              <strong>A sincronização está demorando um pouco.</strong> Isso pode acontecer se o Webhook do Stripe ainda não tiver chegado ao nosso servidor.
            </p>
            <p className={styles.tip}>
              Se você está em ambiente de desenvolvimento, verifique se o comando <code>stripe listen --forward-to localhost:4000/webhooks/stripe</code> está rodando.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
