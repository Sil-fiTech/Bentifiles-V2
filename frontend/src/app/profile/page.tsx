'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Nav } from '@/components/Nav';
import { useAccessGate } from '@/lib/hooks/useAccessGate';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, User, Mail, Shield, Save, ArrowLeft, CreditCard, ExternalLink, CheckCircle2 } from 'lucide-react';
import styles from './page.module.scss';

interface UserProfile {
    id: string;
    name: string;
    email: string;
    image?: string;
    createdAt: string;
}

export default function ProfilePage() {
    const router = useRouter();
    const { access, loading: accessLoading } = useAccessGate();
    const { data: session } = useSession();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [portalLoading, setPortalLoading] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [accessData, setAccessData] = useState<any>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        if (accessLoading || !access?.authenticated) return;

        const token = access.token;
        if (token) {
            fetchProfile(token);
        }
    }, [accessLoading, access]);

    const fetchProfile = async (token: string) => {
        try {
            setLoading(true);
            const [profileRes, accessRes] = await Promise.all([
                api.get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } }),
                api.get('/api/billing/access-status', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
            ]);
            
            setProfile(profileRes.data);
            setEditName(profileRes.data.name);
            if (accessRes) setAccessData(accessRes.data);
        } catch (error) {
            toast.error('Falha ao carregar dados do perfil');
        } finally {
            setLoading(false);
        }
    };

    const handleManageSubscription = async () => {
        const token = session?.user?.token || localStorage.getItem('token');
        try {
            setPortalLoading(true);
            const res = await api.post('/api/billing/create-portal-session', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.url) {
                window.location.href = res.data.url;
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Falha ao acessar o portal de faturamento');
        } finally {
            setPortalLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editName.trim()) {
            toast.error('O nome não pode ficar vazio');
            return;
        }

        const token = session?.user?.token || localStorage.getItem('token');
        try {
            setSaving(true);
            const res = await api.put('/api/users/me', { name: editName }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setProfile(res.data);
            toast.success('Perfil atualizado com sucesso!');
        } catch (error) {
            toast.error('Falha ao atualizar o perfil');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        localStorage.removeItem('token');
        if (session) {
            await signOut({ redirect: false });
        }
        router.push('/');
    };

    if (loading || !profile) {
        return (
            <div className={styles.loadingScreen}>
                <Loader2 size={32} className="animate-spin" style={{ color: '#f59e0b' }} />
            </div>
        );
    }

    const userInitials = profile.name.slice(0, 2).toUpperCase();
    const joinedDate = new Date(profile.createdAt).toLocaleDateString();

    return (
        <div className={styles.root}>

            <Nav
                userInitials={userInitials}
                context="dashboard"
                onLogout={handleLogout}
            />

            <main className={styles.main}>
                <button onClick={() => router.push('/dashboard')} className={styles.backBtn}>
                    <ArrowLeft size={18} /> Voltar ao Dashboard
                </button>

                <header className={styles.pageHeader}>
                    <h1 className={styles.pageTitle}>Meu Perfil</h1>
                    <p className={styles.pageSubtitle}>Gerencie suas informações pessoais e preferências da conta.</p>
                </header>

                <div className={styles.grid}>

                    {/* Left Panel: Profile Summary */}
                    <div>
                        <div className={styles.summaryCard}>
                            <div className={styles.avatarWrapper}>
                                <div className={styles.avatar}>{userInitials}</div>
                                <div className={styles.onlineDot} />
                            </div>
                            <h2 className={styles.profileName}>{profile.name}</h2>
                            <p className={styles.profileEmail}>{profile.email}</p>

                            <div className={styles.divider} />

                            <div className={styles.metaList}>
                                <div className={styles.metaItem}>
                                    <Shield size={16} />
                                    <span>Plano: {accessData?.subscriptionPlan || 'Padrão'}</span>
                                </div>
                                <div className={styles.metaItem}>
                                    <CheckCircle2 size={16} className={accessData?.hasSystemAccess ? 'text-green-500' : 'text-slate-400'} />
                                    <span>Status: {accessData?.hasSystemAccess ? 'Ativo' : 'Inativo'}</span>
                                </div>
                                <div className={styles.metaItem}>
                                    <User size={16} />
                                    <span>Membro desde {joinedDate}</span>
                                </div>
                            </div>
                        </div>

                        {accessData?.hasSelectedPlan && (
                          <div className={styles.summaryCard} style={{ marginTop: '1.5rem' }}>
                              <h3 className={styles.panelTitle} style={{ fontSize: '1rem', marginBottom: '1rem' }}>
                                  <CreditCard size={18} /> Assinatura
                              </h3>
                              <p className="text-sm text-slate-500 mb-4">
                                Gerencie sua forma de pagamento, histórico de faturas e plano atual no Stripe.
                              </p>
                              <button 
                                onClick={handleManageSubscription}
                                disabled={portalLoading}
                                className={styles.saveBtn}
                                style={{ width: '100%', justifyContent: 'center', background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0' }}
                              >
                                {portalLoading ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                                Gerenciar Assinatura
                              </button>
                          </div>
                        )}
                    </div>

                    {/* Right Panel: Edit Details */}
                    <div>
                        <div className={styles.editPanel}>
                            <h3 className={styles.panelTitle}>
                                <User size={20} />
                                Dados Pessoais
                            </h3>

                            <div className={styles.fieldList}>
                                <div>
                                    <label className={styles.fieldLabel}>Nome Completo</label>
                                    <input
                                        className={styles.fieldInput}
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        placeholder="Seu nome completo"
                                    />
                                </div>

                                <div>
                                    <label className={styles.fieldLabel}>Endereço de E-mail</label>
                                    <div className={styles.emailWrapper}>
                                        <Mail className={styles.emailIcon} size={18} />
                                        <input
                                            className={styles.fieldInputReadonly}
                                            value={profile.email}
                                            readOnly
                                            disabled
                                        />
                                    </div>
                                    <p className={styles.fieldHint}>O endereço de e-mail não pode ser alterado no momento.</p>
                                </div>
                            </div>

                            <div className={styles.panelFooter}>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || editName === profile.name}
                                    className={styles.saveBtn}
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Salvar Alterações
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
