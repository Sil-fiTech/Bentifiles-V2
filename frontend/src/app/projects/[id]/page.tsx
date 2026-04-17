'use client';

import api from '@/lib/api';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    FolderOpen, Users, Loader2, Plus,
    User as UserIcon, ChevronRight, Share, Edit,
    FileText, Search as SearchIcon, ChevronDown,
    File as FileIcon, Eye,
    UploadCloud, ArrowLeft, Shield, AlertTriangle, CheckCircle, XCircle,
    Download, LayoutGrid,
    Folder,
    Settings
} from 'lucide-react';
import { Nav } from '@/components/Nav';
import { useAccessGate } from '@/lib/hooks/useAccessGate';
import JSZip from 'jszip';
import styles from './page.module.scss';

export default function ProjectPage() {
    const { id } = useParams();
    const router = useRouter();
    const { access, loading: accessLoading } = useAccessGate();
    const [project, setProject] = useState<any>(null);
    const [files, setFiles] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [requiredDocs, setRequiredDocs] = useState<any[]>([]);
    const [clientDocs, setClientDocs] = useState<any[]>([]);
    const [currentUserPermissions, setCurrentUserPermissions] = useState<string[]>([]);

    const [loading, setLoading] = useState(true);
    const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState('');

    const { data: session, status } = useSession();
    console.log(session);
    

    useEffect(() => {
        // Only fetch data if we are authenticated
        if (accessLoading || !access?.authenticated) return;

        const token = access.token;
        if (token && id) {
            fetchData(token);
        }
    }, [id, accessLoading, access]);

    const fetchData = async (token: string) => {
        try {
            setLoading(true);
            const headers = { Authorization: `Bearer ${token}` };
            const response = await api.get(`/api/projects/${id}/details`, { headers });
            const { project, files, members, requiredDocuments, clientDocuments, currentUserPermissions } = response.data;
            setProject(project);
            setFiles(files);
            setMembers(members);
            setRequiredDocs(requiredDocuments);
            setClientDocs(clientDocuments);
            setCurrentUserPermissions(currentUserPermissions);

            try {
                const payload = JSON.parse(atob((token || '').split('.')[1]));
                setCurrentUser(payload);
            } catch (e) { }
        } catch (error) {
            console.log(error);
            toast.error('Falha ao carregar projeto');
            router.push('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const hasPermission = (permission: string) => currentUserPermissions.includes(permission);
    const isAdmin = currentUserPermissions.includes('PROJECT_EDIT');
    const toggleUserExpand = (userId: string) => setExpandedUsers(prev => ({ ...prev, [userId]: !prev[userId] }));

    const generateInvite = async () => {
        if (project?.status === 'ARCHIVED') { toast.error('Projeto arquivado. Não é possível gerar convites.'); return; }
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await api.post(`/api/projects/${id}/invites`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const link = `${window.location.origin}/?invite=${res.data.invite.token}`;
            navigator.clipboard.writeText(link);
            toast.success('Link de convite copiado!');
        } catch { toast.error('Falha ao gerar convite'); }
    };

    const handleRename = async () => {
        if (project?.status === 'ARCHIVED') { toast.error('Projeto arquivado.'); setIsEditingName(false); return; }
        if (!newName.trim() || newName === project?.name) { setIsEditingName(false); return; }
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await api.patch(`/api/projects/${id}`, { name: newName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Projeto renomeado com sucesso!');
            setProject((prev: any) => ({ ...prev, name: res.data.name || newName }));
            setIsEditingName(false);
        } catch { toast.error('Falha ao renomear projeto'); }
    };

    const handleUploadSpecificDocument = async (acceptedFiles: File[], docTypeId: string, targetUserId?: string) => {
        if (project?.status === 'ARCHIVED') { toast.error('Projeto arquivado.'); return; }
        if (!hasPermission('DOCUMENT_UPLOAD') && !isAdmin) { toast.error('Você não tem permissão para enviar documentos'); return; }
        if (acceptedFiles.length === 0) return;

        const ownerId = targetUserId || currentUser?.userId;
        const uploadKey = `${docTypeId}-${ownerId}`;
        setUploadingDocType(uploadKey);
        setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));

        const file = acceptedFiles[0];
        const token = session?.user?.token || localStorage.getItem('token');
        const toastId = toast.loading(`Enviando ${file.name}...`);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('projectId', id as string);

            const uploadRes = await api.post('/api/files/upload', formData, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const pct = Math.round((progressEvent.loaded * 100) / (progressEvent.total || file.size));
                    setUploadProgress(prev => ({ ...prev, [uploadKey]: pct }));
                    if (pct === 100) toast.loading(`Analisando a qualidade de ${file.name}...`, { id: toastId });
                }
            });

            const dbFile = uploadRes.data.file;
            const docStatus = uploadRes.data.docStatus;

            const clientDocRes = await api.post(`/api/projects/${id}/client-documents`, {
                documentTypeId: docTypeId,
                ownerUserId: ownerId,
                fileId: dbFile.id,
                status: docStatus
            }, { headers: { Authorization: `Bearer ${token}` } });

            setClientDocs(prev => [clientDocRes.data, ...prev.filter(d => !(d.documentTypeId === docTypeId && d.ownerUserId === ownerId))]);
            toast.success('Documento enviado com sucesso!', { id: toastId });
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Falha ao enviar documento', { id: toastId });
        } finally {
            setUploadingDocType(null);
            setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));
        }
    };

    const handleViewFile = async (url: string) => {
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            toast.loading('Iniciando visualização', { id: 'loading-file' });
            const response = await api.get(`/api/files/base64`, { params: { url }, headers: { Authorization: `Bearer ${token}` } });
            toast.dismiss('loading-file');
            const { base64, mimeType } = response.data;
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
            window.open(URL.createObjectURL(blob), '_blank');
        } catch { toast.dismiss('loading-file'); toast.error('Falha ao abrir arquivo'); }
    };

    const updateDocStatus = async (docId: string, statusText: string, reason?: string) => {
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await api.patch(`/api/documents/${docId}/status`, {
                status: statusText, rejectionReason: reason, projectId: id
            }, { headers: { Authorization: `Bearer ${token}` } });
            setClientDocs(prev => prev.map(d => d.id === docId ? res.data : d));
            toast.success('Status atualizado');
        } catch { toast.error('Falha ao atualizar'); }
    };

    const handleDownloadFile = async (doc: any) => {
        try {
            const userSlug = doc.ownerUser.name.trim().replace(/\s+/g, '_');
            const typeSlug = doc.documentType.name.trim().replace(/\s+/g, '_');
            const filename = `${userSlug}_${typeSlug}`;
            const token = session?.user?.token || localStorage.getItem('token');
            const response = await api.get(`/api/files/base64`, { params: { url: doc.file.url }, headers: { Authorization: `Bearer ${token}` } });
            const { base64, mimeType } = response.data;
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
            const urlObject = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = urlObject;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(urlObject);
        } catch { toast.error('Falha ao baixar arquivo'); }
    };

    const handleDownloadAll = async () => {
        if (!clientDocs || clientDocs.length === 0) {
            toast.error('Nenhum arquivo disponível para download');
            return;
        }

        const toastId = toast.loading('Preparando arquivos para download...');
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch all project files in a single request
            const response = await api.get(`/api/files/project/${id}/base64`, { headers });
            const { files: projectFiles } = response.data;

            if (!projectFiles || projectFiles.length === 0) {
                toast.error('Nenhum arquivo encontrado no servidor', { id: toastId });
                return;
            }

            const zip = new JSZip();
            toast.loading(`Compactando ${projectFiles.length} arquivos...`, { id: toastId });

            for (const fileData of projectFiles) {
                const { base64, originalName, metadata } = fileData;
                
                const byteCharacters = atob(base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let j = 0; j < byteCharacters.length; j++) {
                    byteNumbers[j] = byteCharacters.charCodeAt(j);
                }
                const byteArray = new Uint8Array(byteNumbers);

                // Organizar nome do arquivo no ZIP
                const userSlug = metadata.userName.trim().replace(/\s+/g, '_');
                const typeSlug = metadata.documentType.trim().replace(/\s+/g, '_');
                const fileName = `${typeSlug}_${userSlug}_${originalName}`;

                zip.file(fileName, byteArray);
            }

            toast.loading('Gerando arquivo final...', { id: toastId });
            const content = await zip.generateAsync({ type: 'blob' });

            const zipName = `${project?.name || 'Projeto'}_Arquivos.zip`.replace(/\s+/g, '_');
            const urlObject = window.URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = urlObject;
            link.download = zipName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(urlObject);

            toast.success('Download concluído!', { id: toastId });
        } catch (error) {
            console.error('Erro no download bulk:', error);
            toast.error('Falha ao baixar arquivos do projeto', { id: toastId });
        }
    };

    const getStatusStyle = (statusCode: string) => {
        switch (statusCode) {
            case 'approved': return { style: { background: '#ecfdf5', color: '#047857', boxShadow: '0 0 0 1px rgba(167,243,208,0.5) inset' }, label: 'Aprovado' };
            case 'rejected': return { style: { background: '#fef2f2', color: '#b91c1c', boxShadow: '0 0 0 1px rgba(254,202,202,0.5) inset' }, label: 'Rejeitado' };
            case 'pending': return { style: { background: '#fffbeb', color: '#d97706', boxShadow: '0 0 0 1px rgba(253,230,138,0.5) inset' }, label: 'Em Análise' };
            default: return { style: { background: '#f4f4f5', color: '#52525b', boxShadow: '0 0 0 1px rgba(228,228,231,0.5) inset' }, label: 'Pendente' };
        }
    };

    if (loading) {
        return <div className={styles.loadingScreen}><Loader2 size={32} className="animate-spin" style={{ color: '#f59e0b' }} /></div>;
    }

    const nonAdminMembers = members.filter(m => !m.permissions?.includes('PROJECT_EDIT'));
    const totalUsers = members.length;
    const totalDocsSent = clientDocs.length;
    const totalRequiredPerUser = requiredDocs.length;
    const pendingDocs = clientDocs.filter(d => d.status === 'pending').length;
    const targetDocs = nonAdminMembers.length * totalRequiredPerUser;
    const approvedDocs = clientDocs.filter(d => d.status === 'approved' && nonAdminMembers.some(m => m.userId === d.ownerUserId)).length;
    const completionRate = targetDocs > 0 ? Math.round((approvedDocs / targetDocs) * 100) : 100;
    const timeAgo = project?.updatedAt ? new Date(project.updatedAt).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Recentemente';
    const membersToDisplay = isAdmin
        ? members.filter(m => !m.permissions?.includes('PROJECT_EDIT'))
        : members.filter(m => m.userId === currentUser?.userId);
    const filteredMembers = membersToDisplay.filter(m =>
        m.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const userName = session?.user?.name || 'User';
    const userInitials = userName.substring(0, 2).toUpperCase();

    return (
        <div className={styles.root}>
            <main className={styles.main}>
                <Nav
                    context="project"
                    projectName={project?.name}
                    userInitials={userInitials}
                    onLogout={async () => {
                        localStorage.removeItem('token');
                        router.push('/');
                        if (session) {
                            const { signOut } = await import('next-auth/react');
                            await signOut({ redirect: false });
                        }
                        router.push('/');
                    }}
                />

                <div className={styles.canvas}>
                    {/* Header */}
                    <header className={styles.pageHeader}>
                        <div>
                            <nav className={styles.breadcrumb}>
                                <button className={styles.breadcrumbLink} onClick={() => router.push('/dashboard')}>Projetos</button>
                                <ChevronRight size={12} />
                                <span className={styles.breadcrumbActive}>Detalhes</span>
                            </nav>
                            <div className={styles.titleRow}>
                                {isEditingName ? (
                                    <>
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                            disabled={loading}
                                            autoFocus
                                            className={styles.titleInput}
                                        />
                                        <button onClick={handleRename} className={styles.saveNameBtn} title="Salvar">
                                            <CheckCircle size={22} />
                                        </button>
                                        <button onClick={() => setIsEditingName(false)} className={styles.cancelNameBtn} title="Cancelar">
                                            <XCircle size={22} />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <h1 className={styles.pageTitle}>{project?.name || 'Detalhes do Projeto'}</h1>
                                        {isAdmin && project?.status !== 'ARCHIVED' && (
                                            <button
                                                onClick={() => { setNewName(project?.name || ''); setIsEditingName(true); }}
                                                className={styles.editBtn}
                                                title="Renomear Projeto"
                                            >
                                                <Edit size={20} />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className={styles.headerMeta}>
                                <span className={`${styles.statusBadge} ${project?.status === 'ARCHIVED' ? styles.archived : ''}`}>
                                    <span className={styles.statusDot} />
                                    {project?.status === 'ARCHIVED' ? 'Arquivado' : (project?.status === 'ACTIVE' ? 'Ativo' : 'Em andamento')}
                                </span>
                                <span className={styles.updatedAt}>Atualizado: {timeAgo}</span>
                            </div>
                        </div>
                        {isAdmin && (
                            <div className={styles.headerActions}>
                                {project?.status !== 'ARCHIVED' && (
                                    <button onClick={generateInvite} className={styles.inviteBtn}>
                                        <Share size={16} /> Convite
                                    </button>
                                )}
                                <button
                                    onClick={() => router.push(`/projects/${id}/documents`)}
                                    className={styles.inviteBtn}
                                >
                                    <Settings size={16} /> Configurações do projeto
                                </button>
                                <button
                                    onClick={() => handleDownloadAll()}
                                    className={styles.inviteBtn}
                                >
                                    <Download size={16} /> Download ZIP
                                </button>
                            </div>
                        )}
                    </header>

                    {/* Metrics */}
                    <section className={styles.metricsGrid}>
                        <div className={styles.metricCard}>
                            <Users className={styles.metricIcon} size={24} />
                            <div>
                                <p className={styles.metricValue}>{totalUsers}</p>
                                <p className={styles.metricLabel}>Contribuidores</p>
                            </div>
                        </div>
                        <div className={styles.metricCard}>
                            <FileText className={styles.metricIcon} size={24} />
                            <div>
                                <p className={styles.metricValue}>{totalDocsSent}</p>
                                <p className={styles.metricLabel}>Documentos Enviados</p>
                            </div>
                        </div>
                        <div className={`${styles.metricCard} ${styles.danger}`}>
                            <AlertTriangle className={`${styles.metricIcon} ${styles.danger}`} size={24} />
                            <div>
                                <p className={styles.metricValue}>{pendingDocs}</p>
                                <p className={styles.metricLabel}>Revisões Pendentes</p>
                            </div>
                        </div>
                        <div className={`${styles.metricCard} ${styles.dark}`}>
                            <div className={styles.progressRingWrapper}>
                                <div>
                                    <p className={styles.metricValue}>{completionRate}%</p>
                                    <p className={styles.metricLabel}>Progresso Geral</p>
                                </div>
                                <div className={styles.progressRingViz}>
                                    <svg className="w-24 h-24 -rotate-90" width={96} height={96}>
                                        <circle cx="48" cy="48" fill="transparent" r="38" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                                        <circle cx="48" cy="48" fill="transparent" r="38" stroke="#fbbf24"
                                            strokeDasharray="239"
                                            strokeDashoffset={239 - (239 * completionRate) / 100}
                                            strokeLinecap="round" strokeWidth="8"
                                            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                                        />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Team checklist */}
                    <div className={styles.teamHeader}>
                        <h2 className={styles.teamTitle}>
                            {isAdmin ? 'Checklist da Equipe' : 'Meus Documentos'}
                        </h2>
                        {isAdmin && (
                            <div className={styles.searchBox}>
                                <SearchIcon style={{ color: '#a1a1aa' }} size={16} />
                                <input
                                    className={styles.searchInput}
                                    placeholder="Buscar usuários..."
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    <div className={styles.memberList}>
                        {filteredMembers.length === 0 && (
                            <div className={styles.memberEmpty}>
                                <Users size={40} style={{ color: '#d4d4d8' }} />
                                <h3 className={styles.memberEmptyTitle}>Nenhum membro encontrado</h3>
                                <p className={styles.memberEmptyText}>Ajuste os filtros ou convide novos contribuidores.</p>
                            </div>
                        )}

                        {filteredMembers.map((member: any) => {
                            const isExpanded = expandedUsers[member.userId] ?? true;
                            const userDocs = clientDocs.filter(d => d.ownerUserId === member.userId);
                            const userApproved = userDocs.filter(d => d.status === 'approved').length;
                            const completePercent = requiredDocs.length > 0 ? (userApproved / requiredDocs.length) * 100 : 100;

                            return (
                                <div key={member.userId} className={`${styles.memberCard} ${isExpanded ? styles.expanded : ''}`}>
                                    <div className={styles.memberHeader} onClick={() => toggleUserExpand(member.userId)}>
                                        <div className={styles.memberIdentity}>
                                            <div className={styles.memberAvatar}>
                                                {member.user.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className={styles.memberName}>
                                                    {member.user.name}
                                                    {/* @ts-ignore */}
                                                    {member.permissions?.includes('PROJECT_EDIT') && <Shield size={14} style={{ color: '#f59e0b' }} title="Admin" />}
                                                </h3>
                                                <p className={styles.memberEmail}>{member.user.email}</p>
                                            </div>
                                        </div>

                                        <div className={styles.memberProgress}>
                                            <div className={styles.progressTop}>
                                                <span className={styles.progressLabel}>Progresso</span>
                                                <span className={styles.progressStat}>
                                                    {userApproved} / {requiredDocs.length} <span className={styles.progressStatMuted}>Concluídos</span>
                                                </span>
                                            </div>
                                            <div className={styles.progressTrack}>
                                                <div
                                                    className={`${styles.progressFill} ${completePercent === 100 ? styles.complete : ''}`}
                                                    style={{ width: `${completePercent}%` }}
                                                />
                                            </div>
                                        </div>

                                        <button className={styles.memberToggleBtn}>
                                            <span>{isExpanded ? 'Ocultar' : 'Detalhes'}</span>
                                            <ChevronDown size={18} className={`${styles.chevronIcon} ${isExpanded ? styles.rotated : ''}`} />
                                        </button>
                                    </div>

                                    {isExpanded && (

                                        <div className={styles.docSection}>
                                            {requiredDocs.length === 0 ? (
                                                <p className={styles.docEmpty}>Nenhum documento obrigatório configurado para este projeto.</p>
                                            ) : (
                                                <div className={styles.docList}>
                                                    {requiredDocs.map(rd => {
                                                        const doc = userDocs.find(cd => cd.documentTypeId === rd.documentTypeId);
                                                        const statusStyle = getStatusStyle(doc?.status || 'missing');
                                                        const isUploading = uploadingDocType === `${rd.documentTypeId}-${member.userId}`;
                                                        const progress = uploadProgress[`${rd.documentTypeId}-${member.userId}`];

                                                        return (
                                                            <div key={rd.id} className={styles.docRow}>
                                                                <div className={styles.docLeft}>
                                                                    <div className={`${styles.docTypeIcon} ${doc ? styles.filled : styles.empty}`}>
                                                                        {doc ? <FileIcon size={18} /> : <AlertTriangle size={18} />}
                                                                    </div>
                                                                    <div>
                                                                        <h4 className={styles.docName}>{rd.documentType.name}</h4>
                                                                        <p className={styles.docDescription}>{rd.documentType.description || 'OBRIGATÓRIO'}</p>
                                                                        {doc?.status === 'rejected' && doc.rejectionReason && (
                                                                            <p className={styles.docRejectionReason}>Motivo: {doc.rejectionReason}</p>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className={styles.docRight}>
                                                                    <span className={styles.docStatusBadge} style={statusStyle.style}>
                                                                        {statusStyle.label}
                                                                    </span>

                                                                    <div className={styles.docActions}>
                                                                        {doc && (
                                                                            <>
                                                                                <button onClick={() => handleViewFile(doc.file.url)} className={styles.docActionBtn}>
                                                                                    <Eye size={14} /> Ver
                                                                                </button>
                                                                                <button onClick={() => handleDownloadFile(doc)} className={styles.docActionBtn}>
                                                                                    <Download size={14} /> Baixar
                                                                                </button>

                                                                                {isAdmin && doc.status === 'pending' && (
                                                                                    <>
                                                                                        <span className={styles.docActionSep}>|</span>
                                                                                        <button onClick={() => updateDocStatus(doc.id, 'approved')} className={styles.docApproveBtn}>
                                                                                            Aprovar
                                                                                        </button>
                                                                                        <button onClick={() => {
                                                                                            const reason = prompt('Motivo da rejeição:');
                                                                                            if (reason !== null) updateDocStatus(doc.id, 'rejected', reason);
                                                                                        }} className={styles.docRejectBtn}>
                                                                                            Rejeitar
                                                                                        </button>
                                                                                    </>
                                                                                )}
                                                                            </>
                                                                        )}

                                                                        {(!doc || doc.status === 'rejected') && (!isAdmin || (isAdmin && !doc)) && (
                                                                            <>
                                                                                {doc && <span className={styles.docActionSep}>|</span>}
                                                                                {project?.status !== 'ARCHIVED' && (
                                                                                    <DropzoneUploader
                                                                                        onUpload={(files) => handleUploadSpecificDocument(files, rd.documentTypeId, member.userId)}
                                                                                        isUploading={isUploading}
                                                                                        progress={progress}
                                                                                        label={doc ? 'Re-enviar' : 'Upload'}
                                                                                        moduleStyles={styles}
                                                                                    />
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* FAB */}
                {isAdmin && (
                    <div className={styles.fab}>
                        <button onClick={generateInvite} className={styles.fabBtn}>
                            <Plus size={28} />
                            <span className={styles.fabTooltip}>Convidar Usuário</span>
                        </button>
                    </div>
                )}
            </main>

            {/* Mobile Bottom Nav */}
            <nav className={styles.mobileNav}>
                <button onClick={() => router.push('/dashboard')} className={styles.mobileNavBtn}>
                    <LayoutGrid size={18} />
                    <span className={styles.mobileNavLabel}>Dash</span>
                </button>
                <button className={styles.mobileNavBtn}>
                    <FolderOpen size={18} />
                    <span className={styles.mobileNavLabel}>Arq</span>
                </button>

                {isAdmin && (
                    <button onClick={generateInvite} className={styles.mobileNavFab}>
                        <Plus size={20} />
                    </button>
                )}

                <button className={styles.mobileNavBtn}>
                    <Users size={18} />
                    <span className={styles.mobileNavLabel}>Equipe</span>
                </button>
                <button className={`${styles.mobileNavBtn} ${styles.active}`}>
                    <UserIcon size={18} />
                    <span className={styles.mobileNavLabel}>Eu</span>
                </button>
            </nav>
        </div>
    );
}

// DropzoneUploader now receives moduleStyles as prop
function DropzoneUploader({
    onUpload, isUploading, label = 'Upload', progress, moduleStyles
}: {
    onUpload: (files: File[]) => void;
    isUploading: boolean;
    label?: string;
    progress?: number;
    moduleStyles: any;
}) {
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: onUpload,
        maxFiles: 1,
        disabled: isUploading,
        noClick: true,
    });

    return (
        <div
            {...getRootProps()}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isUploading) open(); }}
            className={`${moduleStyles.uploadBtn} ${isUploading ? moduleStyles.disabled : ''} ${isDragActive ? moduleStyles.dragActive : ''}`}
        >
            {isUploading && progress !== undefined && (
                <div className={moduleStyles.uploadBtnProgress} style={{ width: `${progress}%` }} />
            )}
            <input {...getInputProps()} />
            <div className={moduleStyles.uploadBtnContent}>
                {isUploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                {isUploading ? `Enviando ${progress ? progress + '%' : ''}` : label}
            </div>
        </div>
    );
}
