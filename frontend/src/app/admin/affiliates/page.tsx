'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronLeft, ChevronRight, Loader2, Search, Shield } from 'lucide-react';

import api from '@/lib/api';
import { Nav } from '@/components/Nav';
import ReferralLists from '@/components/affiliate/ReferralLists';
import {
  type AdminAffiliateRow,
  type ReferralList,
  listAdminAffiliateReferrals,
  listAdminAffiliates,
} from '@/lib/affiliate/affiliateApi';

import styles from './page.module.scss';

const PAGE_SIZE = 20;

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

function formatDate(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function AdminAffiliatesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = session?.user?.token;

  const [authChecked, setAuthChecked] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminAffiliateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminAffiliateRow | null>(null);

  const debouncedQuery = useDebouncedValue(query, 350);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const res = await api.get('/api/users/me', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        setIsSuperAdmin(res.data?.systemRole === 'SUPER_ADMIN');
      } catch (err: any) {
        if (err?.response?.status === 401) {
          router.push('/login');
          return;
        }
        setIsSuperAdmin(false);
      } finally {
        setAuthChecked(true);
      }
    };
    void checkRole();
  }, [token, router]);

  useEffect(() => {
    if (!authChecked || !isSuperAdmin) return;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listAdminAffiliates(
          { page, pageSize: PAGE_SIZE, q: debouncedQuery || undefined },
          token,
        );
        setRows(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Erro ao carregar afiliados.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [authChecked, isSuperAdmin, debouncedQuery, page, token]);

  const modalFetcher = useMemo(() => {
    if (!selected) return null;
    const id = selected.id;
    return (params: { list: ReferralList; page: number; pageSize: number }) =>
      listAdminAffiliateReferrals(id, params, token);
  }, [selected, token]);

  const changeQuery = useCallback((value: string) => {
    setQuery(value);
    setPage(1);
  }, []);

  if (!authChecked) {
    return (
      <div className={styles.root}>
        <main className={styles.main}>
          <Nav />
          <div className={styles.canvas}>
            <div className={styles.loading}>
              <Loader2 size={20} className={styles.spin} /> Carregando...
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <main className={styles.main}>
        <Nav />
        <div className={styles.canvas}>
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>Afiliados</h1>
              <p className={styles.subtitle}>Todos os afiliados e o desempenho de cada código.</p>
            </div>
            <nav className={styles.sectionTabs}>
              <Link href="/admin/users" className={styles.sectionTab}>
                Usuários
              </Link>
              <Link href="/admin/affiliates" className={`${styles.sectionTab} ${styles.sectionTabActive}`}>
                Afiliados
              </Link>
            </nav>
          </header>

          {!isSuperAdmin && (
            <div className={styles.denied}>
              <Shield size={18} />
              <div>Você não possui permissão SUPER_ADMIN.</div>
            </div>
          )}

          {isSuperAdmin && (
            <>
              <div className={styles.controls}>
                <div className={styles.searchBox}>
                  <Search size={16} />
                  <input
                    className={styles.searchInput}
                    value={query}
                    onChange={(e) => changeQuery(e.target.value)}
                    placeholder="Buscar por nome, e-mail ou código..."
                  />
                </div>
              </div>

              <div className={styles.resultsMeta}>
                {total} afiliado(s) • Página {page} de {totalPages}
              </div>

              {loading && (
                <div className={styles.loading}>
                  <Loader2 size={20} className={styles.spin} /> Carregando...
                </div>
              )}
              {!loading && error && <div className={styles.error}>{error}</div>}
              {!loading && !error && rows.length === 0 && (
                <div className={styles.empty}>Nenhum afiliado encontrado.</div>
              )}

              {!loading && !error && rows.length > 0 && (
                <>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Afiliado</th>
                          <th>Código</th>
                          <th>Status</th>
                          <th>Pelo link</th>
                          <th>Em trial</th>
                          <th>Pagando</th>
                          <th>Desde</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <div className={styles.name}>{row.name}</div>
                              <div className={styles.muted}>{row.email}</div>
                            </td>
                            <td className={styles.code}>{row.code}</td>
                            <td>{row.status}</td>
                            <td>{row.stats.linkSignups}</td>
                            <td>{row.stats.couponTrialing}</td>
                            <td>{row.stats.couponPaying}</td>
                            <td>{formatDate(row.createdAt)}</td>
                            <td>
                              <button
                                type="button"
                                className={styles.detailsBtn}
                                onClick={() => setSelected(row)}
                              >
                                Ver indicações
                              </button>
                            </td>
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
                            <div className={styles.mLabel}>Código</div>
                            <div className={styles.mValue}>{row.code}</div>
                          </div>
                          <div>
                            <div className={styles.mLabel}>Status</div>
                            <div className={styles.mValue}>{row.status}</div>
                          </div>
                          <div>
                            <div className={styles.mLabel}>Pelo link</div>
                            <div className={styles.mValue}>{row.stats.linkSignups}</div>
                          </div>
                          <div>
                            <div className={styles.mLabel}>Em trial</div>
                            <div className={styles.mValue}>{row.stats.couponTrialing}</div>
                          </div>
                          <div>
                            <div className={styles.mLabel}>Pagando</div>
                            <div className={styles.mValue}>{row.stats.couponPaying}</div>
                          </div>
                          <div>
                            <div className={styles.mLabel}>Desde</div>
                            <div className={styles.mValue}>{formatDate(row.createdAt)}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={styles.detailsBtn}
                          style={{ marginTop: 16 }}
                          onClick={() => setSelected(row)}
                        >
                          Ver indicações
                        </button>
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
            </>
          )}
        </div>
      </main>

      {selected && modalFetcher && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>Indicações de {selected.name}</div>
                <div className={styles.modalSubtitle}>
                  {selected.email} • código {selected.code}
                </div>
              </div>
              <button type="button" className={styles.modalClose} onClick={() => setSelected(null)} aria-label="Fechar">
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <ReferralLists fetcher={modalFetcher} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
