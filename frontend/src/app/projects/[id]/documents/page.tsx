'use client';
import api from '@/lib/api';
import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle, FileText, Loader2, UploadCloud, Check, X } from 'lucide-react';
import { useSession } from 'next-auth/react';

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

    const updateDocStatus = async (docId: string, status: string, reason?: string) => {
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await api.patch(`/api/documents/${docId}/status`, {
                status,
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
            case 'approved': return <span style={{ background: 'var(--success)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Aprovado</span>;
            case 'rejected': return <span style={{ background: 'var(--danger)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Rejeitado</span>;
            case 'pending': return <span style={{ background: 'var(--warning)', color: 'black', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Pendente</span>;
            default: return null;
        }
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 size={32} className="animate-spin" color="var(--accent-light)" /></div>;
    }

    return (
        <div className="project-container" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <button onClick={() => router.push(`/projects/${id}`)} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: '24px' }}>
                <ArrowLeft size={18} /> Voltar ao Projeto
            </button>
            <header className="project-header" style={{ marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Gestão de Documentos</h1>
                <p style={{ color: 'var(--text-secondary)' }}>{project?.name}</p>
            </header>

            <div className="docs-layout" style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>

                {/* ADMIN CONFIG SECTION */}
                {isAdmin && (
                    <div className="glass-panel docs-section-left" style={{ padding: '24px', flex: '1', minWidth: '300px', alignSelf: 'flex-start' }}>
                        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={20} color="var(--accent-light)" />
                            Configuração de Documentos
                        </h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                            Selecione os documentos obrigatórios para os clientes deste projeto.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {globalTypes.map(type => {
                                const isRequired = requiredDocs.some(rd => rd.documentTypeId === type.id);
                                return (
                                    <label key={type.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={isRequired}
                                            onChange={() => toggleRequiredDocument(type.id)}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        <div>
                                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {type.name}
                                                {type.isDefault && (
                                                    <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                                                        Sistema
                                                    </span>
                                                )}
                                            </span>
                                            {type.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{type.description}</p>}
                                        </div>
                                    </label>
                                );
                            })}
                            {globalTypes.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nenhum tipo de documento global cadastrado.</p>}
                        </div>
                    </div>
                )}

                {/* USER/ADMIN DOCUMENTS VIEW */}
                <div className="docs-section-right" style={{ flex: '2', minWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* User upload section */}
                    {!isAdmin && (
                        <div className="glass-panel" style={{ padding: '24px' }}>
                            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Meus Documentos Obrigatórios</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {requiredDocs.map(rd => {
                                    // Check if user has uploaded this doc
                                    const userDoc = clientDocs.find(cd => cd.documentTypeId === rd.documentTypeId && cd.ownerUserId === currentUser?.userId);

                                    return (
                                        <div key={rd.id} className="admin-doc-item" style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                            <div>
                                                <h3 style={{ fontWeight: 600 }}>{rd.documentType.name}</h3>
                                                {rd.documentType.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{rd.documentType.description}</p>}
                                            </div>

                                            {userDoc ? (
                                                <div className="doc-file-row" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    {getStatusBadge(userDoc.status)}
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{userDoc.file.originalName}</span>
                                                    {userDoc.status === 'rejected' && (
                                                        <p style={{ color: 'var(--danger)', fontSize: '0.85rem', width: '100%', marginTop: '8px' }}>
                                                            Motivo: {userDoc.rejectionReason || 'Recusado pelo administrador'}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="admin-doc-upload">
                                                    <DropzoneUploader
                                                        onUpload={(files) => handleUploadDocument(files, rd.documentTypeId)}
                                                        isUploading={uploadingDocType === rd.documentTypeId}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {requiredDocs.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Nenhum documento exigido neste projeto.</p>}
                            </div>
                        </div>
                    )}

                    {/* Admin viewing all docs */}
                    {isAdmin && (
                        <div className="glass-panel" style={{ padding: '24px' }}>
                            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Documentos Recebidos</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {clientDocs.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Nenhum documento enviado ainda.</p>}
                                {clientDocs.map(doc => (
                                    <div key={doc.id} className="admin-doc-item" style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                                        <div className="doc-file-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <div>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--accent-light)', fontWeight: 600 }}>{doc.documentType.name}</p>
                                                <h3 style={{ fontWeight: 600 }}>{doc.file.originalName}</h3>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                    Enviado por: {doc.ownerUser.name} ({doc.ownerUser.email})
                                                </p>
                                            </div>
                                            <div>{getStatusBadge(doc.status)}</div>
                                        </div>

                                        {doc.status === 'pending' && (
                                            <div className="admin-doc-actions" style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                                <button onClick={() => updateDocStatus(doc.id, 'approved')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--success)', color: 'white', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
                                                    <Check size={16} /> Aprovar
                                                </button>
                                                <button onClick={() => {
                                                    const reason = prompt('Motivo da rejeição:');
                                                    if (reason !== null) updateDocStatus(doc.id, 'rejected', reason);
                                                }} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--danger)', color: 'white', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
                                                    <X size={16} /> Rejeitar
                                                </button>
                                            </div>
                                        )}

                                        {doc.status === 'rejected' && doc.rejectionReason && (
                                            <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '3px solid var(--danger)', borderRadius: '4px', fontSize: '0.9rem' }}>
                                                <span style={{ fontWeight: 600, color: 'var(--danger)' }}>Motivo: </span>
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
            style={{
                border: `1px dashed ${isDragActive ? 'var(--accent-light)' : 'rgba(255,255,255,0.2)'}`,
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                background: isDragActive ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--text-secondary)'
            }}
        >
            <input {...getInputProps()} />
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            <span style={{ fontSize: '0.9rem' }}>{isUploading ? 'Enviando...' : 'Adicionar Arquivo'}</span>
        </div>
    );
}
