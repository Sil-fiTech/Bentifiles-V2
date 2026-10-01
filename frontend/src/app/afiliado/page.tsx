'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Copy, Gift, Loader2 } from 'lucide-react';

import { Nav } from '@/components/Nav';
import ReferralLists from '@/components/affiliate/ReferralLists';
import {
  type AffiliateOverview,
  type ReferralList,
  enrollAffiliate,
  getAffiliateMe,
  listMyReferrals,
} from '@/lib/affiliate/affiliateApi';

import styles from './page.module.scss';

export default function AffiliatePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.user?.token;

  const [overview, setOverview] = useState<AffiliateOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    // Auth is resolved by the backend: the axios interceptor attaches the stored
    // token (credentials flow) or we pass the NextAuth token (Google flow).
    if (status === 'loading') return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAffiliateMe(token);
        if (!cancelled) setOverview(data);
      } catch (err: any) {
        if (err?.response?.status === 401) {
          router.push('/login');
          return;
        }
        if (!cancelled) setError(err?.response?.data?.message || 'Erro ao carregar o programa de afiliados.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, token, router]);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const data = await enrollAffiliate(token);
      setOverview(data);
      toast.success('Você agora é afiliado! Seu código e link estão prontos.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Não foi possível criar seu perfil de afiliado.');
    } finally {
      setEnrolling(false);
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const referralFetcher = useCallback(
    (params: { list: ReferralList; page: number; pageSize: number }) => listMyReferrals(params, token),
    [token],
  );

  return (
    <div className={styles.root}>
      <main className={styles.main}>
        <Nav />
        <div className={styles.canvas}>
          <header className={styles.header}>
            <h1 className={styles.title}>Programa de Afiliados</h1>
            <p className={styles.subtitle}>
              Compartilhe seu link, acompanhe quem se cadastrou e quem virou assinante com o seu cupom.
            </p>
          </header>

          {(loading || status === 'loading') && (
            <div className={styles.loading}>
              <Loader2 size={20} className={styles.spin} /> Carregando...
            </div>
          )}

          {!loading && error && <div className={styles.error}>{error}</div>}

          {!loading && !error && overview && !overview.enrolled && (
            <div className={styles.enroll}>
              <div className={styles.enrollTitle}>Torne-se afiliado</div>
              <p className={styles.enrollText}>
                Gere na hora um código exclusivo e um link de cadastro. Sem aprovação, sem espera.
              </p>
              <ul className={styles.enrollList}>
                <li>Quem assinar pelo seu cupom ganha 10% de desconto por 2 meses.</li>
                <li>Você vê quem se cadastrou pelo link, quem está em teste grátis e quem já está pagando.</li>
              </ul>
              <button type="button" className={styles.copyBtn} onClick={handleEnroll} disabled={enrolling}>
                {enrolling ? <Loader2 size={16} className={styles.spin} /> : <Gift size={16} />}
                {enrolling ? 'Gerando...' : 'Tornar-se afiliado'}
              </button>
            </div>
          )}

          {!loading && !error && overview?.enrolled && (
            <>
              <section className={styles.codeCard}>
                <div className={styles.codeBlock}>
                  <span className={styles.codeLabel}>Seu código / cupom</span>
                  <span className={styles.codeValue}>{overview.code}</span>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => copy(overview.code!, 'Código')}
                  >
                    <Copy size={15} /> Copiar código
                  </button>
                  {overview.status === 'DISABLED' && (
                    <span className={styles.disabledPill}>Afiliação desativada</span>
                  )}
                </div>
                <div className={styles.codeBlock}>
                  <span className={styles.codeLabel}>Link de cadastro</span>
                  <span className={styles.linkValue}>{overview.signupLink}</span>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => copy(overview.signupLink!, 'Link')}
                  >
                    <Copy size={15} /> Copiar link
                  </button>
                </div>
              </section>

              <section className={styles.stats}>
                <div className={styles.stat}>
                  <div className={styles.statValue}>{overview.stats?.linkSignups ?? 0}</div>
                  <div className={styles.statLabel}>Cadastrados pelo link</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statValue}>{overview.stats?.couponTrialing ?? 0}</div>
                  <div className={styles.statLabel}>Usaram o cupom e estão em trial</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statValue}>{overview.stats?.couponPaying ?? 0}</div>
                  <div className={styles.statLabel}>Usaram o cupom e estão pagando</div>
                </div>
              </section>

              <ReferralLists fetcher={referralFetcher} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
