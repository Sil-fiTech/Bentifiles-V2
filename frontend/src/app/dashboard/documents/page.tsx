'use client';

import api from '@/lib/api';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, Trash2, Edit2, Save, X, FileText, Settings, Key, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { Nav } from '@/components/Nav';

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
            <div className="h-screen w-full flex items-center justify-center bg-surface">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
        );
    }

    return (
        <div className="bg-background font-body text-on-surface antialiased overflow-hidden flex h-screen w-full relative">
            <main className="flex-1 h-screen flex flex-col items-center bg-surface overflow-y-auto relative w-full custom-scrollbar">
                <Nav
                    userInitials={userInitials}
                    onLogout={handleLogout}
                />

                <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 space-y-8 md:space-y-12 pb-24">
                    
                    <header className="mb-8">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div>
                                <h2 className="text-3xl font-headline font-black text-zinc-900 tracking-tighter">Tipos de Documento</h2>
                                <p className="text-sm text-zinc-500 font-medium mt-1">Gerencie os tipos de documentos globais do sistema.</p>
                            </div>
                        </div>
                    </header>

                    {/* Novo Tipo de Documento Card */}
                    <section className="bg-white border border-zinc-200/60 p-6 rounded-xl shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100">
                                <FileText className="text-amber-500" size={20} />
                            </div>
                            <div>
                                <h3 className="font-headline font-bold text-lg text-zinc-900">Novo Tipo de Documento</h3>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                            <div className="w-full md:w-1/3">
                                <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5 px-1">Nome</label>
                                <input
                                    className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 focus:bg-white transition-all outline-none text-zinc-900 text-sm font-medium placeholder:text-zinc-400 shadow-sm"
                                    placeholder="Ex: CNH, RG..."
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                />
                            </div>
                            <div className="w-full md:flex-1">
                                <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5 px-1">Descrição</label>
                                <input
                                    className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 focus:bg-white transition-all outline-none text-zinc-900 text-sm font-medium placeholder:text-zinc-400 shadow-sm"
                                    placeholder="Descrição (opcional)"
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                />
                            </div>
                            <div className="w-full md:w-auto md:mt-6">
                                <button
                                    onClick={handleCreate}
                                    disabled={isCreating}
                                    className="w-full md:w-auto px-5 py-2.5 bg-amber-400 hover:bg-amber-500 disabled:bg-zinc-300 disabled:cursor-not-allowed text-amber-950 rounded-xl font-headline font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    Adicionar
                                </button>
                            </div>
                        </div>

                        {newName.trim().length >= 3 && documentTypes.some(d => d.name.toLowerCase().includes(newName.toLowerCase())) && (
                            <div className="mt-4 flex items-center gap-2 bg-amber-50 text-amber-700 p-3 rounded-lg border border-amber-200/50 text-sm font-medium">
                                <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                                <span>
                                    Já existem documentos semelhantes (<span className="font-bold">{documentTypes.filter(d => d.name.toLowerCase().includes(newName.toLowerCase())).map(d => d.name).join(', ')}</span>). Evite criar duplicatas.
                                </span>
                            </div>
                        )}
                    </section>

                    {/* Lista de Documentos */}
                    <section>
                        {documentTypes.length === 0 ? (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-zinc-200/60 text-center">
                                <p className="text-zinc-500">Nenhum tipo de documento cadastrado ainda.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {documentTypes.map(doc => {
                                    const isEditing = editingId === doc.id;

                                    return (
                                        <div key={doc.id} className="bg-white border border-zinc-200/60 p-6 rounded-xl shadow-sm hover:shadow-md hover:border-zinc-300 transition-all duration-300 group flex flex-col h-full">
                                            
                                            {isEditing ? (
                                                <div className="flex flex-col gap-3 flex-1">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 ml-1">Nome</label>
                                                        <input
                                                            className="w-full px-3 py-2 bg-white border border-amber-400/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-zinc-900 text-sm font-medium"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 ml-1">Descrição</label>
                                                        <textarea
                                                            className="w-full px-3 py-2 bg-white border border-amber-400/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-zinc-900 text-xs text-zinc-600 resize-none h-20"
                                                            value={editDescription}
                                                            onChange={(e) => setEditDescription(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex-1">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="w-10 h-10 rounded-lg bg-zinc-50 flex items-center justify-center border border-zinc-200/60 text-zinc-400 group-hover:text-amber-500 group-hover:border-amber-100 group-hover:bg-amber-50/50 transition-colors">
                                                            {doc.isDefault ? <ShieldCheck size={20} /> : <FileText size={20} />}
                                                        </div>
                                                        {doc.isDefault && (
                                                            <span className="bg-zinc-100 text-zinc-500 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest">
                                                                Sistema
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="font-headline font-bold text-lg text-zinc-900 line-clamp-1 mb-1" title={doc.name}>
                                                        {doc.name}
                                                    </h3>
                                                    <p className="text-zinc-500 text-sm line-clamp-2 min-h-[40px]" title={doc.description || ''}>
                                                        {doc.description || <span className="italic opacity-50">Sem descrição</span>}
                                                    </p>
                                                </div>
                                            )}

                                            <div className="mt-6 pt-4 border-t border-zinc-200/60 flex items-center justify-end gap-2">
                                                {isEditing ? (
                                                    <>
                                                        <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors flex items-center gap-1.5">
                                                            Cancelar
                                                        </button>
                                                        <button onClick={() => saveEdit(doc.id)} className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 active:scale-[0.98]">
                                                            Salvar
                                                        </button>
                                                    </>
                                                ) : !doc.isDefault ? (
                                                    <>
                                                        <button onClick={() => startEdit(doc)} className="p-2 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors active:scale-[0.95]" title="Editar">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => handleDelete(doc.id)} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors active:scale-[0.95]" title="Remover">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] text-zinc-400 font-medium italic">Não editável</span>
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
