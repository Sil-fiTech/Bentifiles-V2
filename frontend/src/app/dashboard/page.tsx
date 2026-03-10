'use client';
import axios from 'axios';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { LogOut, Plus, Folder, Loader2, FileText } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';

interface Project {
    id: string;
    name: string;
    createdByUserId: string;
    createdAt: string;
}

export default function Dashboard() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const router = useRouter();
    const { data: session, status } = useSession();

    useEffect(() => {
        if (status === 'loading') return;

        const localToken = localStorage.getItem('token');
        const activeToken = session?.user?.token || localToken;

        if (!activeToken) {
            router.push('/');
            return;
        }

        fetchProjects(activeToken);
    }, [status, session]);

    const fetchProjects = async (token: string) => {
        try {
            setLoading(true);
            const res = await axios.get('http://localhost:3001/api/projects', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjects(res.data.projects);
        } catch (error) {
            toast.error('Falha ao buscar projetos');
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                handleLogout();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        localStorage.removeItem('token');
        if (session) {
            await signOut({ redirect: false });
        }
        router.push('/');
    };

    const handleCreateProject = async () => {
        try {
            setCreating(true);
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await axios.post('http://localhost:3001/api/projects', { name: 'Novo Projeto' }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjects(prev => [...prev, res.data.project]);
            toast.success('Projeto criado');
        } catch (error) {
            toast.error('Falha ao criar projeto');
        } finally {
            setCreating(false);
        }
    };

    const handleRename = async (id: string, newName: string) => {
        if (!newName.trim()) return;
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            await axios.patch(`http://localhost:3001/api/projects/${id}`, { name: newName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Projeto salvo');
            setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
        } catch (error) {
            toast.error('Falha ao renomear projeto');
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Meus Projetos</h1>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <button
                        onClick={() => router.push('/dashboard/documents')}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    >
                        <FileText size={18} /> Tipos de Documento
                    </button>
                    <button
                        onClick={handleCreateProject}
                        disabled={creating}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent-light)', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                        {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                        Criar Projeto
                    </button>
                    <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                        <LogOut size={18} /> Sair
                    </button>
                </div>
            </header>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                    <Loader2 size={32} className="animate-spin" color="var(--accent-light)" />
                </div>
            ) : projects.length === 0 ? (
                <div className="glass-panel" style={{ padding: '60px 40px', textAlign: 'center' }}>
                    <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Você ainda não tem nenhum projeto.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            className="glass-panel"
                            style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', cursor: 'pointer', transition: 'transform 0.2s ease', position: 'relative' }}
                            onClick={() => router.push(`/projects/${project.id}`)}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                                    <Folder size={24} color="var(--accent-light)" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <input
                                        type="text"
                                        defaultValue={project.name}
                                        onClick={(e) => e.stopPropagation()}
                                        onBlur={(e) => {
                                            if (e.target.value !== project.name) {
                                                handleRename(project.id, e.target.value);
                                            }
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid transparent',
                                            color: 'var(--text-primary)',
                                            fontSize: '1.2rem',
                                            fontWeight: 600,
                                            width: '100%',
                                            outline: 'none',
                                            padding: '4px 0'
                                        }}
                                        onFocus={(e) => (e.target as HTMLInputElement).style.borderBottom = '1px solid var(--accent-light)'}
                                        onMouseLeave={(e) => {
                                            if (document.activeElement !== e.target) {
                                                (e.target as HTMLInputElement).style.borderBottom = '1px solid transparent';
                                            }
                                        }}
                                    />
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                                        Criado em {new Date(project.createdAt).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
