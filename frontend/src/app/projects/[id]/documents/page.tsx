'use client';
import api from '@/lib/api';
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Nav } from '@/components/Nav';
import styles from './page.module.scss';
import { 
    ArrowLeft, Loader2, Check, FileText, Settings, 
    Users, Info, ShieldAlert, Archive, Trash2, X, AlertTriangle 
} from 'lucide-react';

export default function ProjectSettingsPage() {
    const { id } = useParams();
    const router = useRouter();
    const { data: session, status } = useSession();

    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Members
    const [members, setMembers] = useState<any[]>([]);

    // Document Config
    const [globalTypes, setGlobalTypes] = useState<any[]>([]);
    const [requiredDocs, setRequiredDocs] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [docSearchTerm, setDocSearchTerm] = useState('');
    const [templateSearchTerm, setTemplateSearchTerm] = useState('');
    const [showTemplateSuggestions, setShowTemplateSuggestions] = useState(false);

    // Actions Loading UI
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'loading') return;
        const localToken = localStorage.getItem('token');
        const activeToken = session?.user?.token || localToken;
        if (!activeToken) {
            router.push('/');
            return;
        }

        const payload = JSON.parse(atob(activeToken.split('.')[1]));
        setCurrentUser(payload);

        fetchData(activeToken, payload);
    }, [id, status, session]);

    const fetchData = async (token: string, payload: any) => {
        try {
            setLoading(true);
            const headers = { Authorization: `Bearer ${token}` };

            // 1. Get project details
            const projsRes = await api.get(`/api/projects`, { headers });
            const currentProj = projsRes.data.projects.find((p: any) => p.id === id);
            setProject(currentProj);

            // 2. Get members & determine role
            let amIAdmin = false;
            try {
                const membersRes = await api.get(`/api/projects/${id}/members`, { headers });
                // API might return { members: [] } or just [] depending on your backend Implementation
                const membersData = membersRes.data.members || membersRes.data || [];
                setMembers(membersData);
                
                const me = membersData.find(
                    (m: any) => m.userId === payload?.userId
                );
                amIAdmin = me?.permissions?.includes('PROJECT_EDIT') || me?.role === 'ADMIN';
                setIsAdmin(amIAdmin);
            } catch (e) {
                setIsAdmin(false);
            }

            // 3. Admin-only data for configuration
            if (amIAdmin) {
                try {
                    const [reqDocsRes, typesRes, templatesRes] = await Promise.all([
                        api.get(`/api/projects/${id}/required-documents`, { headers }),
                        api.get(`/api/documents/types`, { headers }),
                        api.get(`/api/templates`, { headers })
                    ]);
                    
                    setRequiredDocs(reqDocsRes.data);
                    setGlobalTypes(typesRes.data);
                    setTemplates(templatesRes.data);
                } catch (e) {
                    console.error("Failed to load admin document configuration data", e);
                }
            }
        } catch (error) {
            toast.error('Falha ao carregar configurações do projeto');
        } finally {
            setLoading(false);
        }
    };

    const toggleRequiredDocument = async (docTypeId: string) => {
        if (project?.status === 'ARCHIVED') { toast.error('Projeto arquivado.'); return; }
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

    const handleApplyTemplate = async () => {
        if (project?.status === 'ARCHIVED') { toast.error('Projeto arquivado.'); return; }
        if (!selectedTemplateId) return;
        try {
            setActionLoading('template');
            const token = session?.user?.token || localStorage.getItem('token');
            const res = await api.post(`/api/projects/${id}/apply-template`,
                { templateId: selectedTemplateId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setRequiredDocs(res.data);
            toast.success('Template aplicado com sucesso!');
            setSelectedTemplateId('');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Falha ao aplicar template');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (project?.status === 'ARCHIVED') { toast.error('Projeto arquivado.'); return; }
        if (!confirm('Tem certeza que deseja remover este membro do projeto?')) return;
        try {
            setActionLoading(`remove_${memberId}`);
            const token = session?.user?.token || localStorage.getItem('token');
            await api.delete(`/api/projects/${id}/members/${memberId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMembers(prev => prev.filter(m => m.id !== memberId && m.userId !== memberId));
            toast.success('Membro removido com sucesso');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Falha ao remover membro');
        } finally {
            setActionLoading(null);
        }
    };

    const handleArchiveProject = async () => {
        const isArchived = project?.status === 'ARCHIVED';
        const actionText = isArchived ? 'desarquivar' : 'arquivar';
        if (!confirm(`Tem certeza que deseja ${actionText} este projeto? ${!isArchived ? 'Ele ficará inacessível para documentação ativa.' : 'Ele voltará a ficar ativo para documentação.'}`)) return;
        try {
            setActionLoading(isArchived ? 'unarchive' : 'archive');
            const token = session?.user?.token || localStorage.getItem('token');
            const endpoint = isArchived ? `/api/projects/${id}/unarchive` : `/api/projects/${id}/archive`;
            await api.patch(endpoint, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProject((prev: any) => ({ ...prev, status: isArchived ? 'ACTIVE' : 'ARCHIVED' }));
            toast.success(`Projeto ${isArchived ? 'desarquivado' : 'arquivado'} com sucesso`);
        } catch (error: any) {
            toast.error(error.response?.data?.message || `Falha ao ${actionText} projeto`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteProject = async () => {
        if (!confirm('ATENÇÃO: A exclusão do projeto é irreversível. Deseja continuar?')) return;
        try {
            setActionLoading('delete');
            const token = session?.user?.token || localStorage.getItem('token');
            await api.delete(`/api/projects/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Projeto excluído com sucesso');
            router.push('/dashboard');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Falha ao excluir projeto');
        } finally {
            setActionLoading(null);
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

    const filteredDocs = globalTypes.filter(t => 
        (t?.name || '').toLowerCase().includes(docSearchTerm.toLowerCase()) || 
        (t?.description || '').toLowerCase().includes(docSearchTerm.toLowerCase())
    );

    const filteredTemplates = templates.filter(t => 
        (t?.name || '').toLowerCase().includes(templateSearchTerm.toLowerCase())
    );

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
                        <div className={styles.headerTitleRow}>
                            <div className={styles.headerIconWrapper}>
                                <Settings className={styles.headerIcon} size={28} />
                            </div>
                            <div>
                                <h1 className={styles.title}>Configurações do Projeto</h1>
                                <p className={styles.subtitle}>{project?.name}</p>
                            </div>
                        </div>
                    </header>

                    <div className={styles.layoutGrid}>
                        {/* LEFT COLUMN: Main Configs */}
                        <div className={styles.mainCol}>

                            {/* PROJECT INFO CARD */}
                            <section className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardIcon}><Info size={20} /></div>
                                    <div>
                                        <h2 className={styles.cardTitle}>Informações do Projeto</h2>
                                        <p className={styles.cardDesc}>Detalhes básicos sobre este projeto.</p>
                                    </div>
                                </div>
                                <div className={styles.infoGrid}>
                                    <div className={styles.infoItem}>
                                        <span className={styles.infoLabel}>Nome do Projeto</span>
                                        <span className={styles.infoValue}>{project?.name}</span>
                                    </div>
                                    <div className={styles.infoItem}>
                                        <span className={styles.infoLabel}>Status</span>
                                        <span className={styles.infoValue}>
                                            <span className={`${styles.statusBadge} ${project?.status === 'ARCHIVED' ? styles.statusArchived : styles.statusActive}`}>
                                                {project?.status === 'ARCHIVED' ? 'Arquivado' : 'Ativo'}
                                            </span>
                                        </span>
                                    </div>
                                    <div className={styles.infoItem}>
                                        <span className={styles.infoLabel}>Criado em</span>
                                        <span className={styles.infoValue}>
                                            {project?.createdAt ? new Date(project.createdAt).toLocaleDateString('pt-BR') : 'Desconhecido'}
                                        </span>
                                    </div>
                                    {project?.description && (
                                        <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}>
                                            <span className={styles.infoLabel}>Descrição</span>
                                            <span className={styles.infoValue}>{project?.description}</span>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* DOCUMENTS CONFIG CARD (ADMIN ONLY) */}
                            {isAdmin && (
                                <section className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <div className={styles.cardIcon}><FileText size={20} /></div>
                                        <div>
                                            <h2 className={styles.cardTitle}>Configuração de Documentos</h2>
                                            <p className={styles.cardDesc}>Selecione os documentos exigidos e aplique templates para este projeto.</p>
                                        </div>
                                    </div>
                                    
                                    <div className={styles.templateSection}>
                                        <div className={styles.templateSectionHeader}>
                                            <h3 className={styles.templateSectionTitle}>
                                                <FileText size={18} />
                                                Aplicar Template
                                            </h3>
                                            <p className={styles.templateSectionDesc}>
                                                Adicione um conjunto pré-definido de documentos. Documentos já existentes não serão duplicados.
                                            </p>
                                        </div>
                                        <div className={styles.templateSectionForm}>
                                            <div className={styles.searchWrapper}>
                                                <input 
                                                    type="text" 
                                                    placeholder="Buscar templates..." 
                                                    value={templateSearchTerm}
                                                    onChange={(e) => {
                                                        setTemplateSearchTerm(e.target.value);
                                                        setShowTemplateSuggestions(true);
                                                    }}
                                                    onFocus={() => setShowTemplateSuggestions(true)}
                                                    onBlur={() => setTimeout(() => setShowTemplateSuggestions(false), 200)}
                                                    className={styles.searchInput}
                                                />
                                                {showTemplateSuggestions && templateSearchTerm && filteredTemplates.length > 0 && (
                                                    <ul className={styles.suggestionsList}>
                                                        {filteredTemplates.map(t => (
                                                            <li 
                                                                key={t.id} 
                                                                className={styles.suggestionItem}
                                                                onClick={() => {
                                                                    setSelectedTemplateId(t.id);
                                                                    setTemplateSearchTerm(''); // Limpa a busca pra ficar clean
                                                                    setShowTemplateSuggestions(false);
                                                                }}
                                                            >
                                                                {t.name}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {showTemplateSuggestions && templateSearchTerm && filteredTemplates.length === 0 && (
                                                    <div className={styles.suggestionsList}>
                                                        <div className={styles.emptySuggestionItem}>Nenhum template encontrado</div>
                                                    </div>
                                                )}
                                            </div>
                                            <select 
                                                value={selectedTemplateId} 
                                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                                                className={styles.templateSelect}
                                                disabled={actionLoading === 'template' || project?.status === 'ARCHIVED'}
                                            >
                                                <option value="">Selecione um template disponível...</option>
                                                {templates.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                            <button 
                                                onClick={handleApplyTemplate}
                                                disabled={!selectedTemplateId || actionLoading === 'template' || project?.status === 'ARCHIVED'}
                                                className={styles.templateApplyBtn}
                                            >
                                                {actionLoading === 'template' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} 
                                                Aplicar
                                            </button>
                                        </div>
                                    </div>

                                    <div className={styles.configList}>
                                        <div className={styles.configListHeader}>
                                            <h3 className={styles.configListTitle}>Tipos de Documento Globais</h3>
                                            <input 
                                                type="text" 
                                                placeholder="Buscar documentos..." 
                                                value={docSearchTerm}
                                                onChange={(e) => setDocSearchTerm(e.target.value)}
                                                className={styles.searchInput}
                                            />
                                        </div>
                                        
                                        <div className={styles.tableWrapper}>
                                            <table className={styles.dataTable}>
                                                <thead>
                                                    <tr>
                                                        <th className={styles.tableThCheckbox}>Exigir</th>
                                                        <th className={styles.tableTh}>Nome do Documento</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredDocs.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={2} className={styles.emptyStateContainer}>
                                                                <p className={styles.emptyState}>Nenhum tipo de documento encontrado.</p>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredDocs.map(type => {
                                                            const isRequired = requiredDocs.some(rd => rd.documentTypeId === type.id);
                                                            return (
                                                                <tr key={type.id} className={styles.tableRow} onClick={() => toggleRequiredDocument(type.id)}>
                                                                    <td className={styles.tableTdCheckbox}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isRequired}
                                                                            onChange={() => toggleRequiredDocument(type.id)}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className={styles.checkboxInput}
                                                                            disabled={project?.status === 'ARCHIVED'}
                                                                        />
                                                                    </td>
                                                                    <td className={styles.tableTd}>
                                                                        <div className={styles.checkboxText}>
                                                                            <span className={styles.checkboxTitleRow}>
                                                                                <span className={styles.checkboxName}>{type.name}</span>
                                                                                {type.isDefault && (
                                                                                    <span className={styles.systemBadge}>Sistema</span>
                                                                                )}
                                                                            </span>
                                                                            {type.description && <p className={styles.checkboxDesc}>{type.description}</p>}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Secondary & Danger Configs */}
                        <div className={styles.sideCol}>
                            
                            {/* MEMBERS CARD */}
                            <section className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardIcon}><Users size={20} /></div>
                                    <div>
                                        <h2 className={styles.cardTitle}>Membros do Projeto</h2>
                                        <p className={styles.cardDesc}>Pessoas com acesso a este projeto.</p>
                                    </div>
                                </div>
                                <div className={styles.memberList}>
                                    {members.length === 0 ? (
                                        <p className={styles.emptyState}>Nenhum membro encontrado.</p>
                                    ) : (
                                        members.map((member: any) => {
                                            const mId = member.userId || member.id;
                                            const uName = member.user?.name || member.name || 'Usuário Indefinido';
                                            const uEmail = member.user?.email || member.email || '';
                                            const uRole = member.role || 'MEMBER';
                                            const isMe = mId === currentUser?.userId;

                                            return (
                                                <div key={mId} className={styles.memberItem}>
                                                    <div className={styles.memberAvatar}>
                                                        {uName.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className={styles.memberInfo}>
                                                        <span className={styles.memberName}>
                                                            {uName} {isMe && <span className={styles.meBadge}>(Você)</span>}
                                                        </span>
                                                        <span className={styles.memberEmail}>{uEmail}</span>
                                                    </div>
                                                    <div className={styles.memberActions}>
                                                        <span className={`${styles.roleBadge} ${uRole === 'ADMIN' ? styles.roleAdmin : styles.roleMember}`}>
                                                            {uRole}
                                                        </span>
                                                        {isAdmin && !isMe && project?.status !== 'ARCHIVED' && (
                                                            <button 
                                                                onClick={() => handleRemoveMember(mId)} 
                                                                className={styles.removeMemberBtn}
                                                                disabled={actionLoading === `remove_${mId}`}
                                                                title="Remover membro do projeto"
                                                            >
                                                                {actionLoading === `remove_${mId}` ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </section>

                            {/* DANGER ZONE (ADMIN ONLY) */}
                            {isAdmin && (
                                <section className={`${styles.card} ${styles.dangerZone}`}>
                                    <div className={styles.cardHeader}>
                                        <div className={`${styles.cardIcon} ${styles.dangerIcon}`}><ShieldAlert size={20} /></div>
                                        <div>
                                            <h2 className={`${styles.cardTitle} ${styles.dangerTitle}`}>Zona de Perigo</h2>
                                            <p className={styles.dangerDesc}>Ações críticas de administração.</p>
                                        </div>
                                    </div>
                                    <div className={styles.dangerActions}>
                                        <div className={styles.dangerItem}>
                                            <div className={styles.dangerItemInfo}>
                                                <strong>{project?.status === 'ARCHIVED' ? 'Desarquivar Projeto' : 'Arquivar Projeto'}</strong>
                                                <p>{project?.status === 'ARCHIVED' ? 'O projeto voltará a aceitar novos documentos e alterações.' : 'O projeto ficará como "somente leitura" para os usuários normais.'}</p>
                                            </div>
                                            <button 
                                                onClick={handleArchiveProject} 
                                                className={`${styles.dangerBtn} ${styles.btnArchive}`}
                                                disabled={actionLoading === 'archive' || actionLoading === 'unarchive'}
                                            >
                                                {actionLoading === 'archive' || actionLoading === 'unarchive' ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
                                                {project?.status === 'ARCHIVED' ? 'Desarquivar' : 'Arquivar'}
                                            </button>
                                        </div>
                                        
                                        <div className={styles.dangerLine} />

                                        <div className={styles.dangerItem}>
                                            <div className={styles.dangerItemInfo}>
                                                <strong>Excluir Projeto</strong>
                                                <p>Apaga permanentemente o projeto e todos os seus dados. Esta ação é irreversível.</p>
                                            </div>
                                            <button 
                                                onClick={handleDeleteProject} 
                                                className={`${styles.dangerBtn} ${styles.btnDelete}`}
                                                disabled={actionLoading === 'delete'}
                                            >
                                                {actionLoading === 'delete' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                Excluir
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            )}

                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
