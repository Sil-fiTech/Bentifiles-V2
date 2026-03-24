'use client';

import api from '@/lib/api';
import axios from 'axios';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Nav } from '@/components/Nav';
import {
    Folder, Zap, CheckCircle2, XCircle, FileIcon, Loader2
} from 'lucide-react';
import styles from './page.module.scss';

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
    user?: { name: string; };
    project?: { name: string; };
    verificationResults?: {
        status: string;
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
        if (!activeToken) { router.push('/'); return; }
        fetchData(activeToken);
    }, [status, session]);

    const fetchData = async (token: string) => {
        try {
            setLoading(true);

            const pendingInvite = localStorage.getItem('pendingInvite');
            if (pendingInvite) {
                try {
                    const joinRes = await api.post('/api/projects/join', { inviteToken: pendingInvite }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    localStorage.removeItem('pendingInvite');
                    toast.success(joinRes.data.message);
                    if (joinRes.data.projectId) { router.push(`/projects/${joinRes.data.projectId}`); return; }
                } catch (inviteError: any) {
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
            if (axios.isAxiosError(error) && error.response?.status === 401) handleLogout();
        } finally {
            setLoading(false);
        }
    };

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
            setProjects(prev => [...prev, res.data.project]);
            toast.success('Projeto criado');
            router.push(`/projects/${res.data.project.id}`);
        } catch { toast.error('Falha ao criar projeto'); }
        finally { setCreating(false); }
    };

    const activeProcessingFiles = files.filter(f => !f.verificationResults || f.verificationResults.length === 0);
    const hasActiveProcessing = activeProcessingFiles.length > 0;
    const processingPercentage = hasActiveProcessing
        ? Math.min(100, Math.round(((files.length - activeProcessingFiles.length) / Math.max(1, files.length)) * 100))
        : 100;

    const userName = session?.user?.name || 'User';
    const userInitials = userName.substring(0, 2).toUpperCase();

    const isReviewTab = activeTab === 'review-docs';
    const displayedFiles = isReviewTab ? pendingFiles : files;

    if (loading) {
        return (
            <div className={styles.loadingScreen}>
                <Loader2 className="animate-spin" style={{ width: 32, height: 32, color: '#f59e0b' }} />
            </div>
        );
    }

    return (
        <div className={styles.root}>
            <main className={styles.main}>
                <Nav
                    userInitials={userInitials}
                    hasActiveProcessing={hasActiveProcessing}
                    creating={creating}
                    onCreateProject={handleCreateProject}
                    onLogout={handleLogout}
                />

                <div className={styles.canvas}>

                    {/* Section: Recent Projects */}
                    <section style={{ marginBottom: '3rem' }}>
                        <div className={styles.sectionHeader}>
                            <div>
                                <h2 className={styles.sectionTitle}>Projetos Recentes</h2>
                                <p className={styles.sectionSubtitle}>Seus espaços de trabalho ativos no momento.</p>
                            </div>
                        </div>

                        {projects.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p className={styles.emptyText}>Você não possui nenhum projeto ainda.</p>
                                <button onClick={handleCreateProject} className={styles.emptyBtn}>
                                    Criar o primeiro projeto
                                </button>
                            </div>
                        ) : (
                            <div className={styles.projectsRow}>
                                {projects.slice(0, 5).map((project) => (
                                    <div
                                        key={project.id}
                                        onClick={() => router.push(`/projects/${project.id}`)}
                                        className={styles.projectCardWrapper}
                                    >
                                        <div className={styles.projectCard}>
                                            <div className={styles.projectThumb}>
                                                <div className={styles.projectThumbPattern} />
                                                <Folder size={48} className={styles.projectFolderIcon} />
                                                <div className={styles.projectBadge}>Ativo</div>
                                            </div>
                                            <div className={styles.projectInfo}>
                                                <h3 className={styles.projectName} title={project.name}>{project.name}</h3>
                                                <p className={styles.projectDate}>
                                                    Última mod.: {new Date(project.createdAt).toLocaleDateString()}
                                                </p>
                                                <div style={{ display: 'flex', marginLeft: '-0.5rem' }}>
                                                    <div className={styles.projectAvatar}>{userInitials}</div>
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
                        <div className={styles.sectionHeader}>
                            <div>
                                <h2 className={styles.sectionTitle}>Inteligência dos Arquivos</h2>
                                <div className={styles.sectionIndicator}>
                                    <span className={styles.sectionDot} />
                                    <p className={styles.sectionSubtitle}>
                                        {isReviewTab
                                            ? 'Arquivos que precisam da sua avaliação.'
                                            : 'Histórico recente de validações.'}
                                    </p>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className={styles.tabsWrapper}>
                                <div className={styles.tabGroup}>
                                    <button
                                        onClick={() => setActiveTab('my-docs')}
                                        className={`${styles.tabBtn} ${!isReviewTab ? styles.active : ''}`}
                                    >
                                        <Folder size={16} className={`${styles.tabIcon} ${!isReviewTab ? styles.active : ''}`} />
                                        Meus documentos
                                    </button>
                                </div>
                                <div className={styles.tabGroup}>
                                    <button
                                        onClick={() => setActiveTab('review-docs')}
                                        className={`${styles.tabBtn} ${isReviewTab ? styles.active : ''}`}
                                    >
                                        <CheckCircle2 size={16} className={`${styles.tabIcon} ${isReviewTab ? styles.active : ''}`} />
                                        Documentos para avaliar
                                        {pendingFiles.length > 0 && (
                                            <span className={`${styles.tabBadge} ${isReviewTab ? styles.active : ''}`}>
                                                {pendingFiles.length}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Stats cards */}
                        <div className={styles.statsGrid}>
                            <div className={styles.statCard}>
                                <div className={styles.statHeader}>
                                    <div className={`${styles.statIcon} ${styles.neutral}`}>
                                        <Zap size={16} />
                                    </div>
                                    <span className={styles.statLabel}>
                                        {isReviewTab ? 'Aguardando Avaliação' : 'Total Uploads'}
                                    </span>
                                </div>
                                <p className={styles.statValue}>
                                    {isReviewTab ? pendingFiles.length : stats.totalUploads}
                                </p>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statHeader}>
                                    <div className={`${styles.statIcon} ${styles.positive}`}>
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <span className={styles.statLabel}>
                                        {isReviewTab ? 'Avaliados Hoje' : 'Aprovados'}
                                    </span>
                                </div>
                                <p className={styles.statValue}>
                                    {isReviewTab ? '0' : files.length}
                                </p>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statHeader}>
                                    <div className={`${styles.statIcon} ${styles.warning}`}>
                                        <XCircle size={16} />
                                    </div>
                                    <span className={styles.statLabel}>
                                        {isReviewTab ? 'Urgentes' : 'Reprovados'}
                                    </span>
                                </div>
                                <p className={styles.statValue}>
                                    {isReviewTab ? '0' : stats.rejectedUploads}
                                </p>
                            </div>
                        </div>

                        {/* Files */}
                        {displayedFiles.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p className={styles.emptyText}>
                                    {isReviewTab
                                        ? 'Não há documentos pendentes para avaliação no momento.'
                                        : 'Você não possui arquivos validados ainda.'}
                                </p>
                            </div>
                        ) : (
                            <div className={styles.fileGrid}>
                                {displayedFiles.slice(0, 8).map((file) => {
                                    const result = file.verificationResults?.[0];
                                    let statusColor = 'bg-zinc-200';
                                    let statusTextColor = 'text-zinc-700';
                                    let statusDotColor = 'bg-zinc-400';
                                    let statusText = 'PROCESSANDO';

                                    if (isReviewTab) {
                                        statusColor = 'bg-blue-50';
                                        statusTextColor = 'text-blue-700';
                                        statusDotColor = 'bg-blue-500';
                                        statusText = 'PENDENTE';
                                    } else {
                                        statusText = result?.status || 'PROCESSANDO';
                                        if (result?.status === 'APPROVED') {
                                            statusColor = 'bg-tertiary-container';
                                            statusTextColor = 'text-on-tertiary-container';
                                            statusDotColor = 'bg-tertiary';
                                            statusText = 'APROVADO';
                                        } else if (result?.status === 'CONDITIONAL') {
                                            statusColor = 'bg-secondary-container';
                                            statusTextColor = 'text-on-secondary-container';
                                            statusDotColor = 'bg-amber-500';
                                            statusText = 'REVISÃO';
                                        } else if (result?.status === 'REJECTED') {
                                            statusColor = 'bg-error-container';
                                            statusTextColor = 'text-on-error-container';
                                            statusDotColor = 'bg-error';
                                            statusText = 'REJEITADO';
                                        }
                                    }

                                    return (
                                        <div key={file.id} className={styles.fileCard}>
                                            <div className={styles.fileThumb}>
                                                {file.mimetype?.startsWith('image/') ? (
                                                    <img
                                                        src={file.url}
                                                        alt={file.originalName}
                                                        // @ts-ignore
                                                        onClick={() => window.open(`${process.env.NEXT_PUBLIC_LOCAL_FRONT_URL || process.env.NEXT_PUBLIC_FRONT_URL || 'http://localhost:3000'}/projects/${file.projectId}`, '_blank')}
                                                        className={styles.fileThumbImg}
                                                    />
                                                ) : (
                                                    <FileIcon size={48} className={styles.fileIcon} />
                                                )}
                                            </div>
                                            <div className={styles.fileMeta}>
                                                <div className={styles.fileInfo}>
                                                    <h4 className={styles.fileName} title={file.originalName}>
                                                        {file.originalName}
                                                    </h4>
                                                    {isReviewTab && (
                                                        <p className={styles.fileBy} title={file.user?.name || 'Desconhecido'}>
                                                            Enviado por: <span style={{ fontWeight: 400 }}>{file.user?.name || 'Desconhecido'}</span>
                                                        </p>
                                                    )}
                                                    <p className={styles.fileProject} title={file.project?.name || 'Desconhecido'}>
                                                        Projeto: <span style={{ fontWeight: 400 }}>{file.project?.name || 'Desconhecido'}</span>
                                                    </p>
                                                    <p className={styles.fileSize}>
                                                        {(file.size / 1024 / 1024).toFixed(2)} MB • {(file.originalName.split('.').pop() || 'FILE').toUpperCase()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={styles.fileFooter}>
                                                <span
                                                    className={styles.statusBadge}
                                                    style={{
                                                        background: `var(--${statusColor.replace('bg-', 'color-').replace('-', '-')})`,
                                                    }}
                                                >
                                                    {statusText}
                                                </span>
                                                <div className={styles.statusDot} style={{ background: `var(--color-${statusDotColor.replace('bg-', '')})` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>

                {/* Floating processing bar */}
                {hasActiveProcessing && (
                    <div className={styles.processingBar}>
                        <div className={styles.processingIconWrapper}>
                            <Zap style={{ color: '#fbbf24' }} size={20} fill="currentColor" />
                        </div>
                        <div>
                            <p className={styles.processingTitle}>Processamento Ativo</p>
                            <div className={styles.processingProgress}>
                                <div className={styles.progressTrack}>
                                    <div className={styles.progressFill} style={{ width: `${processingPercentage}%` }} />
                                </div>
                                <span className={styles.processingCount}>{activeProcessingFiles.length} na fila</span>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
