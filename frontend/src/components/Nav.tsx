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
    Lightbulb,
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
import GuidedTour from './tour/GuidedTour';
import { TOURS, type TourId } from './tour/tours';
import { useTourSeen } from './tour/useTourSeen';
import styles from './Nav.module.scss';

interface NavProps {
    userInitials?: string;
    creating?: boolean;
    onCreateProject?: () => void;
    onLogout?: () => void;
    context?: 'dashboard' | 'project';
    projectName?: string;
    className?: string;
    /** Quando informado, exibe a lâmpada que abre o guia da página. */
    tourId?: TourId;
}

export function Nav({
    userInitials,
    creating = false,
    onCreateProject,
    onLogout,
    context = 'dashboard',
    projectName,
    className,
    tourId
}: NavProps) {
    const router = useRouter();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [navUserName, setNavUserName] = useState('');
    const [navSystemRole, setNavSystemRole] = useState<string | null>(null);
    const [tourOpen, setTourOpen] = useState(false);
    const [tourSeen, markTourSeen] = useTourSeen(tourId);
    const profileRef = useRef<HTMLDivElement>(null);
    const tourBtnRef = useRef<HTMLButtonElement>(null);
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

    // A lâmpada pulsa até o guia ser aberto uma vez; ele nunca abre sozinho.
    const openTour = () => {
        setIsMobileMenuOpen(false);
        setIsProfileOpen(false);
        setTourOpen(true);
        markTourSeen();
    };

    // Devolve o foco à lâmpada: nem todo navegador foca o botão ao clicar (ex.: Safari).
    const closeTour = () => {
        setTourOpen(false);
        tourBtnRef.current?.focus();
    };

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
                                src="/brand/bentifiles-mark.png"
                                alt="Bentifiles"
                                width={164}
                                height={164}
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
                                    data-tour="new-project"
                                >
                                    {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    Novo Projeto
                                </button>

                                <button
                                    onClick={() => router.push('/dashboard/documents')}
                                    className={styles.navBtn}
                                    data-tour="templates"
                                >
                                    <Folder size={16} /> Tipos & Templates
                                </button>
                            </>
                        ) : (
                            <>

                                <span className={styles.projectName} aria-current="page">
                                    <span className={styles.projectLabel}>Projeto</span>
                                    {projectName || 'Projeto Atual'}
                                </span>

                                <button
                                    onClick={() => router.push('/dashboard/documents')}
                                    className={styles.navBtn}
                                    data-tour="templates"
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
                    {tourId && (
                        <button
                            ref={tourBtnRef}
                            type="button"
                            className={`${styles.iconBtn} ${styles.tourBtn}`}
                            onClick={openTour}
                            aria-label="Abrir guia da plataforma"
                            aria-haspopup="dialog"
                            title="Guia da plataforma"
                        >
                            <Lightbulb size={18} />
                            {!tourSeen && <span className={styles.tourHint} />}
                        </button>
                    )}

                    <div className={styles.actions}>
                        <div className={styles.profileWrapper} ref={profileRef} data-tour="profile">
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

            {tourId && (
                <GuidedTour steps={TOURS[tourId]} open={tourOpen} onClose={closeTour} />
            )}
        </header>
    );
}
