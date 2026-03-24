'use client';

import api from '@/lib/api';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, Trash2, Edit2, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { Nav } from '@/components/Nav';
import styles from './page.module.scss';

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
            const res = await api.get('/api/documents/types', {
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
            const res = await api.post('/api/documents/types',
                { name: newName, description: newDescription },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setDocumentTypes(prev => [res.data, ...prev]);
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
            await api.delete(`/api/documents/types/${id}`, {
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
            const res = await api.put(`/api/documents/types/${id}`,
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

    const handleLogout = async () => {
        localStorage.removeItem('token');
        if (session) {
            await signOut({ redirect: false });
        }
        router.push('/');
    };

    const userName = session?.user?.name || 'User';
    const userInitials = userName.substring(0, 2).toUpperCase();

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
                    onLogout={handleLogout}
                />

                <div className={styles.canvas}>
                    
                    <header className={styles.sectionHeader}>
                        <div>
                            <h2 className={styles.sectionTitle}>Tipos de Documento</h2>
                            <p className={styles.sectionSubtitle}>Gerencie os tipos de documentos globais do sistema.</p>
                        </div>
                    </header>

                    {/* Novo Tipo de Documento Card */}
                    <section className={styles.createSection}>
                        <div className={styles.createHeader}>
                            <div className={styles.createIconWrapper}>
                                <FileText size={20} />
                            </div>
                            <div>
                                <h3 className={styles.createTitle}>Novo Tipo de Documento</h3>
                            </div>
                        </div>

                        <div className={styles.createForm}>
                            <div className={`${styles.fieldGroup} ${styles.nameField}`}>
                                <label className={styles.fieldLabel}>Nome</label>
                                <input
                                    className={styles.fieldInput}
                                    placeholder="Ex: CNH, RG..."
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                />
                            </div>
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>Descrição</label>
                                <input
                                    className={styles.fieldInput}
                                    placeholder="Descrição (opcional)"
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                />
                            </div>
                            <div>
                                <button
                                    onClick={handleCreate}
                                    disabled={isCreating}
                                    className={styles.addBtn}
                                >
                                    {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    Adicionar
                                </button>
                            </div>
                        </div>

                        {newName.trim().length >= 3 && documentTypes.some(d => d.name.toLowerCase().includes(newName.toLowerCase())) && (
                            <div className={styles.alertBox}>
                                <AlertTriangle size={16} />
                                <span>
                                    Já existem documentos semelhantes (<span className={styles.bold}>{documentTypes.filter(d => d.name.toLowerCase().includes(newName.toLowerCase())).map(d => d.name).join(', ')}</span>). Evite criar duplicatas.
                                </span>
                            </div>
                        )}
                    </section>

                    {/* Lista de Documentos */}
                    <section>
                        {documentTypes.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p className={styles.emptyText}>Nenhum tipo de documento cadastrado ainda.</p>
                            </div>
                        ) : (
                            <div className={styles.docGrid}>
                                {documentTypes.map(doc => {
                                    const isEditing = editingId === doc.id;

                                    return (
                                        <div key={doc.id} className={styles.docCard}>
                                            
                                            {isEditing ? (
                                                <div className={styles.editMode}>
                                                    <div className={styles.editFieldGroup}>
                                                        <label className={styles.editLabel}>Nome</label>
                                                        <input
                                                            className={styles.editInput}
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div className={styles.editFieldGroup}>
                                                        <label className={styles.editLabel}>Descrição</label>
                                                        <textarea
                                                            className={styles.editTextarea}
                                                            value={editDescription}
                                                            onChange={(e) => setEditDescription(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className={styles.docCardContent}>
                                                    <div className={styles.docCardHeader}>
                                                        <div className={styles.docIconWrapper}>
                                                            {doc.isDefault ? <ShieldCheck size={20} /> : <FileText size={20} />}
                                                        </div>
                                                        {doc.isDefault && (
                                                            <span className={styles.systemBadge}>
                                                                Sistema
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className={styles.docName} title={doc.name}>
                                                        {doc.name}
                                                    </h3>
                                                    <p className={styles.docDescription} title={doc.description || ''}>
                                                        {doc.description || <span className={styles.italic}>Sem descrição</span>}
                                                    </p>
                                                </div>
                                            )}

                                            <div className={styles.cardFooter}>
                                                {isEditing ? (
                                                    <div className={styles.editBtnGroup}>
                                                        <button onClick={cancelEdit} className={styles.cancelBtn}>
                                                            Cancelar
                                                        </button>
                                                        <button onClick={() => saveEdit(doc.id)} className={styles.saveBtn}>
                                                            Salvar
                                                        </button>
                                                    </div>
                                                ) : !doc.isDefault ? (
                                                    <>
                                                        <button onClick={() => startEdit(doc)} className={styles.actionBtn} title="Editar">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => handleDelete(doc.id)} className={`${styles.actionBtn} ${styles.danger}`} title="Remover">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className={styles.readOnlyText}>Não editável</span>
                                                )}
                                            </div>
                                            
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}

