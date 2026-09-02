'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Search, Shield } from 'lucide-react';

import api from '@/lib/api';
import { Nav } from '@/components/Nav';
import {
  type AdminUserRow,
  type SystemRole,
  listAdminUsers,
  updateAdminUserSubscription,
  updateAdminUserSystemRole,
} from '@/lib/admin/usersApi';

import styles from './page.module.scss';

const SYSTEM_ROLES: SystemRole[] = ['USER', 'SUPPORT', 'SUPER_ADMIN'];
const SUBSCRIPTION_PLANS = ['NONE', 'INDIVIDUAL', 'OFFICE', 'ENTERPRISE'] as const;
const SUBSCRIPTION_STATUSES = ['NONE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'UNPAID'] as const;
type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];
type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export default function AdminUsersPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [authChecked, setAuthChecked] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<SystemRole | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    user: AdminUserRow;
    nextRole: SystemRole;
  } | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [subscriptionDraft, setSubscriptionDraft] = useState<{
    user: AdminUserRow;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    totalSeats: number;
  } | null>(null);
  const [savingSubscription, setSavingSubscription] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 350);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const res = await api.get('/api/users/me', {
          headers: session?.user?.token ? { Authorization: `Bearer ${session.user.token}` } : undefined,
        });
        const role = res.data?.systemRole as SystemRole | undefined;
        setIsSuperAdmin(role === 'SUPER_ADMIN');
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
  }, [session?.user?.token, router]);

  useEffect(() => {
    if (!authChecked) return;
    if (!isSuperAdmin) return;

    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listAdminUsers({
          q: debouncedQuery || undefined,
          role: roleFilter,
          page,
          pageSize,
        }, session?.user?.token || null);
        setUsers(data.items);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      } catch (err: any) {
        if (err?.response?.status === 403) {
          setError('Acesso negado. Você precisa ser SUPER_ADMIN para visualizar esta página.');
          return;
        }
        setError(err?.response?.data?.message || 'Erro ao carregar usuários.');
      } finally {
        setLoading(false);
      }
    };

    void fetchUsers();
  }, [authChecked, isSuperAdmin, debouncedQuery, roleFilter, page]);

  const selectedRoleByUserId = useMemo(() => {
    const map: Record<string, SystemRole> = {};
    for (const user of users) map[user.id] = user.systemRole;
    return map;
  }, [users]);

  const openRoleChange = (user: AdminUserRow, nextRole: SystemRole) => {
    setPendingChange({ user, nextRole });
    setConfirmOpen(true);
  };

  const confirmRoleChange = async () => {
    if (!pendingChange) return;
    setSavingRole(true);
    try {
      const updated = await updateAdminUserSystemRole(
        pendingChange.user.id,
        pendingChange.nextRole,
        session?.user?.token || null
      );
      setUsers((current) => current.map((u) => (u.id === updated.id ? updated : u)));
      toast.success('Permissão global atualizada.');
      setConfirmOpen(false);
      setPendingChange(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao atualizar permissão.');
    } finally {
      setSavingRole(false);
    }
  };

  const openSubscriptionModal = (user: AdminUserRow) => {
    setSubscriptionDraft({
      user,
      plan: (user.subscriptionPlan as SubscriptionPlan) || 'NONE',
      status: (user.subscriptionStatus as SubscriptionStatus) || 'NONE',
      totalSeats: 1,
    });
    setSubscriptionOpen(true);
  };

  const confirmSubscriptionChange = async () => {
    if (!subscriptionDraft) return;
    setSavingSubscription(true);
    try {
      const updated = await updateAdminUserSubscription(
        subscriptionDraft.user.id,
        {
          plan: subscriptionDraft.plan,
          status: subscriptionDraft.status,
          totalSeats: subscriptionDraft.plan === 'OFFICE' ? subscriptionDraft.totalSeats : 0,
        },
        session?.user?.token || null
      );
      setUsers((current) => current.map((u) => (u.id === updated.id ? updated : u)));
      toast.success('Assinatura atualizada.');
      setSubscriptionOpen(false);
      setSubscriptionDraft(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao atualizar assinatura.');
    } finally {
      setSavingSubscription(false);
    }
  };

  const denyView = authChecked && !isSuperAdmin;
  const showTable = authChecked && isSuperAdmin;

  if (!authChecked) {
    return (
      <div className={styles.root}>
        <main className={styles.main}>
          <Nav />
          <div className={styles.canvas}>
            <div className={styles.loading}>
              <Loader2 size={20} className={styles.spin} />
              Carregando...
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
              <h1 className={styles.title}>Administração do sistema</h1>
              <p className={styles.subtitle}>Gerencie usuários e permissões globais (fora dos projetos).</p>
            </div>
            <nav className={styles.sectionTabs}>
              <Link href="/admin/users" className={`${styles.sectionTab} ${styles.sectionTabActive}`}>
                Usuários
              </Link>
              <Link href="/admin/affiliates" className={styles.sectionTab}>
                Afiliados
              </Link>
            </nav>
          </header>

          <div className={styles.alert}>
            <AlertTriangle size={18} />
            <div>
              <strong>Alerta:</strong> permissões globais dão acesso administrativo ao sistema inteiro.
            </div>
          </div>

          {denyView && (
            <div className={styles.denied}>
              <Shield size={18} />
              <div>
                <div className={styles.deniedTitle}>Acesso negado</div>
                <div className={styles.deniedText}>Você não possui permissão SUPER_ADMIN.</div>
              </div>
            </div>
          )}

          {showTable && (
            <>
              <section className={styles.controls}>
                <div className={styles.searchBox}>
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Buscar por nome ou e-mail..."
                    className={styles.searchInput}
                  />
                </div>

                <div className={styles.filterBox}>
                  <label className={styles.filterLabel} htmlFor="role-filter">
                    Role global
                  </label>
                  <select
                    id="role-filter"
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value as any);
                      setPage(1);
                    }}
                    className={styles.filterSelect}
                  >
                    <option value="ALL">Todos</option>
                    {SYSTEM_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <section className={styles.resultsMeta}>
                <span>
                  {total} usuário(s) • Página {page} de {totalPages}
                </span>
              </section>

              {loading && (
                <div className={styles.loading}>
                  <Loader2 size={20} className={styles.spin} />
                  Carregando usuários...
                </div>
              )}

              {!loading && error && <div className={styles.error}>{error}</div>}

              {!loading && !error && users.length === 0 && <div className={styles.empty}>Nenhum usuário encontrado.</div>}

              {!loading && !error && users.length > 0 && (
                <>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>E-mail</th>
                          <th>Role</th>
                          <th>Plano</th>
                          <th>Status</th>
                          <th>Verificado</th>
                          <th>Criado em</th>
                          <th>Projetos</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => {
                          const isSuper = user.systemRole === 'SUPER_ADMIN';
                          return (
                            <tr key={user.id} className={isSuper ? styles.superRow : undefined}>
                              <td className={styles.cellName}>
                                <span className={styles.name}>{user.name}</span>
                                {isSuper && <span className={styles.superBadge}>SUPER_ADMIN</span>}
                              </td>
                              <td className={styles.cellEmail}>{user.email}</td>
                              <td>
                                <select
                                  className={styles.roleSelect}
                                  value={selectedRoleByUserId[user.id]}
                                  onChange={(e) => openRoleChange(user, e.target.value as SystemRole)}
                                >
                                  {SYSTEM_ROLES.map((role) => (
                                    <option key={role} value={role}>
                                      {role}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>{user.subscriptionPlan || '-'}</td>
                              <td>{user.subscriptionStatus || '-'}</td>
                              <td>{user.emailVerified ? 'Sim' : 'Não'}</td>
                              <td>{formatDate(user.createdAt)}</td>
                              <td>{user.projectCount}</td>
                              <td>
                                <div className={styles.actionRow}>
                                  <button
                                    type="button"
                                    className={styles.detailsBtn}
                                    onClick={() => openSubscriptionModal(user)}
                                  >
                                    Assinatura
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.mobileCards}>
                    {users.map((user) => {
                      const isSuper = user.systemRole === 'SUPER_ADMIN';
                      return (
                        <article key={user.id} className={`${styles.card} ${isSuper ? styles.cardSuper : ''}`}>
                          <div className={styles.cardHeader}>
                            <div className={styles.cardNameRow}>
                              <div className={styles.cardName}>{user.name}</div>
                              {isSuper && <span className={styles.superBadge}>SUPER_ADMIN</span>}
                            </div>
                            <div className={styles.cardEmail}>{user.email}</div>
                          </div>

                          <div className={styles.cardGrid}>
                            <div>
                              <div className={styles.cardLabel}>Role</div>
                              <select
                                className={styles.roleSelect}
                                value={selectedRoleByUserId[user.id]}
                                onChange={(e) => openRoleChange(user, e.target.value as SystemRole)}
                              >
                                {SYSTEM_ROLES.map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <div className={styles.cardLabel}>Plano</div>
                              <div className={styles.cardValue}>{user.subscriptionPlan || '-'}</div>
                            </div>
                            <div>
                              <div className={styles.cardLabel}>Status</div>
                              <div className={styles.cardValue}>{user.subscriptionStatus || '-'}</div>
                            </div>
                            <div>
                              <div className={styles.cardLabel}>Verificado</div>
                              <div className={styles.cardValue}>{user.emailVerified ? 'Sim' : 'Não'}</div>
                            </div>
                            <div>
                              <div className={styles.cardLabel}>Criado</div>
                              <div className={styles.cardValue}>{formatDate(user.createdAt)}</div>
                            </div>
                            <div>
                              <div className={styles.cardLabel}>Projetos</div>
                              <div className={styles.cardValue}>{user.projectCount}</div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
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

      {confirmOpen && pendingChange && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <div id="confirm-title" className={styles.modalTitle}>
                  Confirmar alteração
                </div>
                <div className={styles.modalSubtitle}>
                  Você está prestes a alterar a permissão global deste usuário.
                </div>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => {
                  if (savingRole) return;
                  setConfirmOpen(false);
                  setPendingChange(null);
                }}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalRow}>
                <span>Usuário</span>
                <strong>
                  {pendingChange.user.name} ({pendingChange.user.email})
                </strong>
              </div>
              <div className={styles.modalRow}>
                <span>Role atual</span>
                <strong>{pendingChange.user.systemRole}</strong>
              </div>
              <div className={styles.modalRow}>
                <span>Novo role</span>
                <strong>{pendingChange.nextRole}</strong>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={savingRole}
                onClick={() => {
                  setConfirmOpen(false);
                  setPendingChange(null);
                }}
              >
                Cancelar
              </button>
              <button type="button" className={styles.primaryBtn} disabled={savingRole} onClick={confirmRoleChange}>
                {savingRole ? <Loader2 size={16} className={styles.spin} /> : null}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {subscriptionOpen && subscriptionDraft && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="subscription-title">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <div id="subscription-title" className={styles.modalTitle}>
                  Alterar assinatura
                </div>
                <div className={styles.modalSubtitle}>
                  {subscriptionDraft.user.name} ({subscriptionDraft.user.email})
                </div>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => {
                  if (savingSubscription) return;
                  setSubscriptionOpen(false);
                  setSubscriptionDraft(null);
                }}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel} htmlFor="sub-plan">
                  Plano
                </label>
                <select
                  id="sub-plan"
                  className={styles.roleSelect}
                  value={subscriptionDraft.plan}
                  onChange={(e) =>
                    setSubscriptionDraft((current) =>
                      current ? { ...current, plan: e.target.value as SubscriptionPlan } : current
                    )
                  }
                >
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel} htmlFor="sub-status">
                  Status
                </label>
                <select
                  id="sub-status"
                  className={styles.roleSelect}
                  value={subscriptionDraft.status}
                  onChange={(e) =>
                    setSubscriptionDraft((current) =>
                      current ? { ...current, status: e.target.value as SubscriptionStatus } : current
                    )
                  }
                >
                  {SUBSCRIPTION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {subscriptionDraft.plan === 'OFFICE' && (
                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel} htmlFor="sub-seats">
                    Assentos (OFFICE)
                  </label>
                  <input
                    id="sub-seats"
                    className={styles.textInput}
                    type="number"
                    min={1}
                    value={subscriptionDraft.totalSeats}
                    onChange={(e) =>
                      setSubscriptionDraft((current) =>
                        current ? { ...current, totalSeats: Math.max(1, Number(e.target.value) || 1) } : current
                      )
                    }
                  />
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={savingSubscription}
                onClick={() => {
                  setSubscriptionOpen(false);
                  setSubscriptionDraft(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={savingSubscription}
                onClick={confirmSubscriptionChange}
              >
                {savingSubscription ? <Loader2 size={16} className={styles.spin} /> : null}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
