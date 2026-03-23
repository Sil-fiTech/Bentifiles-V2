'use client';
import api from '@/lib/api';
import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle, FileText, Loader2, UploadCloud, Check, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Nav } from '@/components/Nav';

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
            case 'approved': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold">Aprovado</span>;
            case 'rejected': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">Rejeitado</span>;
            case 'pending': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-bold">Pendente</span>;
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
            <div className="h-screen w-full flex items-center justify-center bg-surface">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
        );
    }

    return (
        <div className="bg-background font-body text-on-surface antialiased overflow-hidden flex h-screen w-full relative">
            <main className="flex-1 h-screen flex flex-col items-center bg-surface overflow-y-auto relative w-full custom-scrollbar">
                <Nav
                    context="project"
                    projectName={project?.name}
                    userInitials={userInitials}
                    onLogout={handleLogout}
                />

                <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 space-y-8 pb-24">
                    <button onClick={() => router.push(`/projects/${id}`)} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 hover:bg-white px-4 py-2 rounded-lg shadow-sm font-bold text-sm transition-all w-fit active:scale-[0.98]">
                        <ArrowLeft size={18} /> Voltar ao Projeto
                    </button>

                    <header className="mb-8">
                        <h1 className="text-3xl font-headline font-black text-zinc-900 tracking-tighter">Gestão de Documentos</h1>
                        <p className="text-sm text-zinc-500 font-medium mt-1">{project?.name}</p>
                    </header>

                    <div className="flex flex-col lg:flex-row gap-8">

                        {/* ADMIN CONFIG SECTION */}
                        {isAdmin && (
                            <div className="bg-white border border-zinc-200/60 rounded-xl shadow-sm p-6 lg:w-1/3 self-start">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100">
                                        <FileText size={20} className="text-amber-500" />
                                    </div>
                                    <h2 className="font-headline font-bold text-lg text-zinc-900">Configuração de Documentos</h2>
                                </div>
                                <p className="text-sm text-zinc-500 font-medium mb-6">
                                    Selecione os documentos obrigatórios para os clientes deste projeto.
                                </p>
                                <div className="flex flex-col gap-4">
                                    {globalTypes.map(type => {
                                        const isRequired = requiredDocs.some(rd => rd.documentTypeId === type.id);
                                        return (
                                            <label key={type.id} className="flex items-center gap-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={isRequired}
                                                    onChange={() => toggleRequiredDocument(type.id)}
                                                    className="w-4 h-4 cursor-pointer rounded border-zinc-300 text-amber-500 focus:ring-amber-400"
                                                />
                                                <div>
                                                    <span className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                                                        {type.name}
                                                        {type.isDefault && (
                                                            <span className="text-[10px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                                                                Sistema
                                                            </span>
                                                        )}
                                                    </span>
                                                    {type.description && <p className="text-xs text-zinc-500 mt-0.5">{type.description}</p>}
                                                </div>
                                            </label>
                                        );
                                    })}
                                    {globalTypes.length === 0 && <p className="text-zinc-500 text-sm">Nenhum tipo de documento global cadastrado.</p>}
                                </div>
                            </div>
                        )}

                        {/* USER/ADMIN DOCUMENTS VIEW */}
                        <div className="flex-1 flex flex-col gap-6">

                            {/* User upload section */}
                            {!isAdmin && (
                                <div className="bg-white border border-zinc-200/60 rounded-xl shadow-sm p-6">
                                    <h2 className="font-headline font-bold text-lg text-zinc-900 mb-6">Meus Documentos Obrigatórios</h2>
                                    <div className="flex flex-col gap-4">
                                        {requiredDocs.map(rd => {
                                            // Check if user has uploaded this doc
                                            const userDoc = clientDocs.find(cd => cd.documentTypeId === rd.documentTypeId && cd.ownerUserId === currentUser?.userId);

                                            return (
                                                <div key={rd.id} className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                    <div>
                                                        <h3 className="font-headline font-bold text-sm text-zinc-900">{rd.documentType.name}</h3>
                                                        {rd.documentType.description && <p className="text-xs text-zinc-500 mt-0.5">{rd.documentType.description}</p>}
                                                    </div>

                                                    {userDoc ? (
                                                        <div className="flex items-center gap-4 flex-wrap">
                                                            {getStatusBadge(userDoc.status)}
                                                            <span className="text-zinc-500 text-sm">{userDoc.file.originalName}</span>
                                                            {userDoc.status === 'rejected' && (
                                                                <p className="text-red-500 text-xs font-medium w-full mt-2">
                                                                    Motivo: {userDoc.rejectionReason || 'Recusado pelo administrador'}
                                                                </p>
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
                                        {requiredDocs.length === 0 && <p className="text-zinc-500 text-sm">Nenhum documento exigido neste projeto.</p>}
                                    </div>
                                </div>
                            )}

                            {/* Admin viewing all docs */}
                            {isAdmin && (
                                <div className="bg-white border border-zinc-200/60 rounded-xl shadow-sm p-6">
                                    <h2 className="font-headline font-bold text-lg text-zinc-900 mb-6">Documentos Recebidos</h2>
                                    <div className="flex flex-col gap-4">
                                        {clientDocs.length === 0 && <p className="text-zinc-500 text-sm">Nenhum documento enviado ainda.</p>}
                                        {clientDocs.map(doc => (
                                            <div key={doc.id} className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/60">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                                    <div>
                                                        <p className="text-xs text-amber-600 font-bold uppercase tracking-widest">{doc.documentType.name}</p>
                                                        <h3 className="font-headline font-bold text-sm text-zinc-900 mt-1">{doc.file.originalName}</h3>
                                                        <p className="text-xs text-zinc-500 mt-0.5">
                                                            Enviado por: {doc.ownerUser.name} ({doc.ownerUser.email})
                                                        </p>
                                                    </div>
                                                    <div>{getStatusBadge(doc.status)}</div>
                                                </div>

                                                {doc.status === 'pending' && (
                                                    <div className="flex gap-2 mt-4">
                                                        <button onClick={() => updateDocStatus(doc.id, 'approved')} className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-lg border border-emerald-200 transition-colors font-bold text-[11px] uppercase tracking-wider shadow-sm active:scale-[0.98]">
                                                            <Check size={16} /> Aprovar
                                                        </button>
                                                        <button onClick={() => {
                                                            const reason = prompt('Motivo da rejeição:');
                                                            if (reason !== null) updateDocStatus(doc.id, 'rejected', reason);
                                                        }} className="flex items-center gap-1.5 bg-red-50 text-red-700 hover:bg-red-100 px-4 py-2 rounded-lg border border-red-200 transition-colors font-bold text-[11px] uppercase tracking-wider shadow-sm active:scale-[0.98]">
                                                            <X size={16} /> Rejeitar
                                                        </button>
                                                    </div>
                                                )}

                                                {doc.status === 'rejected' && doc.rejectionReason && (
                                                    <div className="mt-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-lg text-sm">
                                                        <span className="font-bold text-red-600">Motivo: </span>
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
            className={`
                flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all text-sm font-bold
                ${isUploading ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' : 'border border-dashed border-zinc-300 text-zinc-600 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/50'}
                ${isDragActive ? 'border-amber-400 bg-amber-50/50' : ''}
            `}
        >
            <input {...getInputProps()} />
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            <span>{isUploading ? 'Enviando...' : 'Adicionar Arquivo'}</span>
        </div>
    );
}
