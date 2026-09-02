'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';
import { useSession } from 'next-auth/react';
import { performLogout } from '@/lib/authClient';
import {
    LayoutGrid,
    Folder,
    Search,
    Bell,
    Plus,
    Loader2,
    ChevronDown,
    User,
    CreditCard,
    Gift,
    Shield,
    LogOut,
    Menu,
    X
} from 'lucide-react';
import styles from './Nav.module.scss';

interface NavProps {
    userInitials?: string;
    hasActiveProcessing?: boolean;
    creating?: boolean;
    onCreateProject?: () => void;
    onLogout?: () => void;
    context?: 'dashboard' | 'project';
    projectName?: string;
    className?: string;
}

export function Nav({
    userInitials,
    hasActiveProcessing = false,
    creating = false,
    onCreateProject,
    onLogout,
    context = 'dashboard',
    projectName,
    className
}: NavProps) {
    const router = useRouter();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [navUserName, setNavUserName] = useState('');
    const [navSystemRole, setNavSystemRole] = useState<string | null>(null);
    const profileRef = useRef<HTMLDivElement>(null);
    const { data: session, status: sessionStatus } = useSession();
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isSticky = !className;

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const activeToken = session?.user?.token;
                const profileRes = await api.get('/api/users/me', {
                    headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : undefined,
                });
                if (profileRes.data?.name) {
                    setNavUserName(profileRes.data.name);
                }
                if (profileRes.data?.systemRole) {
                    setNavSystemRole(profileRes.data.systemRole);
                }
            } catch (error) {
                console.error('Failed to fetch profile in Nav', error);
            }
        };
        fetchProfile();
    }, [session?.user?.token]);

    const handleLogout = async () => {
        if (onLogout) {
            onLogout();
            return;
        }

        await performLogout();
        router.push('/');
    };

    // Determinar as iniciais dando preferência à API, depois à sessão, depois às props e finalmente 'US'
    const nameToUse = navUserName || session?.user?.name;
    const systemRoleToUse = navSystemRole || session?.user?.systemRole || null;
    const isSuperAdmin = systemRoleToUse === 'SUPER_ADMIN';
    const finalInitials = nameToUse ? nameToUse.substring(0, 2).toUpperCase() : (userInitials || 'US');
    return (
        <header className={`${styles.header} ${isSticky ? styles.sticky : ''} ${className || ''}`}>
            <div className={styles.inner}>
                {/* Left Section */}
                <div className={styles.left}>
                    <div className={styles.logoGroup}>
                        <div className={styles.logoIcon}>
                            <Image
                                src="/favicon.ico"
                                alt="Logo"
                                width={48}
                                height={48}
                                onClick={() => router.push('/dashboard')}
                                className={styles.logoImg}
                            />
                        </div>
                        <h1 className={styles.logoTitle}>Bentifiles</h1>
                    </div>

                    <nav className={styles.nav}>
                        <button
                            className={styles.navBtn}
                            onClick={() => router.push('/dashboard')}
                        >
                            <LayoutGrid size={16} /> Dashboard
                        </button>
                        {context === 'dashboard' ? (
                            <>
                                <button
                                    onClick={onCreateProject}
                                    disabled={creating}
                                    className={styles.navBtn}
                                >
                                    {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    Novo Projeto
                                </button>

                                <button
                                    onClick={() => router.push('/dashboard/documents')}
                                    className={styles.navBtn}
                                >
                                    <Folder size={16} /> Tipos & Templates
                                </button>
                            </>
                        ) : (
                            <>

                                <span className={styles.projectName}>
                                    {projectName || 'Projeto Atual'}
                                </span>

                                <button
                                    onClick={() => router.push('/dashboard/documents')}
                                    className={styles.navBtn}
                                >
                                    <Folder size={16} /> Tipos & Templates
                                </button>
                                {/*  <button
                                    onClick={() => router.push('/dashboard/documents')}
                                    className={styles.navBtn}
                                >
                                    Relatórios
                                </button> */}
                            </>
                        )}
                        <button
                            className={styles.navBtn}
                            onClick={() => router.push('/afiliado')}
                            title="Programa de afiliados"
                        >
                            <Gift size={16} /> Afiliados
                        </button>
                        {isSuperAdmin && (
                            <button
                                className={styles.navBtn}
                                onClick={() => router.push('/admin/users')}
                                title="Administração do sistema"
                            >
                                <Shield size={16} /> Admin
                            </button>
                        )}
                    </nav>
                </div>

                {/* Right Section */}
                <div className={styles.right}>
                    <div className={styles.searchWrapper}>
                        <Search className={styles.searchIcon} size={16} />
                        <input
                            className={styles.searchInput}
                            placeholder="Buscar..."
                            type="text"
                        />
                    </div>

                    <div className={styles.actions}>
                        <button className={styles.iconBtn}>
                            <Bell size={18} />
                            {hasActiveProcessing && <span className={styles.notifDot} />}
                        </button>

                        <div className={styles.divider} />

                        <div className={styles.profileWrapper} ref={profileRef}>
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className={styles.profileBtn}
                            >
                                <div className={styles.avatar}>{finalInitials}</div>
                                <ChevronDown size={14} className={styles.chevron} />
                            </button>

                            {isProfileOpen && (
                                <div className={styles.dropdown}>
                                    <button
                                        className={styles.dropdownItem}
                                        onClick={() => router.push('/profile')}
                                    >
                                        <User size={16} />
                                        Perfil
                                    </button>
                                    <button
                                        className={styles.dropdownItem}
                                        onClick={() => router.push('/subscription')}
                                    >
                                        <CreditCard size={16} />
                                        Assinatura
                                    </button>
                                    <button
                                        className={styles.dropdownItem}
                                        onClick={() => router.push('/afiliado')}
                                    >
                                        <Gift size={16} />
                                        Afiliados
                                    </button>
                                    <div className={styles.dropdownDivider} />
                                    <button
                                        onClick={() => void handleLogout()}
                                        className={styles.dropdownItemDanger}
                                    >
                                        <LogOut size={16} />
                                        Sair
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        className={styles.mobileMenuToggle}
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMobileMenuOpen && (
                <div className={styles.mobileMenu}>
                    <nav className={styles.mobileNav}>
                        {context === 'dashboard' ? (
                            <>
                                <button
                                    className={styles.mobileNavBtn}
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        router.push('/dashboard');
                                    }}
                                >
                                    <LayoutGrid size={16} /> Dashboard
                                </button>
                                <button
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        if (onCreateProject) onCreateProject();
                                    }}
                                    disabled={creating}
                                    className={styles.mobileNavBtn}
                                >
                                    {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    Novo Projeto
                                </button>

                                <button
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        router.push('/dashboard/documents');
                                    }}
                                    className={styles.mobileNavBtn}
                                >
                                    <Folder size={16} /> Tipos & Templates
                                </button>

                                {isSuperAdmin && (
                                    <button
                                        className={styles.mobileNavBtn}
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            router.push('/admin/users');
                                        }}
                                    >
                                        <Shield size={16} /> Admin
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <button
                                    className={styles.mobileNavBtn}
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        router.push('/dashboard');
                                    }}
                                >
                                    <LayoutGrid size={16} /> Dashboard
                                </button>
                                <span className={styles.projectName} style={{ padding: '0.25rem 1rem' }}>
                                    {projectName || 'Projeto Atual'}
                                </span>

                                <button
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        router.push('/dashboard/documents');
                                    }}
                                    className={styles.mobileNavBtn}
                                >
                                    <Folder size={16} /> Tipos & Templates
                                </button>

                                {isSuperAdmin && (
                                    <button
                                        className={styles.mobileNavBtn}
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            router.push('/admin/users');
                                        }}
                                    >
                                        <Shield size={16} /> Admin
                                    </button>
                                )}
                            </>
                        )}

                        <div className={styles.mobileDivider} />

                        <div className={styles.mobileSearchWrapper}>
                            <Search className={styles.searchIcon} size={16} />
                            <input
                                className={styles.searchInput}
                                placeholder="Buscar..."
                                type="text"
                            />
                        </div>

                        <div className={styles.mobileDivider} />

                        <button
                            className={styles.mobileNavBtn}
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            <Bell size={16} /> Notificações
                            {hasActiveProcessing && (
                                <span className={styles.mobileNotifDot} />
                            )}
                        </button>

                        <button
                            className={styles.mobileNavBtn}
                            onClick={() => {
                                setIsMobileMenuOpen(false);
                                router.push('/profile');
                            }}
                        >
                            <User size={16} /> Perfil
                        </button>

                        <button
                            className={styles.mobileNavBtn}
                            onClick={() => {
                                setIsMobileMenuOpen(false);
                                router.push('/subscription');
                            }}
                        >
                            <CreditCard size={16} /> Assinatura
                        </button>

                        <button
                            className={styles.mobileNavBtn}
                            onClick={() => {
                                setIsMobileMenuOpen(false);
                                router.push('/afiliado');
                            }}
                        >
                            <Gift size={16} /> Afiliados
                        </button>

                        <button
                            onClick={() => {
                                setIsMobileMenuOpen(false);
                                void handleLogout();
                            }}
                            className={styles.mobileNavBtnDanger}
                        >
                            <LogOut size={16} /> Sair
                        </button>
                    </nav>
                </div>
            )}
        </header>
    );
}
