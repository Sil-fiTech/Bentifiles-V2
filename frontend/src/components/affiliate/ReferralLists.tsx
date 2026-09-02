'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { ReferralList, ReferralPage, ReferralRow } from '@/lib/affiliate/affiliateApi';
import styles from './ReferralLists.module.scss';

type Fetcher = (params: { list: ReferralList; page: number; pageSize: number }) => Promise<ReferralPage>;

const DEFAULT_LABELS: Record<ReferralList, string> = {
  link: 'Cadastrados pelo link',
  trial: 'Cupom + em trial',
  paying: 'Cupom + pagando',
};

const PAGE_SIZE = 20;

function formatDate(input: string | null) {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function StatusBadge({ status }: { status: ReferralRow['subscriptionStatus'] }) {
  const cls =
    status === 'TRIALING'
      ? `${styles.badge} ${styles.badgeTrial}`
      : status === 'ACTIVE'
        ? `${styles.badge} ${styles.badgeActive}`
        : `${styles.badge} ${styles.badgeNeutral}`;
  return <span className={cls}>{status}</span>;
}

export default function ReferralLists({
  fetcher,
  initialList = 'link',
}: {
  fetcher: Fetcher;
  initialList?: ReferralList;
}) {
  const [list, setList] = useState<ReferralList>(initialList);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReferralPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher({ list, page, pageSize: PAGE_SIZE });
      setData(result);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao carregar a lista.');
    } finally {
      setLoading(false);
    }
  }, [fetcher, list, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeList = (next: ReferralList) => {
    if (next === list) return;
    setList(next);
    setPage(1);
  };

  const rows = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs}>
        {(Object.keys(DEFAULT_LABELS) as ReferralList[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`${styles.tab} ${key === list ? styles.tabActive : ''}`}
            onClick={() => changeList(key)}
          >
            {DEFAULT_LABELS[key]}
          </button>
        ))}
      </div>

      {data && (
        <div className={styles.resultsMeta}>
          {data.total} registro(s) • Página {data.page} de {totalPages}
        </div>
      )}

      {loading && (
        <div className={styles.state}>
          <Loader2 size={18} className={styles.spin} /> Carregando...
        </div>
      )}

      {!loading && error && <div className={`${styles.state} ${styles.stateError}`}>{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div className={styles.state}>Nenhum registro nesta lista ainda.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Entrou em</th>
                  <th>Status</th>
                  <th>Plano</th>
                  {list !== 'link' && <th>Cupom em</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.name}>{row.name}</td>
                    <td className={styles.muted}>{row.email}</td>
                    <td>{formatDate(row.signedUpAt)}</td>
                    <td><StatusBadge status={row.subscriptionStatus} /></td>
                    <td>{row.subscriptionPlan && row.subscriptionPlan !== 'NONE' ? row.subscriptionPlan : '—'}</td>
                    {list !== 'link' && <td>{formatDate(row.couponRedeemedAt)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.mobileCards}>
            {rows.map((row) => (
              <article key={row.id} className={styles.mCard}>
                <div className={styles.mCardName}>{row.name}</div>
                <div className={styles.mCardEmail}>{row.email}</div>
                <div className={styles.mCardGrid}>
                  <div>
                    <div className={styles.mLabel}>Entrou em</div>
                    <div className={styles.mValue}>{formatDate(row.signedUpAt)}</div>
                  </div>
                  <div>
                    <div className={styles.mLabel}>Status</div>
                    <div className={styles.mValue}><StatusBadge status={row.subscriptionStatus} /></div>
                  </div>
                  <div>
                    <div className={styles.mLabel}>Plano</div>
                    <div className={styles.mValue}>
                      {row.subscriptionPlan && row.subscriptionPlan !== 'NONE' ? row.subscriptionPlan : '—'}
                    </div>
                  </div>
                  {list !== 'link' && (
                    <div>
                      <div className={styles.mLabel}>Cupom em</div>
                      <div className={styles.mValue}>{formatDate(row.couponRedeemedAt)}</div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className={styles.pagination}>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
