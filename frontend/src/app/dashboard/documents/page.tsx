'use client';
import axios from 'axios';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Loader2, Trash2, Edit2, Save, X } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface DocumentType {
    id: string;
    name: string;
    description: string | null;
    isDefault?: boolean;
}

export default function DocumentTypesDashboard() {
    const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');

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
        fetchDocumentTypes(activeToken);
    }, [status, session]);

    const fetchDocumentTypes = async (token: string) => {
        try {
            setLoading(true);
            const res = await axios.get('/api/documents/types', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDocumentTypes(res.data);
        } catch (error) {
            toast.error('Falha ao buscar tipos de documento');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            setIsCreating(true);
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await axios.post('/api/documents/types',
                { name: newName, description: newDescription },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setDocumentTypes(prev => [...prev, res.data]);
            setNewName('');
            setNewDescription('');
            toast.success('Tipo de documento criado');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Falha ao criar tipo de documento');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza? Isso pode afetar os projetos configurados.')) return;
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            await axios.delete(`/api/documents/types/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDocumentTypes(prev => prev.filter(t => t.id !== id));
            toast.success('Removido com sucesso');
        } catch (error) {
            toast.error('Falha ao remover');
        }
    };

    const startEdit = (doc: DocumentType) => {
        setEditingId(doc.id);
        setEditName(doc.name);
        setEditDescription(doc.description || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditDescription('');
    };

    const saveEdit = async (id: string) => {
        try {
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await axios.put(`/api/documents/types/${id}`,
                { name: editName, description: editDescription },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setDocumentTypes(prev => prev.map(t => t.id === id ? res.data : t));
            cancelEdit();
            toast.success('Atualizado com sucesso');
        } catch (error) {
            toast.error('Falha ao atualizar');
        }
    };

    return (
        <div className="project-container" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <header className="project-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
                <button
                    onClick={() => router.push('/dashboard')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Tipos de Documento Globais</h1>
            </header>

            <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Novo Tipo de Documento</h2>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <input
                        className="input-field"
                        placeholder="Nome (ex: CNH, RG...)"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        style={{ flex: 1, minWidth: '200px' }}
                    />
                    <input
                        className="input-field"
                        placeholder="Descrição (opcional)"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        style={{ flex: 2, minWidth: '300px' }}
                    />
                    <button
                        onClick={handleCreate}
                        disabled={isCreating}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent-light)', color: 'white', padding: '12px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, height: '48px' }}
                    >
                        {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                        Adicionar
                    </button>
                </div>
                {newName.trim().length >= 3 && documentTypes.some(d => d.name.toLowerCase().includes(newName.toLowerCase())) && (
                    <div style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--warning)', padding: '8px 12px', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '6px' }}>
                        Nota: Já existem documentos semelhantes (<span style={{fontWeight: 'bold'}}>{documentTypes.filter(d => d.name.toLowerCase().includes(newName.toLowerCase())).map(d => d.name).join(', ')}</span>). Evite criar duplicatas.
                    </div>
                )}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                    <Loader2 size={32} className="animate-spin" color="var(--accent-light)" />
                </div>
            ) : documentTypes.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Nenhum tipo de documento cadastrado ainda.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {documentTypes.map(doc => (
                        <div key={doc.id} className="glass-panel" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {editingId === doc.id ? (
                                <div style={{ display: 'flex', gap: '16px', flex: 1, marginRight: '16px' }}>
                                    <input
                                        className="input-field"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                    <input
                                        className="input-field"
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                        style={{ flex: 2 }}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {doc.name}
                                        {doc.isDefault && (
                                            <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                                                Sistema
                                            </span>
                                        )}
                                    </h3>
                                    {doc.description && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>{doc.description}</p>}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '8px' }}>
                                {editingId === doc.id ? (
                                    <>
                                        <button onClick={() => saveEdit(doc.id)} style={{ padding: '8px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                            <Save size={18} />
                                        </button>
                                        <button onClick={cancelEdit} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                            <X size={18} />
                                        </button>
                                    </>
                                ) : !doc.isDefault ? (
                                    <>
                                        <button onClick={() => startEdit(doc)} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(doc.id)} style={{ padding: '8px', background: 'var(--error)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
