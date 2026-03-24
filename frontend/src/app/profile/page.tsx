'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Nav } from '@/components/Nav';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, User, Mail, Shield, Save, ArrowLeft } from 'lucide-react';
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
    const { data: session, status } = useSession();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        if (status === 'loading') return;
        const localToken = localStorage.getItem('token');
        const activeToken = session?.user?.token || localToken;

        if (!activeToken) {
            router.push('/');
            return;
        }

        fetchProfile(activeToken);
    }, [status, session]);

    const fetchProfile = async (token: string) => {
        try {
            setLoading(true);
            const res = await api.get('/api/users/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProfile(res.data);
            setEditName(res.data.name);
        } catch (error) {
            toast.error('Falha ao carregar dados do perfil');
        } finally {
            setLoading(false);
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
                                    <span>Nível de Acesso: Padrão</span>
                                </div>
                                <div className={styles.metaItem}>
                                    <User size={16} />
                                    <span>Membro desde {joinedDate}</span>
                                </div>
                            </div>
                        </div>
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
