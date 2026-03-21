'use client';

import api from '@/lib/api';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    Bell, Settings, LayoutGrid, FolderOpen, Users, Star, Trash2, Plus,
    HelpCircle, User as UserIcon, ChevronRight, Share, Edit,
    FileText, Search as SearchIcon, ChevronDown,
    Badge as BadgeIcon, Receipt, File as FileIcon, Eye,
    UploadCloud, Loader2, ArrowLeft, Shield, AlertTriangle, CheckCircle, XCircle,
    Download
} from 'lucide-react';
import { Nav } from '@/components/Nav';

export default function ProjectPage() {
    const { id } = useParams();
    const router = useRouter();

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
    const [inviteLink, setInviteLink] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState('');

    const { data: session, status } = useSession();

    useEffect(() => {
        if (status === 'loading') return;
        const localToken = localStorage.getItem('token');
        const activeToken = session?.user?.token || localToken;
        if (!activeToken) {
            router.push('/');
            return;
        }
        if (status === 'authenticated' || (status === 'unauthenticated' && localToken)) {
            fetchData(activeToken as string);
        }
    }, [id, status]);

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
            toast.error('Falha ao carregar projeto');
            router.push('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const hasPermission = (permission: string) => currentUserPermissions.includes(permission);
    const isAdmin = currentUserPermissions.includes('PROJECT_EDIT');

    const toggleUserExpand = (userId: string) => {
        setExpandedUsers(prev => ({ ...prev, [userId]: !prev[userId] }));
    };

    const generateInvite = async () => {
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await api.post(`/api/projects/${id}/invites`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const link = `${window.location.origin}/?invite=${res.data.invite.token}`;
            setInviteLink(link);
            navigator.clipboard.writeText(link);
            toast.success('Link de convite copiado!');
        } catch (error) {
            toast.error('Falha ao gerar convite');
        }
    };


    const handleRename = async () => {
        if (!newName.trim() || newName === project?.name) {
            setIsEditingName(false);
            return;
        }
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await api.patch(`/api/projects/${id}`, { name: newName }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Projeto renomeado com sucesso!');
            setProject((prev: any) => ({ ...prev, name: res.data.name || newName }));
            setIsEditingName(false);
        } catch (error) {
            console.log(error);
            toast.error('Falha ao renomear projeto');
        }
    };

    const handleUploadSpecificDocument = async (acceptedFiles: File[], docTypeId: string, targetUserId?: string) => {
        if (!hasPermission('DOCUMENT_UPLOAD') && !isAdmin) {
            toast.error('Você não tem permissão para enviar documentos');
            return;
        }
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
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || file.size));
                    setUploadProgress(prev => ({ ...prev, [uploadKey]: percentCompleted }));
                    if (percentCompleted === 100) {
                        toast.loading(`Analisando a qualidade de ${file.name}...`, { id: toastId });
                    }
                }
            });

            const dbFile = uploadRes.data.file;

            const clientDocRes = await api.post(`/api/projects/${id}/client-documents`, {
                documentTypeId: docTypeId,
                ownerUserId: ownerId,
                fileId: dbFile.id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

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
            const response = await api.get(`/api/files/base64`, {
                params: { url },
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.dismiss('loading-file');
            const { base64, mimeType } = response.data;
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
            window.open(URL.createObjectURL(blob), '_blank');
        } catch (error) {
            toast.dismiss('loading-file');
            toast.error('Falha ao abrir arquivo');
        }
    };

    const updateDocStatus = async (docId: string, statusText: string, reason?: string) => {
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await api.patch(`/api/documents/${docId}/status`, {
                status: statusText,
                rejectionReason: reason,
                projectId: id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setClientDocs(prev => prev.map(d => d.id === docId ? res.data : d));
            toast.success('Status atualizado');
        } catch (error) {
            toast.error('Falha ao atualizar');
        }
    };

    const getStatusStyle = (statusCode: string) => {
        switch (statusCode) {
            case 'approved': return { bg: 'bg-emerald-100 text-emerald-800', label: 'Aprovado' };
            case 'rejected': return { bg: 'bg-red-100 text-red-800', label: 'Rejeitado' };
            case 'pending': return { bg: 'bg-amber-100 text-amber-800', label: 'Em Análise' };
            default: return { bg: 'bg-zinc-100 text-zinc-800', label: 'Pendente' };
        }
    };

    const handleDownloadFile = async (doc: any) => {
        try {
            console.log(doc);
            console.log(project?.name);
            const   email = doc.ownerUser.email.trim('@', '_').replace('.', '_');
            const filename = `${project?.name}_${doc.documentType.name}_${email}`;
            const token = session?.user?.token || localStorage.getItem('token');
            const response = await api.get(`/api/files/base64`, {
                params: { url: doc.file.url },
                headers: { Authorization: `Bearer ${token}` }
            });
            const { base64, mimeType } = response.data;
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
            const urlObject = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = urlObject;
            link.download = filename;
            console.log(filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(urlObject);
        } catch (error) {
            console.error('Error downloading file:', error);
            toast.error('Falha ao baixar arquivo');
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-surface flex items-center justify-center"><Loader2 size={32} className="animate-spin text-amber-500" /></div>;
    }

    // Calculos das Metricas
    const nonAdminMembers = members.filter(m => !m.permissions?.includes('PROJECT_EDIT'));
    const totalUsers = members.length;
    const totalDocsSent = clientDocs.length;
    const totalRequiredPerUser = requiredDocs.length;

    // docs pendentes (aqueles q estao em pending state)
    const pendingDocs = clientDocs.filter(d => d.status === 'pending').length;

    // completion rate: baseando docs aprovados vs total exigido para nao-admins
    const targetDocs = nonAdminMembers.length * totalRequiredPerUser;
    const approvedDocs = clientDocs.filter(d => d.status === 'approved' && nonAdminMembers.some(m => m.userId === d.ownerUserId)).length;
    const completionRate = targetDocs > 0 ? Math.round((approvedDocs / targetDocs) * 100) : 100;

    // time ago (utilizando API nativa)
    const timeAgo = project?.updatedAt ? new Date(project.updatedAt).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Recentemente';

    // Para o usuário logado que não é admin, filtramos apenas para ver a própria conta (simulando a visáo do "Alex Rivera")
    const membersToDisplay = isAdmin ? members.filter(m => !m.permissions?.includes('PROJECT_EDIT')) : members.filter(m => m.userId === currentUser?.userId);
    const filteredMembers = membersToDisplay.filter(m => m.user.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.user.email.toLowerCase().includes(searchQuery.toLowerCase()));


    
    const userName = session?.user?.name || 'User';
    const userInitials = userName.substring(0, 2).toUpperCase();
    return (
        <div className="bg-background font-body text-on-surface antialiased overflow-hidden flex h-screen w-full relative">
            
            {/* Main Content Canvas */}
            <main className="flex-1 h-screen flex flex-col items-center bg-surface overflow-y-auto relative w-full custom-scrollbar">
                
                {/* Top Navigation Bar */}
                <Nav
                    context="project"
                    projectName={project?.name}
                    userInitials={userInitials}
                    onLogout={async () => {
                        localStorage.removeItem('token');
                        if (session) {
                            const { signOut } = await import('next-auth/react');
                            await signOut({ redirect: false });
                        }
                        router.push('/');
                    }}
                />

                <div className="w-full max-w-7xl mx-auto px-6 py-6 md:px-8 space-y-8 md:space-y-12 pb-24">
                    {/* Header Section RESTORED */}
                    <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <nav className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-zinc-500 mb-2">
                                <span className="cursor-pointer hover:text-zinc-900" onClick={() => router.push('/dashboard')}>Projetos</span>
                                <ChevronRight size={12} />
                                <span className="text-amber-500">Detalhes</span>
                            </nav>
                            <div className="flex items-center gap-3">
                                {isEditingName ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                            disabled={loading}
                                            autoFocus
                                            className="font-headline text-2xl md:text-3xl font-black tracking-tight text-zinc-900 bg-white border border-amber-400 rounded-lg px-3 py-1 outline-none w-full max-w-[300px] shadow-sm"
                                        />
                                        <button onClick={handleRename} className="text-emerald-500 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors" title="Salvar">
                                            <CheckCircle size={22} />
                                        </button>
                                        <button onClick={() => setIsEditingName(false)} className="text-zinc-400 hover:bg-zinc-100 p-1.5 rounded-lg transition-colors" title="Cancelar">
                                            <XCircle size={22} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <h1 className="font-headline text-3xl md:text-4xl font-black tracking-tighter text-zinc-900">{project?.name || 'Detalhes do Projeto'}</h1>
                                        {isAdmin && (
                                            <button 
                                                onClick={() => {
                                                    setNewName(project?.name || '');
                                                    setIsEditingName(true);
                                                }}
                                                className="text-zinc-400 hover:text-amber-500 transition-colors p-1"
                                                title="Renomear Projeto"
                                            >
                                                <Edit size={20} />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 mt-3">
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-tertiary-container text-on-tertiary-container text-xs font-bold rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                                    {project?.status || 'Em andamento'}
                                </span>
                                <span className="text-xs text-zinc-500 font-medium italic">Atualizado: {timeAgo}</span>
                            </div>
                        </div>
                        {isAdmin && (
                            <div className="flex flex-wrap items-center gap-4">
                                <button onClick={generateInvite} className="px-4 py-2 bg-zinc-200 text-zinc-900 hover:bg-zinc-300 transition-colors rounded-lg font-semibold text-sm flex items-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                                    <Share size={16} /> Convite
                                </button>
                              {/*   <button className="px-6 py-2 bg-primary-container text-on-primary-fixed font-headline font-bold rounded-lg flex items-center gap-2 hover:bg-primary transition-colors shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                                    <Edit size={16} /> Modificar
                                </button>    */}
                            </div>
                        )}
                    </header>

                    {/* Summary Metrics: Bento Grid (Admin only context or personal metrics) */}
                    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                        <div className="bg-white border border-zinc-100 p-6 rounded-xl flex flex-col justify-between group hover:border-amber-400 transition-colors shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                            <Users className="text-amber-500 mb-4" size={24} />
                            <div>
                                <p className="text-4xl font-headline font-black text-zinc-900 tracking-tighter">{totalUsers}</p>
                                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 group-hover:text-amber-600 transition-colors">Contribuidores</p>
                            </div>
                        </div>
                        <div className="bg-white border border-zinc-100 p-6 rounded-xl flex flex-col justify-between group hover:border-amber-400 transition-colors shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                            <FileText className="text-amber-500 mb-4" size={24} />
                            <div>
                                <p className="text-4xl font-headline font-black text-zinc-900 tracking-tighter">{totalDocsSent}</p>
                                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 group-hover:text-amber-600 transition-colors">Documentos Enviados</p>
                            </div>
                        </div>
                        <div className="bg-white border border-zinc-100 p-6 rounded-xl flex flex-col justify-between group hover:border-red-400 transition-colors shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle className="text-red-500" size={24} />
                            </div>
                            <div>
                                <p className="text-4xl font-headline font-black text-zinc-900 tracking-tighter">{pendingDocs}</p>
                                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 group-hover:text-red-500 transition-colors">Revisões Pendentes</p>
                            </div>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex items-center justify-between overflow-hidden relative shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                            <div className="z-10">
                                <p className="text-4xl font-headline font-black text-amber-400 tracking-tighter">{completionRate}%</p>
                                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mt-1">Progresso Geral</p>
                            </div>
                            {/* Progress Ring representation */}
                            <div className="relative flex items-center justify-center transform scale-[1.3] translate-x-6 opacity-80">
                                <svg className="w-24 h-24 -rotate-90">
                                    <circle cx="48" cy="48" fill="transparent" r="38" stroke="rgba(255,255,255,0.1)" strokeWidth="8"></circle>
                                    <circle cx="48" cy="48" fill="transparent" r="38" stroke="#fbbf24" strokeDasharray="239" strokeDashoffset={239 - (239 * completionRate) / 100} strokeLinecap="round" strokeWidth="8" className="transition-all duration-1000 ease-out"></circle>
                                </svg>
                            </div>
                        </div>
                    </section>

                    {/* Main Content: Contributor List / Checklist */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h2 className="font-headline text-3xl font-black tracking-tighter text-zinc-900">
                            {isAdmin ? 'Checklist da Equipe' : 'Meus Documentos'}
                        </h2>
                        {isAdmin && (
                            <div className="flex items-center gap-2 bg-white border border-zinc-100 px-4 py-2 rounded-lg focus-within:ring-2 focus-within:ring-amber-400 focus-within:border-transparent transition-all shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                                <SearchIcon className="text-zinc-400" size={16} />
                                <input
                                    className="bg-transparent border-none focus:ring-0 text-sm font-medium w-full sm:w-48 outline-none text-zinc-900"
                                    placeholder="Buscar usuários..."
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        {filteredMembers.length === 0 && (
                            <div className="text-center py-12 bg-white rounded-xl border border-zinc-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
                                <Users size={40} className="mx-auto text-zinc-300 mb-3" />
                                <h3 className="text-lg font-bold text-zinc-900 font-headline">Nenhum membro encontrado</h3>
                                <p className="text-sm text-zinc-500">Ajuste os filtros ou convide novos contribuidores.</p>
                            </div>
                        )}

                        {filteredMembers.map((member: any) => {
                            const isExpanded = expandedUsers[member.userId] ?? true;
                            const userDocs = clientDocs.filter(d => d.ownerUserId === member.userId);
                            const userApproved = userDocs.filter(d => d.status === 'approved').length;
                            const completePercent = requiredDocs.length > 0 ? (userApproved / requiredDocs.length) * 100 : 100;

                            return (
                                <div key={member.userId} className={`bg-white rounded-xl overflow-hidden border transition-all duration-200 ${isExpanded ? 'border-zinc-200 shadow-[0_10px_40px_rgba(0,0,0,0.05)]' : 'border-zinc-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'}`}>
                                    {/* User Header */}
                                    <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer hover:bg-zinc-50 transition-colors" onClick={() => toggleUserExpand(member.userId)}>
                                        <div className="flex items-center gap-4">
                                            <div className="min-w-12 h-12 w-12 rounded-lg bg-amber-50 flex items-center justify-center font-headline font-black text-xl text-amber-600 border border-amber-100">
                                                {member.user.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="font-headline text-lg md:text-xl font-black tracking-tight text-zinc-900 flex items-center gap-2">
                                                    {member.user.name}
                                                    {/* @ts-ignore */}
                                                    {member.permissions?.includes('PROJECT_EDIT') && <Shield size={14} className="text-amber-500" title="Admin" />}
                                                </h3>
                                                <p className="text-xs md:text-sm text-zinc-500 font-medium">{member.user.email}</p>
                                            </div>
                                        </div>

                                        <div className="flex-1 w-full max-w-md ml-0 md:ml-auto">
                                            <div className="flex justify-between items-end mb-2">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Progresso</span>
                                                <span className="text-sm font-headline font-bold text-zinc-900">
                                                    {userApproved} / {requiredDocs.length} <span className="text-zinc-500 font-normal">Concluídos</span>
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ${completePercent === 100 ? 'bg-tertiary' : 'bg-primary-fixed-dim'}`}
                                                    style={{ width: `${completePercent}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <button className="flex items-center gap-2 text-zinc-400 font-headline font-bold hover:text-amber-500 self-start md:self-auto mt-2 md:mt-0 transition-colors">
                                            <span className="text-sm">{isExpanded ? 'Ocultar' : 'Detalhes'}</span>
                                            <ChevronDown size={18} className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>

                                    {/* Document Rows (Expandable) */}
                                    {isExpanded && (
                                        <div className="bg-zinc-50/50 px-6 md:px-8 pb-6 pt-2 border-t border-zinc-100">
                                            {requiredDocs.length === 0 ? (
                                                <p className="py-4 text-zinc-500 text-sm italic">Nenhum documento obrigatório configurado para este projeto.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {requiredDocs.map(rd => {
                                                        const doc = userDocs.find(cd => cd.documentTypeId === rd.documentTypeId);
                                                        const statusStyle = getStatusStyle(doc?.status || 'missing');
                                                        const isUploading = uploadingDocType === `${rd.documentTypeId}-${member.userId}`;
                                                        const progress = uploadProgress[`${rd.documentTypeId}-${member.userId}`];

                                                        return (
                                                            <div key={rd.id} className="py-4 border-b border-zinc-200/60 last:border-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                                <div className="flex items-start md:items-center gap-4 w-full md:w-auto">
                                                                    <div className={`mt-1 md:mt-0 min-w-10 h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${doc ? 'bg-zinc-200 text-zinc-600' : 'bg-zinc-100 border border-dashed border-zinc-300 text-zinc-400'}`}>
                                                                        {doc ? <FileIcon size={18} /> : <AlertTriangle size={18} />}
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-sm font-headline font-bold text-zinc-900 leading-tight">{rd.documentType.name}</h4>
                                                                        <p className="text-[10px] mt-1 font-bold uppercase tracking-widest text-zinc-400 line-clamp-1">{rd.documentType.description || 'OBRIGATÓRIO'}</p>
                                                                        {doc?.status === 'rejected' && doc.rejectionReason && (
                                                                            <p className="text-xs text-red-500 mt-1 font-medium bg-red-50 inline-block px-2 py-0.5 rounded">Motivo: {doc.rejectionReason}</p>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-wrap items-center gap-3 md:gap-6 ml-14 md:ml-0">
                                                                    <span className={`px-3 py-1 ${statusStyle.bg} text-[10px] font-bold uppercase tracking-wider rounded-full`}>
                                                                        {statusStyle.label}
                                                                    </span>

                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        {doc && (
                                                                            <>
                                                                                <button onClick={() => handleViewFile(doc.file.url)} className="text-xs font-headline font-bold text-zinc-600 hover:text-amber-600 hover:underline flex items-center gap-1 transition-colors">
                                                                                    <Eye size={14} /> Ver
                                                                                </button>
                                                                                <button onClick={() => handleDownloadFile(doc)} className="text-xs font-headline font-bold text-zinc-600 hover:text-amber-600 hover:underline flex items-center gap-1 transition-colors">
                                                                                    <Download size={14} /> Baixar
                                                                                </button>

                                                                                {isAdmin && doc.status === 'pending' && (
                                                                                    <>
                                                                                        <span className="text-zinc-200 hidden sm:inline">|</span>
                                                                                        <button onClick={() => updateDocStatus(doc.id, 'approved')} className="text-xs font-bold text-tertiary-container hover:text-green-700 flex items-center gap-1 bg-green-50 px-2 py-1 rounded transition-colors">
                                                                                            Aprovar
                                                                                        </button>
                                                                                        <button onClick={() => {
                                                                                            const reason = prompt('Motivo da rejeição:');
                                                                                            if (reason !== null) updateDocStatus(doc.id, 'rejected', reason);
                                                                                        }} className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-50 px-2 py-1 rounded transition-colors">
                                                                                            Rejeitar
                                                                                        </button>
                                                                                    </>
                                                                                )}
                                                                            </>
                                                                        )}

                                                                        {(!doc || doc.status === 'rejected') && (!isAdmin || isAdmin && !doc) && (
                                                                            <>
                                                                                {doc && <span className="text-zinc-200 hidden sm:inline">|</span>}
                                                                                <DropzoneUploader
                                                                                    onUpload={(files) => handleUploadSpecificDocument(files, rd.documentTypeId, member.userId)}
                                                                                    isUploading={isUploading}
                                                                                    progress={progress}
                                                                                    label={doc ? "Re-enviar" : "Upload"}
                                                                                />
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

                {isAdmin && (
                    <div className="fixed bottom-6 right-6 lg:bottom-10 lg:right-10 z-50">
                        <button onClick={generateInvite} className="w-14 h-14 bg-amber-400 hover:bg-amber-500 text-amber-950 rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95 group relative">
                            <Plus className="text-3xl" size={28} />
                            <span className="absolute right-full mr-4 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md pointer-events-none">
                                Convidar Usuário
                            </span>
                        </button>
                    </div>
                )}
            </main>

            {/* Bottom Nav for Mobile */}
            <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-zinc-100 h-16 flex items-center justify-around z-50 px-2 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] pb-safe-area">
                <button onClick={() => router.push('/dashboard')} className="flex flex-col items-center gap-1 text-zinc-400 hover:text-amber-500 transition-colors p-2">
                    <LayoutGrid size={18} className="md:size-5" />
                    <span className="text-[9px] font-bold uppercase tracking-tighter">Dash</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-zinc-400 hover:text-amber-500 transition-colors p-2">
                    <FolderOpen size={18} className="md:size-5" />
                    <span className="text-[9px] font-bold uppercase tracking-tighter">Arq</span>
                </button>

                {isAdmin && (
                    <button onClick={generateInvite} className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center -translate-y-4 shadow-lg text-amber-950 active:scale-95 transition-transform border-4 border-white">
                        <Plus size={20} />
                    </button>
                )}

                <button className="flex flex-col items-center gap-1 text-zinc-400 hover:text-amber-500 transition-colors p-2">
                    <Users size={18} className="md:size-5" />
                    <span className="text-[9px] font-bold uppercase tracking-tighter">Equipe</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-amber-500 p-2">
                    <UserIcon size={18} className="md:size-5" />
                    <span className="text-[9px] font-bold uppercase tracking-tighter">Eu</span>
                </button>
            </nav>
        </div>
    );
}

function DropzoneUploader({ onUpload, isUploading, label = 'Upload', progress }: { onUpload: (files: File[]) => void, isUploading: boolean, label?: string, progress?: number }) {
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: onUpload,
        maxFiles: 1,
        disabled: isUploading,
        noClick: true,
    });

    return (
        <div
            {...getRootProps()}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isUploading) open();
            }}
            className={`
                relative overflow-hidden shrink-0 flex items-center gap-1.5 px-3 py-1.5 
                text-xs font-bold uppercase tracking-widest rounded transition-colors
                ${isUploading ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' : 'bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer'}
                ${isDragActive ? 'ring-2 ring-amber-400 outline-none' : ''}
            `}
        >
            {isUploading && progress !== undefined && (
                <div
                    className="absolute left-0 top-0 bottom-0 bg-amber-400/20 transition-all duration-300"
                    style={{ width: `${progress}%`, zIndex: 0 }}
                />
            )}
            <input {...getInputProps()} />
            <div className="relative z-10 flex items-center gap-1.5 whitespace-nowrap text-[10px] md:text-xs">
                {isUploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                {isUploading ? `Enviando ${progress ? progress + '%' : ''}` : label}
            </div>
        </div>
    );
}
