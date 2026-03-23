'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Nav } from '@/components/Nav';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, User, Mail, Shield, Save, ArrowLeft } from 'lucide-react';

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
            <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-amber-500" />
            </div>
        );
    }

    const userInitials = profile.name.slice(0, 2).toUpperCase();
    const joinedDate = new Date(profile.createdAt).toLocaleDateString();

    return (
        <div className="bg-zinc-50 font-body text-zinc-900 min-h-screen custom-scrollbar relative flex flex-col items-center">
            
            <Nav
                userInitials={userInitials}
                context="dashboard"
                onLogout={handleLogout}
            />

            <main className="w-full max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 space-y-8 z-10">
                <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 hover:bg-white px-3 py-2 rounded-lg shadow-sm font-bold text-sm transition-all w-fit active:scale-[0.98]">
                    <ArrowLeft size={18} /> Voltar ao Dashboard
                </button>

                <header className="mb-8">
                    <h1 className="text-3xl font-headline font-black text-zinc-900 tracking-tighter">Meu Perfil</h1>
                    <p className="text-zinc-500 font-medium mt-1">Gerencie suas informações pessoais e preferências da conta.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    
                    {/* Left Panel: Profile Summary */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-white border border-zinc-200/60 p-6 rounded-xl shadow-sm flex flex-col items-center text-center">
                            <div className="w-24 h-24 rounded-xl bg-zinc-800 text-white flex items-center justify-center font-bold text-3xl tracking-widest border border-amber-400/50 shadow-md mb-4 bg-gradient-to-br from-zinc-800 to-zinc-900 relative">
                                {userInitials}
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full"></div>
                            </div>
                            <h2 className="font-headline font-bold text-xl text-zinc-900">{profile.name}</h2>
                            <p className="text-zinc-500 text-sm">{profile.email}</p>
                            
                            <div className="w-full h-px bg-zinc-200/60 my-6"></div>
                            
                            <div className="flex flex-col gap-3 w-full text-left text-sm">
                                <div className="flex items-center gap-3 text-zinc-600 font-medium">
                                    <Shield size={16} className="text-zinc-400" />
                                    <span>Nível de Acesso: Padrão</span>
                                </div>
                                <div className="flex items-center gap-3 text-zinc-600 font-medium">
                                    <User size={16} className="text-zinc-400" />
                                    <span>Membro desde {joinedDate}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Edit Details */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white border border-zinc-200/60 p-6 md:p-8 rounded-xl shadow-sm">
                            <h3 className="font-headline font-bold text-lg text-zinc-900 mb-6 flex items-center gap-2">
                                <User size={20} className="text-amber-500" />
                                Dados Pessoais
                            </h3>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5 px-1">Nome Completo</label>
                                    <input
                                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 focus:bg-white transition-all outline-none text-zinc-900 text-[15px] font-medium placeholder:text-zinc-400 shadow-sm"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        placeholder="Seu nome completo"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5 px-1">Endereço de E-mail</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                        <input
                                            className="w-full pl-11 pr-4 py-3 bg-zinc-100/80 border border-zinc-200/50 rounded-xl outline-none text-zinc-500 text-[15px] font-medium cursor-not-allowed"
                                            value={profile.email}
                                            readOnly
                                            disabled
                                        />
                                    </div>
                                    <p className="text-xs text-zinc-400 mt-2 px-1">O endereço de e-mail não pode ser alterado no momento.</p>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-zinc-200/60 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={saving || editName === profile.name}
                                    className="px-6 py-2.5 bg-amber-400 text-amber-950 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-headline font-bold flex items-center gap-2 shadow-sm transition-all active:scale-[0.98]"
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
