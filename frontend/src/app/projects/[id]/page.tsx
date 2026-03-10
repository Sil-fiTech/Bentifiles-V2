'use client';
import axios from 'axios';
import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import { UploadCloud, File as FileIcon, CheckCircle, AlertTriangle, XCircle, Users, Link as LinkIcon, ArrowLeft, Trash2, Shield, Loader2 } from 'lucide-react';
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

    const { data: session, status } = useSession();

    useEffect(() => {
        if (status === 'loading') return;
        const localToken = localStorage.getItem('token');
        const activeToken = session?.user?.token || localToken;
        if (!activeToken) {
            router.push('/');
            return;
        }
        fetchData(activeToken as string);
    }, [id, status, session]);

    const fetchData = async (token: string) => {
        try {
            setLoading(true);
            const headers = { Authorization: `Bearer ${token}` };

            // Get files
            const filesRes = await axios.get(`http://localhost:3001/api/projects/${id}/documents`, { headers });
            setFiles(filesRes.data.files);

            // Get members and find current user permissions
            try {
                const membersRes = await axios.get(`http://localhost:3001/api/projects/${id}/members`, { headers });
                setMembers(membersRes.data.members);

                // Decode token to get current user ID
                const payload = JSON.parse(atob((token || '').split('.')[1]));
                const me = membersRes.data.members.find((m: any) => m.userId === payload.userId);
                if (me) setCurrentUserPermissions(me.permissions || []);
            } catch (err) {
                // If not allowed to fetch members, we just assume basic permissions
                setCurrentUserPermissions(['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD']);
            }

            // Get project details
            const projsRes = await axios.get(`http://localhost:3001/api/projects`, { headers });
            const currentProj = projsRes.data.projects.find((p: any) => p.id === id);
            setProject(currentProj);

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

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!hasPermission('DOCUMENT_UPLOAD')) {
            toast.error('Você não tem permissão para enviar documentos');
            return;
        }
        if (acceptedFiles.length === 0) return;
        setUploading(true);
        const token = session?.user?.token || localStorage.getItem('token');

        for (const file of acceptedFiles) {
            const formData = new FormData();
            formData.append('file', file);
            console.log("file ==> ", file);
            formData.append('projectId', id as string);
            console.log("id ==> ", id);

            console.log("formData ==> ", formData);
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

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 size={32} className="animate-spin" color="var(--accent-light)" /></div>;
    }

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <button onClick={() => router.push('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: '24px' }}>
                <ArrowLeft size={18} /> Voltar ao Painel
            </button>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>{project?.name || 'Projeto'}</h1>
                <div style={{ display: 'flex', gap: '16px' }}>
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

            <div
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
            </div>

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
            </div>

            {/* Manage Users Modal */}
            {showManageModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="glass-panel2" style={{ width: '100%', maxWidth: '600px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Gerenciar Usuários</h2>
                            <button onClick={() => setShowManageModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><XCircle size={24} /></button>
                        </div>

                        <div style={{ marginBottom: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3>Convidar novo usuário</h3>
                                <button onClick={generateInvite} style={{ background: 'var(--accent-light)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>Gerar Link</button>
                            </div>
                            {inviteLink && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input type="text" readOnly value={inviteLink} style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)' }} />
                                    <button onClick={copyInvite} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}><LinkIcon size={18} /></button>
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 style={{ marginBottom: '16px' }}>Membros ({members.length})</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {members.map((m: any) => {
                                    const isAdmin = m.permissions?.includes('PROJECT_EDIT');
                                    return (
                                        <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                            <div>
                                                <p style={{ fontWeight: 600 }}>{m.user.name}</p>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{m.user.email}</p>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
