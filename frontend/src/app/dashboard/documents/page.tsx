'use client';

import api from '@/lib/api';
import { getAuthHeaders, performLogout } from '@/lib/authClient';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, Trash2, Edit2, FileText, AlertTriangle, ShieldCheck, Copy, Check, Search } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Nav } from '@/components/Nav';
import styles from './page.module.scss';

interface DocumentType {
    id: string;
    name: string;
    description: string | null;
    isDefault?: boolean;
}

interface TemplateDocType {
    name: string;
    isRequired: boolean;
    order: number;
}

interface Template {
    id: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    documentTypeCount: number;
}

export default function DocumentTypesDashboard() {
    const [activeTab, setActiveTab] = useState<'types' | 'templates'>('types');
    const [loading, setLoading] = useState(true);

    // Document Types State
    const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [isCreatingType, setIsCreatingType] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');

    // Templates State
    const [templates, setTemplates] = useState<Template[]>([]);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateDesc, setNewTemplateDesc] = useState('');
    const [newTemplateDocs, setNewTemplateDocs] = useState<TemplateDocType[]>([]);
    const [templateDocSearch, setTemplateDocSearch] = useState('');
    const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

    const router = useRouter();
    const { data: session, status } = useSession();

    useEffect(() => {
        if (status === 'loading') return;
        const activeToken = session?.user?.token;
        if (!activeToken) {
            fetchData();
            return;
        }
        fetchData(activeToken);
    }, [status, session]);

    const fetchData = async (token?: string | null) => {
        try {
            setLoading(true);
            const [typesRes, templatesRes] = await Promise.all([
                api.get('/api/documents/types', { headers: getAuthHeaders(token) }),
                api.get('/api/templates', { headers: getAuthHeaders(token) })
            ]);
            setDocumentTypes(typesRes.data);
            setTemplates(templatesRes.data);
        } catch (error) {
            toast.error('Falha ao buscar dados');
        } finally {
            setLoading(false);
        }
    };

    // --- Document Types Functions ---
    const handleCreateType = async () => {
        if (!newName.trim()) return;
        try {
            setIsCreatingType(true);
            const token = session?.user?.token;
            const res = await api.post('/api/documents/types',
                { name: newName, description: newDescription },
                { headers: getAuthHeaders(token) }
            );
            setDocumentTypes(prev => [res.data, ...prev]);
            setNewName('');
            setNewDescription('');
            toast.success('Tipo de documento criado');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Falha ao criar tipo de documento');
        } finally {
            setIsCreatingType(false);
        }
    };

    const handleDeleteType = async (id: string) => {
        if (!confirm('Tem certeza? Isso pode afetar os projetos configurados.')) return;
        try {
            const token = session?.user?.token;
            await api.delete(`/api/documents/types/${id}`, {
                headers: getAuthHeaders(token)
            });
            setDocumentTypes(prev => prev.filter(t => t.id !== id));
            toast.success('Removido com sucesso');
        } catch (error) {
            toast.error('Falha ao remover');
        }
    };

    const startEditType = (doc: DocumentType) => {
        setEditingId(doc.id);
        setEditName(doc.name);
        setEditDescription(doc.description || '');
    };

    const cancelEditType = () => {
        setEditingId(null);
        setEditName('');
        setEditDescription('');
    };

    const saveEditType = async (id: string) => {
        try {
            const token = session?.user?.token;
            const res = await api.put(`/api/documents/types/${id}`,
                { name: editName, description: editDescription },
                { headers: getAuthHeaders(token) }
            );
            setDocumentTypes(prev => prev.map(t => t.id === id ? res.data : t));
            cancelEditType();
            toast.success('Atualizado com sucesso');
        } catch (error) {
            toast.error('Falha ao atualizar');
        }
    };

    // --- Template Functions ---
    const updateTemplateDocRow = (index: number, field: keyof TemplateDocType, value: string | boolean | number) => {
        const updated = [...newTemplateDocs];
        updated[index] = { ...updated[index], [field]: value };
        setNewTemplateDocs(updated);
    };

    const handleCreateTemplate = async () => {
        if (!newTemplateName.trim()) {
            toast.error('Nome do template é obrigatório');
            return;
        }
        if (newTemplateDocs.some(d => !d.name.trim())) {
            toast.error('Todos os documentos do template devem ter um nome');
            return;
        }
        try {
            setIsCreatingTemplate(true);
            const token = session?.user?.token;

            const payload = {
                name: newTemplateName,
                description: newTemplateDesc,
                documentTypes: newTemplateDocs.map((d, i) => ({ ...d, order: i }))
            };

            const res = await api.post('/api/templates', payload, {
                headers: getAuthHeaders(token)
            });

            // Res payload expects to append to templates with manual count or re-fetch
            const newTpl: Template = {
                ...res.data,
                documentTypeCount: res.data.documentTypes?.length || 0
            };

            setTemplates(prev => [...prev, newTpl]);
            setNewTemplateName('');
            setNewTemplateDesc('');
            setNewTemplateDocs([]);
            toast.success('Template criado com sucesso');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Falha ao criar template');
        } finally {
            setIsCreatingTemplate(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('Tem certeza? Projetos que usam este template podem continuar funcionando, mas ele será removido desta lista.')) return;
        try {
            const token = session?.user?.token;
            await api.delete(`/api/templates/${id}`, {
                headers: getAuthHeaders(token)
            });
            setTemplates(prev => prev.filter(t => t.id !== id));
            toast.success('Removido com sucesso');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Falha ao remover template');
        }
    };

    const handleDuplicateTemplate = async (id: string) => {
        try {
            const token = session?.user?.token;
            const res = await api.post(`/api/templates/${id}/duplicate`, {}, {
                headers: getAuthHeaders(token)
            });

            const newTpl: Template = {
                ...res.data,
                documentTypeCount: res.data.documentTypes?.length || 0
            };

            setTemplates(prev => [...prev, newTpl]);
            toast.success('Template duplicado com sucesso');
        } catch (error: any) {
            toast.error('Falha ao duplicar template');
        }
    };

    const handleLogout = async () => {
        await performLogout();
        router.push('/');
    };

    const userName = session?.user?.name || 'User';
    const userInitials = userName.substring(0, 2).toUpperCase();

    if (loading) {
        return (
            <div className={styles.loadingScreen}>
                <Loader2 className="animate-spin" size={32} style={{ color: '#f59e0b' }} />
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
                            <h2 className={styles.sectionTitle}>Gestão de Documentos</h2>
                            <p className={styles.sectionSubtitle}>Gerencie os tipos de documentos globais e os templates de projetos.</p>
                        </div>
                    </header>

                    <div className={styles.tabsContainer}>
                        <button
                            className={`${styles.tabBtn} ${activeTab === 'types' ? styles.active : ''}`}
                            onClick={() => setActiveTab('types')}
                        >
                            Tipos de Documento
                        </button>
                        <button
                            className={`${styles.tabBtn} ${activeTab === 'templates' ? styles.active : ''}`}
                            onClick={() => setActiveTab('templates')}
                        >
                            Templates de Projeto
                        </button>
                    </div>

                    {activeTab === 'types' && (
                        <>
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
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateType()}
                                        />
                                    </div>
                                    <div>
                                        <button
                                            onClick={handleCreateType}
                                            disabled={isCreatingType}
                                            className={styles.addBtn}
                                        >
                                            {isCreatingType ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
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
                                                                <button onClick={cancelEditType} className={styles.cancelBtn}>
                                                                    Cancelar
                                                                </button>
                                                                <button onClick={() => saveEditType(doc.id)} className={styles.saveBtn}>
                                                                    Salvar
                                                                </button>
                                                            </div>
                                                        ) : !doc.isDefault ? (
                                                            <>
                                                                <button onClick={() => startEditType(doc)} className={styles.actionBtn} title="Editar">
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button onClick={() => handleDeleteType(doc.id)} className={`${styles.actionBtn} ${styles.danger}`} title="Remover">
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
                        </>
                    )}

                    {activeTab === 'templates' && (
                        <>
                            {/* Novo Template Card */}
                            <section className={styles.createSection}>
                                <div className={styles.createHeader}>
                                    <div className={styles.createIconWrapper}>
                                        <Copy size={20} />
                                    </div>
                                    <div>
                                        <h3 className={styles.createTitle}>Novo Template de Projeto</h3>
                                    </div>
                                </div>

                                <div className={styles.createForm}>
                                    <div className={`${styles.fieldGroup} ${styles.nameField}`}>
                                        <label className={styles.fieldLabel}>Nome do Template</label>
                                        <input
                                            className={styles.fieldInput}
                                            placeholder="Ex: Onboarding PJ..."
                                            value={newTemplateName}
                                            onChange={(e) => setNewTemplateName(e.target.value)}
                                        />
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Descrição</label>
                                        <input
                                            className={styles.fieldInput}
                                            placeholder="Descreva o uso deste template"
                                            value={newTemplateDesc}
                                            onChange={(e) => setNewTemplateDesc(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className={styles.templateDocsList}>
                                    <label className={`${styles.fieldLabel} ${styles.templateSectionLabel}`}>
                                        Selecione os Documentos para este Template
                                    </label>

                                    <div className={styles.templateTableSearch}>
                                        <Search size={16} className={styles.searchIcon} />
                                        <input
                                            placeholder="Buscar documentos cadastrados..."
                                            value={templateDocSearch}
                                            onChange={(e) => setTemplateDocSearch(e.target.value)}
                                        />
                                    </div>

                                    <div className={styles.templateTableWrapper}>
                                        {documentTypes
                                            .filter(doc => doc.name.toLowerCase().includes(templateDocSearch.toLowerCase()))
                                            .map((doc) => {
                                                const selectedDocIndex = newTemplateDocs.findIndex(d => d.name === doc.name);
                                                const isSelected = selectedDocIndex !== -1;

                                                return (
                                                    <div key={doc.id} className={`${styles.templateDocRow} ${isSelected ? styles.selected : ''}`}>
                                                        <label className={`${styles.reqToggle} ${styles.templateDocLabel}`}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setNewTemplateDocs([...newTemplateDocs, { name: doc.name, isRequired: true, order: newTemplateDocs.length }]);
                                                                    } else {
                                                                        setNewTemplateDocs(newTemplateDocs.filter(d => d.name !== doc.name));
                                                                    }
                                                                }}
                                                            />
                                                            {doc.name} {doc.description ? <span className={styles.templateDocDescription}>({doc.description})</span> : ''}
                                                        </label>

                                                        {isSelected && (
                                                            <label className={styles.reqToggle}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={newTemplateDocs[selectedDocIndex]?.isRequired ?? true}
                                                                    onChange={(e) => updateTemplateDocRow(selectedDocIndex, 'isRequired', e.target.checked)}
                                                                />
                                                                Obrigatório
                                                            </label>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        {documentTypes.filter(doc => doc.name.toLowerCase().includes(templateDocSearch.toLowerCase())).length === 0 && (
                                            <div className={styles.templateDocEmpty}>
                                                Nenhum documento encontrado.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className={styles.templateSubmitRow}>
                                    <button
                                        onClick={handleCreateTemplate}
                                        disabled={isCreatingTemplate || !newTemplateName.trim()}
                                        className={`${styles.addBtn} ${styles.templateSubmitBtn}`}
                                    >
                                        {isCreatingTemplate ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                        Salvar Template
                                    </button>
                                </div>
                            </section>

                            {/* Lista de Templates */}
                            <section>
                                {templates.length === 0 ? (
                                    <div className={styles.emptyState}>
                                        <p className={styles.emptyText}>Nenhum template cadastrado ainda.</p>
                                    </div>
                                ) : (
                                    <div className={styles.docGrid}>
                                        {templates.map(tpl => (
                                            <div key={tpl.id} className={styles.docCard}>
                                                <div className={styles.docCardContent}>
                                                    <div className={styles.docCardHeader}>
                                                        <div className={`${styles.docIconWrapper} ${styles.templateIcon}`}>
                                                            <Copy size={20} />
                                                        </div>
                                                        {tpl.isDefault && (
                                                            <span className={styles.systemBadge}>Default</span>
                                                        )}
                                                    </div>
                                                    <h3 className={styles.docName} title={tpl.name}>
                                                        {tpl.name}
                                                    </h3>
                                                    <p className={styles.docDescription} title={tpl.description || ''}>
                                                        {tpl.description || <span className={styles.italic}>Sem descrição</span>}
                                                    </p>
                                                    <div className={styles.templateCount}>
                                                        {tpl.documentTypeCount} documento(s) inclusos
                                                    </div>
                                                </div>

                                                <div className={styles.cardFooter}>
                                                    {!tpl.isDefault ? (
                                                        <>
                                                            <button onClick={() => handleDuplicateTemplate(tpl.id)} className={styles.actionBtn} title="Duplicar">
                                                                <Copy size={16} />
                                                            </button>
                                                            <button onClick={() => handleDeleteTemplate(tpl.id)} className={`${styles.actionBtn} ${styles.danger}`} title="Remover">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className={styles.readOnlyText}>Não editável</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                </div>
            </main>
        </div>
    );
}
