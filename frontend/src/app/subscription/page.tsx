'use client';

import React, { useEffect, useState } from 'react';
import { 
  CreditCard, 
  AlertTriangle, 
  CheckCircle2,
  ExternalLink,
  Zap,
  Download,
  AlertCircle,
  RefreshCw,
  XCircle,
  Clock,
  Mail,
  Users,
  UserMinus
} from 'lucide-react';
import { OfficeWorkspaceInvite, OfficeWorkspaceMember, PlanData, SubscriptionData } from './types';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Nav } from '@/components/Nav';
import api from '@/lib/api';
import { toast } from 'sonner';
import styles from './page.module.scss';
import { useAccessGate } from '@/lib/hooks/useAccessGate';
const formatCurrency = (amount: number, currency: string = 'BRL') => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

const formatDate = (isoStr: string) => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(isoStr));
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'active':
      return { label: 'Assinatura Ativa', colorClass: styles.active, icon: CheckCircle2 };
    case 'trialing':
      return { label: 'Período de Teste', colorClass: styles.trialing, icon: Clock };
    case 'past_due':
      return { label: 'Pagamento Pendente', colorClass: styles.past_due, icon: AlertTriangle };
    case 'canceled':
      return { label: 'Assinatura Encerrada', colorClass: styles.canceled, icon: XCircle };
    default:
      return { label: 'Sem Assinatura', colorClass: '', icon: AlertCircle };
  }
};



const SYSTEM_PLANS: PlanData[] = [
  {
    id: 'INDIVIDUAL',
    name: 'Individual',
    monthlyPrice: 64.98,
    yearlyPrice: 599.76,
    description: 'Para freelancers que buscam agilidade e segurança.',
    features: [
      'Verificação básica de integridade',
      'Suporte via email 24h',
      '1 usuário dedicado',
      'Até 50 documentos/mês',
    ]
  },
  {
    id: 'OFFICE',
    name: 'Office',
    monthlyPrice: 49.98,
    yearlyPrice: 539.76,
    description: 'O equilíbrio perfeito para times em crescimento.',
    features: [
      'Documentos ilimitados',
      'Verificação avançada por IA',
      'Suporte prioritário 24/7',
      'Gestão de equipe e permissões',
      'Relatórios detalhados'
    ]
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    monthlyPrice: 'Personalizado',
    yearlyPrice: 'Personalizado',
    description: 'Segurança absoluta para operações críticas.',
    features: [
      'Tudo do plano Office',
      'Usuários ilimitados',
      'SLA garantido em contrato',
      'Gerente de conta dedicado',
      'Customização White-label'
    ]
  }
];

