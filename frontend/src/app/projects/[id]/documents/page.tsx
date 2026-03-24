'use client';
import api from '@/lib/api';
import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle, FileText, Loader2, UploadCloud, Check, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Nav } from '@/components/Nav';
import styles from './page.module.scss';

export default function ProjectDocumentsPage() {
    const { id } = useParams();
    const router = useRouter();
    const { data: session, status } = useSession();

    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Global types and current required types
    const [globalTypes, setGlobalTypes] = useState<any[]>([]);
    const [requiredDocs, setRequiredDocs] = useState<any[]>([]);

    // Client documents
    const [clientDocs, setClientDocs] = useState<any[]>([]);

    // Upload state
    const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'loading') return;
        const localToken = localStorage.getItem('token');
        const activeToken = session?.user?.token || localToken;
        if (!activeToken) {
            router.push('/');
            return;
        }

        // Decode user
        const payload = JSON.parse(atob(activeToken.split('.')[1]));
        setCurrentUser(payload);

        fetchData(activeToken);
    }, [id, status, session]);

    const fetchData = async (token: string) => {
        try {
            setLoading(true);
            const headers = { Authorization: `Bearer ${token}` };

            // 1. Get project details and user role
            const projsRes = await api.get(`/api/projects`, { headers });
            const currentProj = projsRes.data.projects.find((p: any) => p.id === id);
            setProject(currentProj);

            try {
                const membersRes = await api.get(`/api/projects/${id}/members`, { headers });
                const me = membersRes.data.members.find((m: any) => m.userId === currentUser?.userId || m.userId === JSON.parse(atob(token.split('.')[1])).userId);
                setIsAdmin(me?.permissions?.includes('PROJECT_EDIT') || me?.role === 'ADMIN');
            } catch (e) {
                setIsAdmin(false);
            }

            // 2. Fetch required docs
            const reqDocsRes = await api.get(`/api/projects/${id}/required-documents`, { headers });
            setRequiredDocs(reqDocsRes.data);

            // 3. Fetch client docs
            const clientDocsRes = await api.get(`/api/projects/${id}/client-documents`, { headers });
            setClientDocs(clientDocsRes.data);

            // 4. If admin, fetch global types
            try {
                const typesRes = await api.get(`/api/documents/types`, { headers });
                setGlobalTypes(typesRes.data);
            } catch (e) {
                // Ignore if not allowed or whatever
            }
        } catch (error) {
            toast.error('Falha ao carregar dados dos documentos');
        } finally {
            setLoading(false);
        }
    };

    const toggleRequiredDocument = async (docTypeId: string) => {
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const currentIds = requiredDocs.map(rd => rd.documentTypeId);
            let newIds = [];

            if (currentIds.includes(docTypeId)) {
                newIds = currentIds.filter(id => id !== docTypeId);
            } else {
                newIds = [...currentIds, docTypeId];
            }

            const res = await api.post(`/api/projects/${id}/required-documents`,
                { documentTypeIds: newIds },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setRequiredDocs(res.data);
            toast.success('Configuração atualizada');
        } catch (error) {
            toast.error('Falha ao atualizar configuração');
        }
    };

    const handleUploadDocument = async (acceptedFiles: File[], docTypeId: string) => {
        if (acceptedFiles.length === 0) return;
        setUploadingDocType(docTypeId);

        const file = acceptedFiles[0]; // Only take first file
        const token = session?.user?.token || localStorage.getItem('token');

        try {
            // 1. Upload file itself
            const formData = new FormData();
            formData.append('file', file);
            formData.append('projectId', id as string);

            const uploadRes = await api.post('/api/files/upload', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            const dbFile = uploadRes.data.file;

            // 2. Link file to ClientDocument
            const clientDocRes = await api.post(`/api/projects/${id}/client-documents`, {
                documentTypeId: docTypeId,
                ownerUserId: currentUser.userId,
                fileId: dbFile.id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setClientDocs(prev => [clientDocRes.data, ...prev]);
            toast.success('Documento enviado com sucesso!');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Falha ao enviar documento');
        } finally {
            setUploadingDocType(null);
        }
    };

    const updateDocStatus = async (docId: string, statusText: string, reason?: string) => {
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await api.patch(`/api/documents/${docId}/status`, {
                status: statusText,
                rejectionReason: reason
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setClientDocs(prev => prev.map(d => d.id === docId ? res.data : d));
            toast.success('Status atualizado');
        } catch (error) {
            toast.error('Falha ao atualizar status');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved': return <span className={`${styles.statusBadge} ${styles.approved}`}>Aprovado</span>;
            case 'rejected': return <span className={`${styles.statusBadge} ${styles.rejected}`}>Rejeitado</span>;
            case 'pending': return <span className={`${styles.statusBadge} ${styles.pending}`}>Pendente</span>;
            default: return null;
        }
    };

    const userName = session?.user?.name || 'User';
    const userInitials = userName.substring(0, 2).toUpperCase();

    const handleLogout = async () => {
        localStorage.removeItem('token');
        if (session) {
            const { signOut } = await import('next-auth/react');
            await signOut({ redirect: false });
        }
        router.push('/');
    };

    if (loading) {
        return (
            <div className={styles.loadingScreen}>
                <Loader2 size={32} className="animate-spin" style={{ color: '#f59e0b' }} />
            </div>
        );
    }

    return (
        <div className={styles.root}>
            <main className={styles.main}>
                <Nav
                    context="project"
                    projectName={project?.name}
                    userInitials={userInitials}
                    onLogout={handleLogout}
                />

                <div className={styles.canvas}>
                    <button onClick={() => router.push(`/projects/${id}`)} className={styles.backBtn}>
                        <ArrowLeft size={18} /> Voltar ao Projeto
                    </button>

                    <header className={styles.header}>
                        <h1 className={styles.title}>Gestão de Documentos</h1>
                        <p className={styles.subtitle}>{project?.name}</p>
                    </header>

                    <div className={styles.layoutGrid}>

                        {/* ADMIN CONFIG SECTION */}
                        {isAdmin && (
                            <div className={styles.adminPanel}>
                                <div className={styles.panelHeader}>
                                    <div className={styles.panelIcon}>
                                        <FileText size={20} />
                                    </div>
                                    <h2 className={styles.panelTitle}>Configuração de Documentos</h2>
                                </div>
                                <p className={styles.panelDescription}>
                                    Selecione os documentos obrigatórios para os clientes deste projeto.
                                </p>
                                <div className={styles.configList}>
                                    {globalTypes.map(type => {
                                        const isRequired = requiredDocs.some(rd => rd.documentTypeId === type.id);
                                        return (
                                            <label key={type.id} className={styles.checkboxLabel}>
                                                <input
                                                    type="checkbox"
                                                    checked={isRequired}
                                                    onChange={() => toggleRequiredDocument(type.id)}
                                                    className={styles.checkboxInput}
                                                />
                                                <div className={styles.checkboxText}>
                                                    <span className={styles.checkboxTitleRow}>
                                                        <span className={styles.checkboxName}>{type.name}</span>
                                                        {type.isDefault && (
                                                            <span className={styles.systemBadge}>
                                                                Sistema
                                                            </span>
                                                        )}
                                                    </span>
                                                    {type.description && <p className={styles.checkboxDesc}>{type.description}</p>}
                                                </div>
                                            </label>
                                        );
                                    })}
                                    {globalTypes.length === 0 && <p className={styles.emptyState}>Nenhum tipo de documento global cadastrado.</p>}
                                </div>
                            </div>
                        )}

                        {/* USER/ADMIN DOCUMENTS VIEW */}
                        <div className={styles.contentPanel}>

                            {/* User upload section */}
                            {!isAdmin && (
                                <div>
                                    <h2 className={styles.panelTitle} style={{ marginBottom: '1.5rem' }}>Meus Documentos Obrigatórios</h2>
                                    <div className={styles.docList}>
                                        {requiredDocs.map(rd => {
                                            // Check if user has uploaded this doc
                                            const userDoc = clientDocs.find(cd => cd.documentTypeId === rd.documentTypeId && cd.ownerUserId === currentUser?.userId);

                                            return (
                                                <div key={rd.id} className={styles.docCard}>
                                                    <div className={styles.docCardLeft}>
                                                        <h3 className={styles.docCardTitle}>{rd.documentType.name}</h3>
                                                        {rd.documentType.description && <p className={styles.docCardSubtitle}>{rd.documentType.description}</p>}
                                                    </div>

                                                    {userDoc ? (
                                                        <div className={styles.docCardRight}>
                                                            {getStatusBadge(userDoc.status)}
                                                            <span className={styles.docCardSubtitle}>{userDoc.file.originalName}</span>
                                                            {userDoc.status === 'rejected' && (
                                                                <div className={styles.rejectionReason}>
                                                                    <strong>Motivo: </strong> {userDoc.rejectionReason || 'Recusado pelo administrador'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <DropzoneUploader
                                                            onUpload={(files) => handleUploadDocument(files, rd.documentTypeId)}
                                                            isUploading={uploadingDocType === rd.documentTypeId}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {requiredDocs.length === 0 && <p className={styles.emptyState}>Nenhum documento exigido neste projeto.</p>}
                                    </div>
                                </div>
                            )}

                            {/* Admin viewing all docs */}
                            {isAdmin && (
                                <div>
                                    <h2 className={styles.panelTitle} style={{ marginBottom: '1.5rem', marginTop: isAdmin ? '0' : '2rem' }}>Documentos Recebidos</h2>
                                    <div className={styles.docList}>
                                        {clientDocs.length === 0 && <p className={styles.emptyState}>Nenhum documento enviado ainda.</p>}
                                        {clientDocs.map(doc => (
                                            <div key={doc.id} className={styles.docCard}>
                                                <div className={styles.docCardLeft}>
                                                    <p className={styles.docTypeTag}>{doc.documentType.name}</p>
                                                    <h3 className={styles.docCardTitle}>{doc.file.originalName}</h3>
                                                    <p className={styles.docCardSubtitle}>
                                                        Enviado por: {doc.ownerUser.name} ({doc.ownerUser.email})
                                                    </p>
                                                </div>
                                                <div className={styles.docCardRight}>
                                                    <div>{getStatusBadge(doc.status)}</div>
                                                </div>

                                                {doc.status === 'pending' && (
                                                    <div className={styles.actionButtons}>
                                                        <button onClick={() => updateDocStatus(doc.id, 'approved')} className={`${styles.actionBtn} ${styles.approve}`}>
                                                            <Check size={16} /> Aprovar
                                                        </button>
                                                        <button onClick={() => {
                                                            const reason = prompt('Motivo da rejeição:');
                                                            if (reason !== null) updateDocStatus(doc.id, 'rejected', reason);
                                                        }} className={`${styles.actionBtn} ${styles.reject}`}>
                                                            <X size={16} /> Rejeitar
                                                        </button>
                                                    </div>
                                                )}

                                                {doc.status === 'rejected' && doc.rejectionReason && (
                                                    <div className={styles.rejectionReason}>
                                                        <span style={{ fontWeight: 700 }}>Motivo: </span>
                                                        {doc.rejectionReason}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function DropzoneUploader({ onUpload, isUploading }: { onUpload: (files: File[]) => void, isUploading: boolean }) {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: onUpload,
        maxFiles: 1,
        disabled: isUploading
    });

    return (
        <div
            {...getRootProps()}
            className={`${styles.dropzoneWrapper} ${isUploading ? styles.uploading : styles.idle} ${isDragActive ? styles.dragActive : ''}`}
        >
            <input {...getInputProps()} />
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            <span>{isUploading ? 'Enviando...' : 'Adicionar Arquivo'}</span>
        </div>
    );
}
