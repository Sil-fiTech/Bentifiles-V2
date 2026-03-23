'use client';

import api from '@/lib/api';
import axios from 'axios';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Nav } from '@/components/Nav';
import {
    LayoutGrid, Folder, Tag, HelpCircle, Archive, Search, Bell, Settings,
    Plus, MoreVertical, Zap, CheckCircle2, AlertTriangle, XCircle, FileIcon,
    Loader2, Menu
} from 'lucide-react';

interface Project {
    id: string;
    name: string;
    createdByUserId: string;
    createdAt: string;
}

interface FileData {
    id: string;
    originalName: string;
    size: number;
    url: string;
    mimetype: string;
    createdAt: string;
    projectId?: string;
    user?: {
        name: string;
    };
    project?: {
        name: string;
    };
    verificationResults?: {
        status: string; // APPROVED, CONDITIONAL, REJECTED
        score: number;
        recommendation?: string;
    }[];
}

interface DashboardStats {
    totalUploads: number;
    rejectedUploads: number;
}

export default function Dashboard() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [files, setFiles] = useState<FileData[]>([]);
    const [pendingFiles, setPendingFiles] = useState<FileData[]>([]);
    const [stats, setStats] = useState<DashboardStats>({ totalUploads: 0, rejectedUploads: 0 });
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [activeTab, setActiveTab] = useState<'my-docs' | 'review-docs'>('my-docs');

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

        fetchData(activeToken);
    }, [status, session]);

    const fetchPendingFiles = async (token: string) => {
        try {
            // TODO: Integrar com a rota real de arquivos pendentes no futuro
            const res = await api.get('/api/files/pending', { headers: { Authorization: `Bearer ${token}` } });
            setPendingFiles(res.data.files || []);
            // setPendingFiles([]); // Mock vazio por enquanto até a API estar pronta
        } catch (error) {
            console.error('Falha ao buscar arquivos pendentes:', error);
        }
    };

    const fetchData = async (token: string) => {
        try {
            setLoading(true);

            // Check for pending invite before fetching projects
            const pendingInvite = localStorage.getItem('pendingInvite');
            if (pendingInvite) {
                try {
                    const joinRes = await api.post('/api/projects/join', {
                        inviteToken: pendingInvite
                    }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    localStorage.removeItem('pendingInvite');
                    toast.success(joinRes.data.message);

                    if (joinRes.data.projectId) {
                        router.push(`/projects/${joinRes.data.projectId}`);
                        return; // Stop fetching since we navigate away
                    }
                } catch (inviteError: any) {
                    console.error('Failed to process invite:', inviteError);
                    toast.error(inviteError.response?.data?.message || 'Falha ao processar convite');
                    localStorage.removeItem('pendingInvite');
                }
            }

            const [projectsRes, filesRes, statsRes, pendingFilesRes] = await Promise.all([
                api.get('/api/projects', { headers: { Authorization: `Bearer ${token}` } }),
                api.get('/api/files', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
                api.get('/api/files/stats', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
                api.get('/api/files/pending', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
            ]);

            setProjects(projectsRes.data.projects || []);
            setFiles(filesRes.data.files || []);
            setStats({
                totalUploads: statsRes.data.totalUploads || 0,
                rejectedUploads: statsRes.data.rejectedUploads || 0,
            });
            setPendingFiles(pendingFilesRes.data.files || []);
        } catch (error) {
            toast.error('Falha ao buscar dados do dashboard');
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
            const res = await api.post('/api/projects', { name: 'Novo Projeto' }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjects(prev => [...prev, res.data.project]);
            toast.success('Projeto criado');
            router.push(`/projects/${res.data.project.id}`);
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
            await api.patch(`/api/projects/${id}`, { name: newName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Projeto salvo');
            setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
        } catch (error) {
            toast.error('Falha ao renomear projeto');
        }
    };

    const activeProcessingFiles = files.filter(f => !f.verificationResults || f.verificationResults.length === 0);
    const hasActiveProcessing = activeProcessingFiles.length > 0;
    const processingPercentage = hasActiveProcessing ?
        Math.min(100, Math.round(((files.length - activeProcessingFiles.length) / Math.max(1, files.length)) * 100)) : 100;

    // Optional user fallback
    const userName = session?.user?.name || 'User';
    const userInitials = userName.substring(0, 2).toUpperCase();

    const isReviewTab = activeTab === 'review-docs';
    const displayedFiles = isReviewTab ? pendingFiles : files;

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-surface">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
        );
    }

    return (
        <div className="bg-background font-body text-on-surface antialiased overflow-hidden flex h-screen w-full relative">
            {/* Main Content Area */}
            <main className="flex-1 h-screen flex flex-col items-center bg-surface overflow-y-auto relative w-full custom-scrollbar">
                {/* Top Navigation Bar */}
                <Nav
                    userInitials={userInitials}
                    hasActiveProcessing={hasActiveProcessing}
                    creating={creating}
                    onCreateProject={handleCreateProject}
                    onLogout={handleLogout}
                />

                {/* Content Canvas */}
                <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 space-y-8 md:space-y-12 pb-24">
                    {/* Section: Recent Projects */}
                    <section>
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h2 className="text-3xl font-headline font-black text-zinc-900 tracking-tighter">Projetos Recentes</h2>
                                <p className="text-sm text-zinc-500 font-medium">Seus espaços de trabalho ativos no momento.</p>
                            </div>
                        </div>

                        {projects.length === 0 ? (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200/60 text-center">
                                <p className="text-zinc-500">Você não possui nenhum projeto ainda.</p>
                                <button onClick={handleCreateProject} className="mt-4 px-6 py-2.5 bg-amber-50 text-amber-600 font-bold hover:bg-amber-100/80 rounded-xl transition-all active:scale-[0.98]">
                                    Criar o primeiro projeto
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-6 overflow-x-auto custom-scrollbar pb-4 -mx-2 px-2">
                                {projects.slice(0, 5).map((project) => (
                                    <div
                                        key={project.id}
                                        onClick={() => router.push(`/projects/${project.id}`)}
                                        className="flex-shrink-0 w-[400px] group cursor-pointer"
                                    >
                                        <div className="bg-white rounded-xl overflow-hidden shadow-sm group-hover:bg-primary-fixed transition-colors duration-150 border border-zinc-200/60">
                                            <div className="h-48 relative overflow-hidden bg-zinc-800 flex items-center justify-center">
                                                <div className="absolute inset-0 opacity-20 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
                                                <Folder size={48} className="text-amber-400 opacity-80 group-hover:scale-110 transition-transform duration-300" />
                                                <div className="absolute top-4 left-4">
                                                    <span className="bg-tertiary-container text-on-tertiary-container text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter">
                                                        Ativo
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="p-6">
                                                <h3 className="font-headline font-bold text-xl mb-1 truncate" title={project.name}>{project.name}</h3>
                                                <p className="text-sm text-zinc-500 mb-4 truncate text-ellipsis">
                                                    Última mod.: {new Date(project.createdAt).toLocaleDateString()}
                                                </p>
                                                <div className="flex -space-x-2">
                                                    <div className="w-8 h-8 rounded-full bg-zinc-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-zinc-700">
                                                        {userInitials}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Section: Asset Intelligence */}
                    <section>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-3xl font-headline font-black text-zinc-900 tracking-tighter">Inteligência dos Arquivos</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                                    <p className="text-sm text-zinc-500 font-medium">
                                        {isReviewTab
                                            ? "Arquivos que precisam da sua avaliação."
                                            : "Histórico recente de validações."}
                                    </p>
                                </div>
                            </div>


                            <div className="flex gap-4">
                                <div className="flex bg-zinc-100/80 p-2 rounded-xl border border-zinc-200/60 shadow-inner">
                                    <button
                                        onClick={() => setActiveTab('my-docs')}
                                        className={`flex items-center gap-3 px-8 py-3.5 text-[15px] font-bold transition-all duration-300 rounded-xl whitespace-nowrap active:scale-[0.98] ${!isReviewTab
                                            ? 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-zinc-900 ring-1 ring-zinc-200/50'
                                            : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
                                            }`}
                                    >
                                        <Folder size={16} className={`transition-colors duration-300 ${!isReviewTab ? "text-amber-500" : "text-zinc-400"}`} />
                                        Meus documentos
                                    </button>
                                </div>


                                <div className="flex bg-zinc-100/80 p-2 rounded-xl border border-zinc-200/60 shadow-inner">
                                    <button
                                        onClick={() => setActiveTab('review-docs')}
                                        className={`flex items-center gap-3 px-8 py-3.5 text-[15px] font-bold transition-all duration-300 rounded-xl whitespace-nowrap active:scale-[0.98] ${isReviewTab
                                            ? 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-zinc-900 ring-1 ring-zinc-200/50'
                                            : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
                                            }`}
                                    >
                                        <CheckCircle2 size={16} className={`transition-colors duration-300 ${isReviewTab ? "text-amber-500" : "text-zinc-400"}`} />
                                        Documentos para avaliar
                                        {pendingFiles.length > 0 && (
                                            <span className={`ml-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider transition-colors duration-300 ${isReviewTab ? 'bg-amber-100 text-amber-700' : 'bg-zinc-200 text-zinc-500'
                                                }`}>
                                                {pendingFiles.length}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>


                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white border border-zinc-200/60 rounded-xl p-6 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-md bg-zinc-100 flex items-center justify-center">
                                        <Zap size={16} className="text-zinc-500" />
                                    </div>
                                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                        {isReviewTab ? "Aguardando Avaliação" : "Total Uploads"}
                                    </span>
                                </div>
                                <p className="text-3xl font-black font-headline text-zinc-900 tracking-tighter">
                                    {isReviewTab ? pendingFiles.length : stats.totalUploads}
                                </p>
                            </div>
                            <div className="bg-white border border-zinc-200/60 rounded-xl p-6 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-md bg-tertiary-container flex items-center justify-center">
                                        <CheckCircle2 size={16} className="text-tertiary" />
                                    </div>
                                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                        {isReviewTab ? "Avaliados Hoje" : "Aprovados"}
                                    </span>
                                </div>
                                <p className="text-3xl font-black font-headline text-zinc-900 tracking-tighter">
                                    {isReviewTab ? "0" : files.length}
                                </p>
                            </div>
                            <div className="bg-white border border-zinc-200/60 rounded-xl p-6 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-md bg-amber-50 flex items-center justify-center">
                                        <XCircle size={16} className="text-amber-500" />
                                    </div>
                                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                        {isReviewTab ? "Urgentes" : "Reprovados"}
                                    </span>
                                </div>
                                <p className="text-3xl font-black font-headline text-zinc-900 tracking-tighter">
                                    {isReviewTab ? "0" : stats.rejectedUploads}
                                </p>
                            </div>
                        </div>


                        {displayedFiles.length === 0 ? (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200/60 text-center">
                                <p className="text-zinc-500">
                                    {isReviewTab
                                        ? "Não há documentos pendentes para avaliação no momento."
                                        : "Você não possui arquivos validados ainda."}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {displayedFiles.slice(0, 8).map((file) => {
                                    console.log(file);
                                    const result = file.verificationResults?.[0];
                                    let statusColor = "bg-zinc-200";
                                    let statusTextColor = "text-zinc-700";
                                    let statusDot = "bg-zinc-400";
                                    let statusText = "PROCESSANDO";
                                    let score = result?.score || 0;

                                    if (isReviewTab) {
                                        statusColor = "bg-blue-50";
                                        statusTextColor = "text-blue-700";
                                        statusDot = "bg-blue-500";
                                        statusText = "PENDENTE";
                                    } else {
                                        statusText = result?.status || "PROCESSANDO";
                                        if (result?.status === 'APPROVED') {
                                            statusColor = "bg-tertiary-container";
                                            statusTextColor = "text-on-tertiary-container";
                                            statusDot = "bg-tertiary";
                                            statusText = "APROVADO";
                                        } else if (result?.status === 'CONDITIONAL') {
                                            statusColor = "bg-secondary-container";
                                            statusTextColor = "text-on-secondary-container";
                                            statusDot = "bg-amber-500";
                                            statusText = "REVISÃO";
                                        } else if (result?.status === 'REJECTED') {
                                            statusColor = "bg-error-container";
                                            statusTextColor = "text-on-error-container";
                                            statusDot = "bg-error";
                                            statusText = "REJEITADO";
                                        }
                                    }

                                    return (
                                        <div key={file.id} className="bg-white border border-zinc-200/60 p-6 rounded-xl group hover:bg-primary-fixed transition-colors duration-150 relative shadow-sm">
                                            <div className="aspect-square bg-zinc-50 rounded-lg overflow-hidden mb-4 relative flex items-center justify-center">
                                                {file.mimetype?.startsWith('image/') ? (
                                                    <img
                                                        src={file.url}
                                                        alt={file.originalName}
                                                        // @ts-ignore
                                                        onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL : 'http://localhost:3000'}/projects/${file.projectId}`, '_blank')}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <FileIcon size={48} className="text-zinc-300 group-hover:text-amber-500 transition-colors" />
                                                )}
                                            </div>
                                            <div className="flex items-start justify-between">
                                                <div className="w-full relative pr-4">
                                                    <h4 className="font-headline font-bold text-on-surface truncate pr-2 w-full" title={file.originalName}>
                                                        {file.originalName}
                                                    </h4>
                                                    {isReviewTab && (
                                                        <>
                                                            <p className="font-headline text-on-surface truncate pr-2 w-full text-xs text-zinc-600 mt-1" title={file.user?.name || 'Desconhecido'}>
                                                                Enviado por: <span className="font-normal">{file.user?.name || 'Desconhecido'}</span>
                                                            </p>
                                                           
                                                        </>
                                                    )}
                                                     <p className="font-headline text-on-surface truncate pr-2 w-full text-xs text-zinc-600" title={file.project?.name || 'Desconhecido'}>
                                                                Projeto: <span className="font-normal">{file.project?.name || 'Desconhecido'}</span>
                                                            </p>
                                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                                                        {(file.size / 1024 / 1024).toFixed(2)} MB • {(file.originalName.split('.').pop() || 'FILE').toUpperCase()}
                                                    </p>
                                                </div>
                                                {/* <MoreVertical className="text-zinc-400 group-hover:text-zinc-900 cursor-pointer flex-shrink-0" size={18} /> */}
                                            </div>

                                            <div className="mt-4 flex items-center justify-between">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold ${statusColor} ${statusTextColor}`}>
                                                    {statusText}
                                                </span>
                                                <div className={`w-2 h-2 rounded-full ${statusDot}`}></div>
                                            </div>
                                        </div>
                                    );
                                })}

                            </div>
                        )}
                    </section>
                </div>

                {/* Floating Action Component (Processing Info) */}
                {hasActiveProcessing && (
                    <div className="fixed bottom-8 right-8 bg-zinc-900 text-white p-4 rounded-xl shadow-2xl flex items-center gap-4 z-50 border-l-4 border-amber-400">
                        <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center">
                            <Zap className="text-amber-400" size={20} fill="currentColor" />
                        </div>
                        <div>
                            <p className="text-xs font-bold font-headline uppercase tracking-widest text-amber-50">Processamento Ativo</p>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-24 h-1 bg-zinc-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${processingPercentage}%` }}></div>
                                </div>
                                <span className="text-[10px] font-medium text-zinc-400 whitespace-nowrap">{activeProcessingFiles.length} na fila</span>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
