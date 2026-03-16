'use client';
import axios from 'axios';
import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import { UploadCloud, File as FileIcon, CheckCircle, AlertTriangle, XCircle, Users, Link as LinkIcon, ArrowLeft, Trash2, Shield, Loader2, FileText, Check, X, Eye } from 'lucide-react';
import { useSession } from 'next-auth/react';

export default function ProjectPage() {
    const { id } = useParams();
    const router = useRouter();

    const [project, setProject] = useState<any>(null);
    const [files, setFiles] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [currentUserPermissions, setCurrentUserPermissions] = useState<string[]>([]);

    const hasPermission = (permission: string) => currentUserPermissions.includes(permission);

    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const [showManageModal, setShowManageModal] = useState(false);
    const [inviteLink, setInviteLink] = useState('');

    const [requiredDocs, setRequiredDocs] = useState<any[]>([]);
    const [clientDocs, setClientDocs] = useState<any[]>([]);
    const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
    const [currentUser, setCurrentUser] = useState<any>(null);

    const { data: session, status } = useSession();

    useEffect(() => {
        if (status === 'loading') return;
        
        const localToken = localStorage.getItem('token');
        const activeToken = session?.user?.token || localToken;
        
        if (!activeToken) {
            router.push('/');
            return;
        }

        // Avoid fetching if we already have the basic project data and it's the right project
        // but since we need real-time data for documents, we usually fetch on mount or id change.
        // We add a check for status stable.
        if (status === 'authenticated' || (status === 'unauthenticated' && localToken)) {
            fetchData(activeToken as string);
        }
    }, [id, status]); // Removed session from dependencies to avoid extra triggers if it changes but token is same

    const fetchData = async (token: string) => {
        try {
            setLoading(true);
            const headers = { Authorization: `Bearer ${token}` };

            const response = await axios.get(`http://localhost:3001/api/projects/${id}/details`, { headers });
            const { project, files, members, requiredDocuments, clientDocuments, currentUserPermissions } = response.data;

            setProject(project);
            setFiles(files);
            setMembers(members);
            setRequiredDocs(requiredDocuments);
            setClientDocs(clientDocuments);
            setCurrentUserPermissions(currentUserPermissions);

            // Decode token to get current user ID (for legacy uses if any)
            try {
                const payload = JSON.parse(atob((token || '').split('.')[1]));
                setCurrentUser(payload);
            } catch (e) {}

        } catch (error) {
            toast.error('Falha ao carregar projeto');
            router.push('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const generateInvite = async () => {
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await axios.post(`http://localhost:3001/api/projects/${id}/invites`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const link = `${window.location.origin}/?invite=${res.data.invite.token}`;
            setInviteLink(link);
        } catch (error) {
            toast.error('Falha ao gerar convite');
        }
    };

    const copyInvite = () => {
        navigator.clipboard.writeText(inviteLink);
        toast.success('Copiado para a área de transferência!');
    };

    const removeMember = async (userId: string) => {
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            await axios.delete(`http://localhost:3001/api/projects/${id}/members/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Membro removido');
            setMembers(prev => prev.filter(m => m.userId !== userId));
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Falha ao remover membro');
        }
    };

    const promoteToAdmin = async (userId: string) => {
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await axios.patch(`http://localhost:3001/api/projects/${id}/members/${userId}`, { role: 'ADMIN' }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Membro promovido a ADMIN');
            // Update the member in the list with new permissions from response
            setMembers(prev => prev.map(m => m.userId === userId ? { ...m, permissions: res.data.member.permissions } : m));
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Falha ao promover membro');
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
            console.log("file");
            const formData = new FormData();
            formData.append('file', file);
            formData.append('projectId', id as string);

            const uploadRes = await axios.post('http://localhost:3001/api/files/upload', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || file.size));
                    setUploadProgress(prev => ({ ...prev, [uploadKey]: percentCompleted }));
                    if (percentCompleted === 100) {
                        toast.loading(`Analisando a qualidade de ${file.name}... Isso pode levar alguns segundos.`, { id: toastId });
                    } else {
                        toast.loading(`Enviando ${file.name}... ${percentCompleted}%`, { id: toastId });
                    }
                }
            });

            const dbFile = uploadRes.data.file;

            const clientDocRes = await axios.post(`http://localhost:3001/api/projects/${id}/client-documents`, {
                documentTypeId: docTypeId,
                ownerUserId: ownerId,
                fileId: dbFile.id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setClientDocs(prev => [clientDocRes.data, ...prev]);
            toast.success('Documento analisado e enviado com sucesso!', { id: toastId });
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Falha ao enviar documento', { id: toastId });
        } finally {
            setUploadingDocType(null);
            setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));
        }
    };

    const updateDocStatus = async (docId: string, statusText: string, reason?: string) => {
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await axios.patch(`http://localhost:3001/api/documents/${docId}/status`, {
                status: statusText,
                rejectionReason: reason,
                projectId: id // Adicionado projectId necessário pelo checkRole middleware
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setClientDocs(prev => prev.map(d => d.id === docId ? res.data : d));
            toast.success('Status atualizado');
        } catch (error) {
            toast.error('Falha ao atualizar status');
        }
    };

    const getDocStatusBadge = (statusCode: string) => {
        switch (statusCode) {
            case 'approved': return <span style={{ background: 'var(--success)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Aprovado</span>;
            case 'rejected': return <span style={{ background: 'var(--danger)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Rejeitado</span>;
            case 'pending': return <span style={{ background: 'var(--warning)', color: 'black', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Pendente</span>;
            default: return null;
        }
    };

    const isAdmin = currentUserPermissions.includes('PROJECT_EDIT');

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!hasPermission('DOCUMENT_UPLOAD')) {
            toast.error('Você não tem permissão para enviar arquivos soltos');
            return;
        }
        if (acceptedFiles.length === 0) return;
        setUploading(true);
        const token = session?.user?.token || localStorage.getItem('token');

        for (const file of acceptedFiles) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('projectId', id as string);

            try {
                const res = await axios.post('http://localhost:3001/api/files/upload', formData, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                toast.success(`Enviado: ${file.name}`);
                setFiles(prev => [res.data.file, ...prev]);
            } catch (error: any) {
                toast.error(`Falha ao enviar ${file.name}`);
            }
        }
        setUploading(false);
    }, [id, currentUserPermissions]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/jpeg': ['.jpeg', '.jpg'],
            'image/png': ['.png'],
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        },
        disabled: !hasPermission('DOCUMENT_UPLOAD')
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'APPROVED': return <CheckCircle color="var(--success)" size={20} />;
            case 'CONDITIONAL': return <AlertTriangle color="var(--warning)" size={20} />;
            case 'REJECTED': return <XCircle color="var(--danger)" size={20} />;
            default: return null;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'var(--success)';
            case 'CONDITIONAL': return 'var(--warning)';
            case 'REJECTED': return 'var(--danger)';
            default: return 'var(--text-secondary)';
        }
    }

    const handleViewFile = async (url: string) => {
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

            toast.loading('Carregando arquivo...', { id: 'loading-file' });

            const response = await axios.get(`${backendUrl}/api/files/base64`, {
                params: { url },
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.dismiss('loading-file');

            const { base64, mimeType } = response.data;

            // Decode base64 and create a Blob
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            const blobUrl = URL.createObjectURL(blob);

            window.open(blobUrl, '_blank');
        } catch (error) {
            toast.dismiss('loading-file');
            toast.error('Falha ao visualizar o arquivo');
            console.error('Erro ao buscar arquivo:', error);
        }
    }


    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 size={32} className="animate-spin" color="var(--accent-light)" /></div>;
    }

    return (
        <div className="project-container" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <button onClick={() => router.push('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: '24px' }}>
                <ArrowLeft size={18} /> Voltar ao Painel
            </button>
            <header className="project-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>{project?.name || 'Projeto'}</h1>
                <div className="project-header-actions" style={{ display: 'flex', gap: '16px' }}>
                    <button
                        onClick={() => router.push(`/projects/${id}/documents`)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    >
                        <FileText size={18} /> Documentos
                    </button>
                    {hasPermission('MEMBER_MANAGE') && (
                        <button
                            onClick={() => setShowManageModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                        >
                            <Users size={18} /> Gerenciar Usuários
                        </button>
                    )}
                </div>
            </header>

            {/* CHECKLIST SECTION */}
            {requiredDocs.length > 0 && !isAdmin && (
                <div style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '20px' }}>Documentos Necessários</h2>
                    <div className="doc-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                        {requiredDocs.map(rd => {
                            // Find if this user has uploaded this doc
                            const userDoc = clientDocs.find(cd => cd.documentTypeId === rd.documentTypeId && (isAdmin ? false : cd.ownerUserId === currentUser?.userId));

                            // If admin is viewing, maybe show all docs? The prompt said:
                            // "A tela do projeto deve funcionar como um checklist de documentos obrigatórios, facilitando para o usuário saber exatamente o que falta enviar."
                            // For Admins, they can see everything in the "Documentos Recebidos" section further down, or under "Documentos" button.
                            // But here we are rendering the checklist. If it's the admin viewing the checklist, they probably shouldn't see an upload checklist meant for users, OR we only show it for users.
                            // Let's render the checklist primarily for the CURRENT USER'S obligations.

                            // Let's only render the checklist if NOT admin or if admin wants to upload their own docs (they are users too).
                            // The user request specified: "O sistema deve verificar se já existe um documento daquele tipo enviado pelo usuário logado"

                            const myDoc = clientDocs.find(cd => cd.documentTypeId === rd.documentTypeId && cd.ownerUserId === currentUser?.userId);

                            return (
                                <div key={rd.id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{rd.documentType.name}</h3>
                                        {rd.documentType.description && <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{rd.documentType.description}</p>}
                                    </div>

                                    {myDoc ? (
                                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Status:</span>
                                                {getDocStatusBadge(myDoc.status)}
                                            </div>
                                            <div className="doc-file-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Arquivo:</span>
                                                <button onClick={() => handleViewFile(myDoc.file.url)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-light)', textDecoration: 'underline', fontWeight: 600, fontSize: '0.95rem', padding: 0, textAlign: 'right', wordBreak: 'break-all' }}>
                                                    {myDoc.file.originalName}
                                                </button>
                                            </div>
                                            {myDoc.status === 'rejected' && myDoc.rejectionReason && (
                                                <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', borderLeft: '3px solid var(--danger)', marginTop: '8px' }}>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Recusado:</span> {myDoc.rejectionReason}
                                                </div>
                                            )}
                                            {/* Allow re-upload if rejected */}
                                            {myDoc.status === 'rejected' && (
                                                <div style={{ marginTop: '8px' }}>
                                                    <DropzoneUploader
                                                        onUpload={(files) => handleUploadSpecificDocument(files, rd.documentTypeId)}
                                                        isUploading={uploadingDocType === `${rd.documentTypeId}-${currentUser?.userId}`}
                                                        progress={uploadProgress[`${rd.documentTypeId}-${currentUser?.userId}`]}
                                                        label="Re-enviar"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px dashed rgba(239, 68, 68, 0.3)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Status:</span>
                                                <span style={{ fontWeight: 600, color: 'var(--danger)' }}>Não enviado</span>
                                            </div>
                                            <DropzoneUploader
                                                onUpload={(files) => handleUploadSpecificDocument(files, rd.documentTypeId)}
                                                isUploading={uploadingDocType === `${rd.documentTypeId}-${currentUser?.userId}`}
                                                progress={uploadProgress[`${rd.documentTypeId}-${currentUser?.userId}`]}
                                                label="Fazer Upload"
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {/* END CHECKLIST SECTION */}

            {/* ADMIN DOCUMENT REVIEW SECTION (Grouped by User) */}
            {isAdmin && (
                <div style={{ marginBottom: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Documentos dos Usuários</h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        {members.filter(m => !m.permissions?.includes('PROJECT_EDIT') || m.userId !== currentUser?.userId).map((member: any) => (
                            <div key={member.userId} className="glass-panel" style={{ padding: '24px' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Users size={20} color="var(--accent-light)" /> {member.user.name}
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 400 }}>({member.user.email})</span>
                                </h3>

                                {requiredDocs.length === 0 ? (
                                    <p style={{ color: 'var(--text-secondary)' }}>Nenhum documento exigido cadastrado.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {requiredDocs.map(rd => {
                                            const doc = clientDocs.find(cd => cd.documentTypeId === rd.documentTypeId && cd.ownerUserId === member.userId);

                                            return (
                                                <div key={rd.id} className="admin-doc-item" style={{
                                                    padding: '16px',
                                                    background: 'rgba(255,255,255,0.03)',
                                                    borderRadius: '8px',
                                                    borderLeft: `3px solid ${doc ? (doc.status === 'pending' ? 'var(--warning)' : doc.status === 'approved' ? 'var(--success)' : 'var(--danger)') : 'var(--card-border)'}`,
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    gap: '16px',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <div style={{ flex: '1', minWidth: '250px' }}>
                                                        <h4 style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '8px' }}>{rd.documentType.name}</h4>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Status:</span>
                                                            {doc ? getDocStatusBadge(doc.status) : <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Não enviado</span>}
                                                        </div>

                                                        {doc && (
                                                            <div style={{ marginBottom: '8px' }}>
                                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginRight: '6px' }}>Arquivo:</span>
                                                                <button onClick={() => handleViewFile(doc.file.url)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'underline', padding: 0 }}>
                                                                    {doc.file.originalName}
                                                                </button>
                                                            </div>
                                                        )}

                                                        {doc?.status === 'pending' && (
                                                            <div className="admin-doc-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                                                <button onClick={() => handleViewFile(doc.file.url)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'blue', color: 'white', padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                                                                    <Eye size={14} /> Visualizar
                                                                </button>
                                                                <button onClick={() => updateDocStatus(doc.id, 'approved')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--success)', color: 'white', padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                                                                    <Check size={14} /> Aprovar
                                                                </button>
                                                                <button onClick={() => {
                                                                    const reason = prompt('Motivo da rejeição:');
                                                                    if (reason !== null) updateDocStatus(doc.id, 'rejected', reason);
                                                                }} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--danger)', color: 'white', padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                                                                    <X size={14} /> Rejeitar
                                                                </button>
                                                            </div>
                                                        )}

                                                        {doc?.status === 'rejected' && doc.rejectionReason && (
                                                            <div style={{ marginTop: '8px', padding: '6px 10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px', color: 'var(--danger)', fontSize: '0.85rem' }}>
                                                                Motivo: {doc.rejectionReason}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="admin-doc-upload" style={{ minWidth: '180px' }}>
                                                        <DropzoneUploader
                                                            onUpload={(files) => handleUploadSpecificDocument(files, rd.documentTypeId, member.userId)}
                                                            isUploading={uploadingDocType === `${rd.documentTypeId}-${member.userId}`}
                                                            progress={uploadProgress[`${rd.documentTypeId}-${member.userId}`]}
                                                            label={doc ? "Substituir arquivo" : "Fazer Upload"}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}

                        {members.filter(m => !m.permissions?.includes('PROJECT_EDIT') || m.userId !== currentUser?.userId).length === 0 && (
                            <p style={{ color: 'var(--text-secondary)' }}>Não há outros usuários vinculados a este projeto.</p>
                        )}
                    </div>
                </div>
            )}
            {/* END ADMIN DOCUMENT REVIEW */}

            {/* {    <div
                {...getRootProps()}
                className="glass-panel"
                style={{
                    padding: '60px 40px',
                    textAlign: 'center',
                    border: `2px dashed ${isDragActive ? 'var(--accent-light)' : 'var(--card-border)'}`,
                    backgroundColor: isDragActive ? 'rgba(139, 92, 246, 0.1)' : 'var(--card-bg)',
                    cursor: hasPermission('DOCUMENT_UPLOAD') ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    marginBottom: '40px',
                    opacity: hasPermission('DOCUMENT_UPLOAD') ? 1 : 0.6
                }}
            >
                <input {...getInputProps()} />
                <UploadCloud size={48} color={isDragActive ? 'var(--accent-light)' : 'var(--text-secondary)'} style={{ margin: '0 auto 16px' }} />
                {!hasPermission('DOCUMENT_UPLOAD') ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Você não tem permissão para enviar arquivos para este projeto.</p>
                ) : uploading ? (
                    <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>Enviando...</p>
                ) : isDragActive ? (
                    <p style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--accent-light)' }}>Solte os arquivos aqui...</p>
                ) : (
                    <div>
                        <p style={{ fontSize: '1.2rem', fontWeight: 500, marginBottom: '8px' }}>Arraste & solte os arquivos aqui, ou clique para selecionar</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Suporta JPG, PNG, PDF, DOCX</p>
                    </div>
                )}
            </div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                {files.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Nenhum documento neste projeto ainda.</p>}
                {files.map((file: any) => {
                    const result = file.verificationResults?.[0];
                    return (
                        <div key={file.id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                                    <FileIcon size={24} color="var(--accent-light)" />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.originalName}>
                                        {file.originalName}
                                    </h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                                        {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {result && (
                                <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: `4px solid ${getStatusColor(result.status)}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: getStatusColor(result.status) }}>
                                            {getStatusIcon(result.status)}
                                            {result.status}
                                        </div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                                            {result.score}<span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/100</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        {result.recommendation && result.recommendation.split(' | ').map((rec: string, i: number) => (
                                            <p key={i} style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}><span style={{ color: 'var(--accent-light)' }}>•</span> {rec}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div> */}

            {/* Manage Users Modal */}
            {showManageModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="glass-panel2" style={{ width: '100%', maxWidth: '600px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Gerenciar Usuários</h2>
                            <button onClick={() => setShowManageModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><XCircle size={24} /></button>
                        </div>

                        <div style={{ marginBottom: '32px' }}>
                            <div className="modal-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3>Convidar novo usuário</h3>
                                <button onClick={generateInvite} style={{ background: 'var(--accent-light)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>Gerar Link</button>
                            </div>
                            {inviteLink && (
                                <div className="modal-invite-row" style={{ display: 'flex', gap: '8px' }}>
                                    <input type="text" readOnly value={inviteLink} style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)' }} />
                                    <button onClick={copyInvite} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><LinkIcon size={18} /></button>
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 style={{ marginBottom: '16px' }}>Membros ({members.length})</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {members.map((m: any) => {
                                    const isAdmin = m.permissions?.includes('PROJECT_EDIT');
                                    return (
                                        <div key={m.userId} className="member-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                            <div>
                                                <p style={{ fontWeight: 600 }}>{m.user.name}</p>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{m.user.email}</p>
                                            </div>
                                            <div className="member-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '12px', background: isAdmin ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.1)', color: isAdmin ? 'var(--accent-light)' : 'var(--text-secondary)' }}>
                                                    {isAdmin ? 'Admin' : 'Membro'}
                                                </span>
                                                {!isAdmin && hasPermission('MEMBER_MANAGE') && (
                                                    <button onClick={() => promoteToAdmin(m.userId)} title="Promover a admin" style={{ background: 'transparent', border: 'none', color: 'var(--accent-light)', cursor: 'pointer' }}><Shield size={18} /></button>
                                                )}
                                                {hasPermission('MEMBER_MANAGE') && (
                                                    <button onClick={() => removeMember(m.userId)} title="Remover membro" style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function DropzoneUploader({ onUpload, isUploading, label = 'Fazer Upload', progress }: { onUpload: (files: File[]) => void, isUploading: boolean, label?: string, progress?: number }) {
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: onUpload,
        maxFiles: 1,
        disabled: isUploading,
        noClick: true, // We handle click manually to avoid bubbling issues
    });

    return (
        <div
            {...getRootProps()}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isUploading) {
                    open();
                }
            }}
            style={{
                border: `1px dashed ${isDragActive ? 'var(--accent-light)' : 'rgba(255,255,255,0.2)'}`,
                padding: '12px 16px',
                borderRadius: '8px',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                background: isDragActive ? 'rgba(139, 92, 246, 0.1)' : 'var(--card-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: 'var(--text-secondary)',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {isUploading && progress !== undefined && (
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progress}%`, background: 'rgba(139, 92, 246, 0.15)', transition: 'width 0.2s', zIndex: 0 }} />
            )}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input {...getInputProps()} />
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} color="var(--accent-light)" />}
                <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{isUploading ? `Enviando... ${progress !== undefined && progress > 0 ? progress + '%' : ''}` : label}</span>
            </div>
        </div>
    );
}
