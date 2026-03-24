'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
    LayoutGrid,
    Folder,
    Search,
    Bell,
    Settings,
    Plus,
    Loader2,
    ChevronDown,
    User,
    CreditCard,
    LogOut,
    Menu,
    X
} from 'lucide-react';
import styles from './Nav.module.scss';

interface NavProps {
    userInitials: string;
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
    const profileRef = useRef<HTMLDivElement>(null);

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
                                    <Folder size={16} /> Tipos de Doc
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
                                    <Folder size={16} /> Tipos de Doc
                                </button>
                                {/*  <button
                                    onClick={() => router.push('/dashboard/documents')}
                                    className={styles.navBtn}
                                >
                                    Relatórios
                                </button> */}
                            </>
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
                                <div className={styles.avatar}>{userInitials}</div>
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
                                    <div className={styles.dropdownDivider} />
                                    <button
                                        onClick={onLogout}
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
                                    onClick={() => {
                                        if (onCreateProject) onCreateProject();
                                        setIsMobileMenuOpen(false);
                                    }}
                                    disabled={creating}
                                    className={styles.mobileNavBtn}
                                >
                                    {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    Novo Projeto
                                </button>
                                <button
                                    onClick={() => {
                                        router.push('/dashboard/documents');
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className={styles.mobileNavBtn}
                                >
                                    <Folder size={16} /> Tipos de Doc
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    className={styles.mobileNavBtn}
                                    onClick={() => {
                                        router.push('/dashboard');
                                        setIsMobileMenuOpen(false);
                                    }}
                                >
                                    <LayoutGrid size={16} /> Dashboard
                                </button>
                                <button
                                    onClick={() => {
                                        router.push('/dashboard/documents');
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className={styles.mobileNavBtn}
                                >
                                    <Folder size={16} /> Tipos de Doc
                                </button>
                            </>
                        )}

                        <div className={styles.mobileSearchWrapper}>
                            <Search className={styles.searchIcon} size={16} />
                            <input
                                className={styles.searchInput}
                                placeholder="Buscar..."
                                type="text"
                            />
                        </div>
                    </nav>
                </div>
            )}
        </header>
    );
}