export default function SubscriptionPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const { data: session } = useSession();
  const { access, loading: accessLoading } = useAccessGate();
  const router = useRouter();

  const handleLogout = async () => {
    localStorage.removeItem('token');
    if (session) await signOut({ redirect: false });
    router.push('/');
  };

  const handleCreateProject = async () => {
    try {
      setCreating(true);
      const token = session?.user?.token || localStorage.getItem('token');
      const res = await api.post('/api/projects', { name: 'Novo Projeto' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Projeto criado');
      router.push(`/projects/${res.data.project.id}`);
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error('Assinatura necessária para criar projetos.');
        router.push('/plans');
      } else {
        toast.error('Falha ao criar projeto');
      }
    } finally {
      setCreating(false);
    }
  };

  const userInitials = session?.user?.name ? session.user.name.substring(0, 2).toUpperCase() : 'US';
    useEffect(() => {
        // Only fetch data if we are authenticated
        if (accessLoading || !access?.authenticated) return;

        const token = access.token;
        if (token) {
            fetchData(token);
        }
    }, [accessLoading, access, session]);

    const fetchData = async (token: string) => {
      try {        
        const res = await api.get('/api/billing/subscription', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data);
        setBillingInterval(res.data.billingInterval || 'monthly');
      } catch (err) {
        console.error('Failed to load subscription:', err);
        toast.error('Erro ao carregar os detalhes da assinatura');
      } finally {
        setLoading(false);
      }
    };

  const refreshSubscriptionData = async () => {
    const token = session?.user?.token || localStorage.getItem('token');
    if (!token) return;
    await fetchData(token);
  };

  const handlePortalRedirect = async () => {
    setActionLoading('portal');
    try {
      const token = session?.user?.token || localStorage.getItem('token');
      const res = await api.post('/api/billing/create-portal-session', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.url) {
        window.open(res.data.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
        toast.error('Não foi possível iniciar sessão do portal Stripe');
    } finally {
      setActionLoading(null);
    }
  };


  const handleCancelSubscription = async () => {
    if (!confirm('Você realmente deseja interromper sua assinatura? Você perderá acesso aos recursos premium ao fim do ciclo.')) return;
    setActionLoading('cancel');
    try {
      const token = session?.user?.token || localStorage.getItem('token');
      await api.post('/api/billing/cancel-subscription', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Assinatura agendada para cancelamento.');
      setData(prev => prev ? { ...prev, cancelAtPeriodEnd: true } : prev);
    } catch (err) {
      toast.error('Falha ao cancelar assinatura.');
    } finally {
      setActionLoading(null);
    }
  };


  const handleReactivateSubscription = async () => {
    setActionLoading('reactivate');
    try {
      const token = session?.user?.token || localStorage.getItem('token');
      await api.post('/api/billing/reactivate-subscription', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Sua assinatura foi reativada com sucesso!');
      setData(prev => prev ? { ...prev, cancelAtPeriodEnd: false } : prev);
    } catch(err) {
        toast.error('Falha ao reativar assinatura.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateOfficeInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = inviteEmail.trim();

    if (!email) {
      toast.error('Informe o e-mail do convidado.');
      return;
    }

    setActionLoading('office_invite');
    try {
      const token = session?.user?.token || localStorage.getItem('token');
      await api.post('/api/billing/subscription/invites', { email }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInviteEmail('');
      toast.success('Convite enviado com sucesso.');
      await refreshSubscriptionData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Nao foi possivel enviar o convite.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveOfficeMember = async (member: OfficeWorkspaceMember) => {
    if (!confirm(`Remover ${member.user.name} desta assinatura?`)) return;

    setActionLoading(`remove_member_${member.id}`);
    try {
      const token = session?.user?.token || localStorage.getItem('token');
      await api.delete(`/api/billing/subscription/members/${member.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Membro removido e vaga liberada.');
      await refreshSubscriptionData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Nao foi possivel remover o membro.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeOfficeInvite = async (invite: OfficeWorkspaceInvite) => {
    if (!confirm(`Revogar o convite enviado para ${invite.email}?`)) return;

    setActionLoading(`revoke_invite_${invite.id}`);
    try {
      const token = session?.user?.token || localStorage.getItem('token');
      await api.delete(`/api/billing/subscription/invites/${invite.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Convite revogado.');
      await refreshSubscriptionData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Nao foi possivel revogar o convite.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckoutRedirect = async (planId: string) => {
    setActionLoading('checkout_' + planId);
    try {
      const token = session?.user?.token || localStorage.getItem('token');
      const res = await api.post('/api/billing/create-checkout-session', {
          plan: planId,
          interval: billingInterval,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
        toast.error('Não foi possível iniciar o checkout.');
    } finally {
        setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <main className={styles.root}>
        <div className={styles.container}>
          <div className={`${styles.skeleton} ${styles.title}`} />
          <div className={`${styles.skeleton} ${styles.text}`} />
          <div className={styles.grid}>
            <div className={`${styles.skeleton} ${styles.card}`} />
            <div className={`${styles.skeleton} ${styles.card}`} />
          </div>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const status = getStatusConfig(data.subscriptionStatus);
  const StatusIcon = status.icon;
  const officeWorkspace = data.officeWorkspace;
  const officeSeatAccess = data.officeSeatAccess;

  return (
    <div className={styles.root}>
      <Nav
        userInitials={userInitials}
        creating={creating}
        onCreateProject={handleCreateProject}
        onLogout={handleLogout}
      />
      <main className={styles.container}>
        <header className={styles.header}>
          <h1>Plano e Faturamento</h1>
          <p>Gerencie sua assinatura, formas de pagamento e acompanhe seu histórico de transações em um ambiente seguro.</p>
        </header>

        {data.subscriptionStatus === 'trialing' && data.trialEnd && (
          <div className={`${styles.alert} ${styles.info}`}>
            <Clock size={20} />
            <span>Seu período de avaliação gratuita termina em <strong>{formatDate(data.trialEnd)}</strong>. Aproveite todos os recursos!</span>
          </div>
        )}

        {data.cancelAtPeriodEnd && (
          <div className={`${styles.alert} ${styles.warning}`}>
            <AlertCircle size={20} />
            <span>Sua assinatura será encerrada em <strong>{formatDate(data.currentPeriodEnd)}</strong>. Você ainda pode reativá-la a qualquer momento.</span>
          </div>
        )}

        {data.subscriptionStatus === 'past_due' && (
          <div className={`${styles.alert} ${styles.error}`}>
            <AlertTriangle size={20} />
            <span>Houve um problema com sua última cobrança. Por favor, atualize seus dados de pagamento para evitar interrupções.</span>
          </div>
        )}

        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <Zap size={22} />
              Minha Assinatura
            </div>

            <div className={styles.planHeader}>
              <div className={styles.planNameBlock}>
                <div className={styles.planName}>
                  {data.planName} {data.quantity && data.quantity > 1 ? `(x${data.quantity})` : ''}
                  <span className={`${styles.badge} ${status.colorClass}`}>
                    <StatusIcon size={12} />
                    {status.label}
                  </span>
                </div>
              </div>
              <div className={styles.planPriceBlock}>
                <div className={styles.price}>{formatCurrency(data.amount)}</div>
                <div className={styles.interval}>por {data.billingInterval === 'yearly' ? 'ano' : 'mês'}</div>
              </div>
            </div>

            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <span>Ciclo de Faturamento</span>
                <strong>{formatDate(data.currentPeriodStart)} — {formatDate(data.currentPeriodEnd)}</strong>
              </div>
              <div className={styles.detailItem}>
                <span>Próxima Cobrança</span>
                <strong>{data.cancelAtPeriodEnd ? 'Indisponível' : formatDate(data.currentPeriodEnd)}</strong>
              </div>
            </div>

            <div className={styles.cardActions}>
              {data.cancelAtPeriodEnd ? (
                <button 
                  className={styles.btnPrimary} 
                  onClick={handleReactivateSubscription}
                  disabled={!!actionLoading}
                >
                  {actionLoading === 'reactivate' ? <RefreshCw className="animate-spin" /> : <RefreshCw size={18} />}
                  Reativar Assinatura AGORA
                </button>
              ) : (
                <>

                  <button 
                    className={styles.btnDanger} 
                    onClick={handleCancelSubscription}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === 'cancel' ? <RefreshCw className="animate-spin" /> : 'Cancelar Plano'}
                  </button>
                </>
              )}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}>
              <CreditCard size={22} />
              Informações Financeiras
            </div>

            <div className={styles.billingInfo}>
              <div className={styles.paymentMethod}>
                <div className={styles.iconWrapper}>
                  <CreditCard size={20} />
                </div>
                <div className={styles.info}>
                  <span>Cartão de Crédito</span>
                  <strong>{data.paymentMethodSummary}</strong>
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--zinc-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Histórico Recente</h3>
            
            <div className={styles.invoiceList}>
              {data.invoices.map(invoice => (
                <div key={invoice.id} className={styles.invoiceItem}>
                  <div className={styles.invoiceDetails}>
                    <span className={styles.date}>{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(invoice.created))}</span>
                    <span className={styles.amount}>{formatCurrency(invoice.amountPaid)}</span>
                    <span className={styles.statusPaid}>Pago</span>
                  </div>
                  <button className={styles.btnGhost} title="Baixar Recibo">
                    <Download size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.cardActions} style={{ marginTop: '2rem' }}>
              <button 
                className={styles.btnSecondary} 
                onClick={handlePortalRedirect}
                disabled={!!actionLoading}
              >
                {actionLoading === 'portal' ? <RefreshCw className="animate-spin" /> : <ExternalLink size={18} />}
                Gerenciar no Portal Stripe
              </button>
            </div>
          </section>
        </div>

        {officeSeatAccess && !officeWorkspace && (
          <section className={styles.card} style={{ marginTop: '1.5rem' }}>
            <div className={styles.cardTitle}>
              <Users size={22} />
              Minha Licenca OFFICE
            </div>
            <p style={{ color: 'var(--zinc-300)', marginBottom: '1rem' }}>
              Sua conta esta vinculada a assinatura OFFICE de <strong>{officeSeatAccess.owner.name}</strong>.
            </p>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <span>Assinatura dona</span>
                <strong>{officeSeatAccess.owner.email}</strong>
              </div>
              <div className={styles.detailItem}>
                <span>Uso da equipe</span>
                <strong>{officeSeatAccess.usedSeats} de {officeSeatAccess.totalSeats} licencas ocupadas</strong>
              </div>
            </div>
          </section>
        )}

        {officeWorkspace && (
          <section className={styles.card} style={{ marginTop: '1.5rem' }}>
            <div className={styles.cardTitle}>
              <Users size={22} />
              Gestao de Licencas OFFICE
            </div>

            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <span>Total de licencas</span>
                <strong>{officeWorkspace.totalSeats}</strong>
              </div>
              <div className={styles.detailItem}>
                <span>Licencas usadas</span>
                <strong>{officeWorkspace.usedSeats}</strong>
              </div>
              <div className={styles.detailItem}>
                <span>Licencas disponiveis</span>
                <strong>{officeWorkspace.availableSeats}</strong>
              </div>
              <div className={styles.detailItem}>
                <span>Regra do plano</span>
                <strong>O comprador ocupa 1 vaga automaticamente</strong>
              </div>
            </div>

            <form onSubmit={handleCreateOfficeInvite} style={{ marginTop: '1.5rem' }}>
              <div className={styles.cardTitle} style={{ marginBottom: '0.75rem' }}>
                <Mail size={18} />
                Convidar por e-mail
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="nome@empresa.com"
                  style={{
                    flex: '1 1 260px',
                    padding: '0.95rem 1rem',
                    borderRadius: '0.9rem',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'black'
                  }}
                />
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={actionLoading === 'office_invite' || officeWorkspace.availableSeats <= 0}
                >
                  {actionLoading === 'office_invite' ? <RefreshCw className="animate-spin" /> : <Mail size={18} />}
                  Enviar convite
                </button>
              </div>
            </form>

            <div style={{ marginTop: '2rem' }}>
              <div className={styles.cardTitle} style={{ marginBottom: '0.75rem' }}>
                <Users size={18} />
                Membros ativos
              </div>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {officeWorkspace.members.map((member) => (
                  <div key={member.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    alignItems: 'center',
                    padding: '1rem',
                    borderRadius: '1rem',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <div>
                      <strong>{member.user.name}</strong>
                      <div style={{ color: 'var(--zinc-400)', fontSize: '0.95rem' }}>{member.user.email}</div>
                      <div style={{ color: 'var(--zinc-500)', fontSize: '0.85rem' }}>
                        {member.seatType === 'OWNER' ? 'Proprietario da assinatura' : 'Membro convidado'}
                      </div>
                    </div>
                    {member.seatType === 'MEMBER' && (
                      <button
                        className={styles.btnDanger}
                        onClick={() => handleRemoveOfficeMember(member)}
                        disabled={actionLoading === `remove_member_${member.id}`}
                      >
                        {actionLoading === `remove_member_${member.id}` ? <RefreshCw className="animate-spin" /> : <UserMinus size={16} />}
                        Remover
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <div className={styles.cardTitle} style={{ marginBottom: '0.75rem' }}>
                <Mail size={18} />
                Convites enviados
              </div>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {officeWorkspace.invites.length === 0 && (
                  <p style={{ color: 'var(--zinc-400)' }}>Nenhum convite enviado ainda.</p>
                )}
                {officeWorkspace.invites.map((invite) => (
                  <div key={invite.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    alignItems: 'center',
                    padding: '1rem',
                    borderRadius: '1rem',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <div>
                      <strong>{invite.email}</strong>
                      <div style={{ color: 'var(--zinc-400)', fontSize: '0.9rem' }}>
                        Status: {invite.status} • Expira em {formatDate(invite.expiresAt)}
                      </div>
                    </div>
                    {invite.status === 'PENDING' && (
                      <button
                        className={styles.btnSecondary}
                        onClick={() => handleRevokeOfficeInvite(invite)}
                        disabled={actionLoading === `revoke_invite_${invite.id}`}
                      >
                        {actionLoading === `revoke_invite_${invite.id}` ? <RefreshCw className="animate-spin" /> : <XCircle size={16} />}
                        Revogar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}


      </main>
    </div>
  );
}

