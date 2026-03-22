'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
    LogOut
} from 'lucide-react';

interface NavProps {
    userInitials: string;
    hasActiveProcessing?: boolean;
    creating?: boolean;
    onCreateProject?: () => void;
    onLogout?: () => void;
    context?: 'dashboard' | 'project';
    projectName?: string;
    className?: string; // Permitir override ou adição de classes base
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

    return (
        <header className={`bg-white/80 backdrop-blur-xl z-40 flex justify-center w-full border-b border-zinc-100/50 ${className || 'sticky top-0'}`}>
            <div className="flex justify-between items-center w-full max-w-7xl px-6 md:px-12 lg:px-16 py-4">
                {/* Left Section - Nav */}
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-400 flex items-center justify-center rounded-md shadow-sm">
                            <LayoutGrid className="text-zinc-900" size={18} />
                        </div>
                        <h1 className="text-xl font-black font-headline text-zinc-900 tracking-tighter">Bentifiles</h1>
                    </div>

                    <nav className="hidden md:flex items-center gap-6">
                        {context === 'dashboard' ? (
                            <>
                                <button
                                    onClick={onCreateProject}
                                    disabled={creating}
                                    className="text-sm font-bold flex items-center gap-2 text-zinc-600 hover:text-amber-500 transition-colors disabled:opacity-50"
                                >
                                    {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Novo Projeto
                                </button>
                                <button className="text-sm font-bold flex items-center gap-2 text-zinc-900 hover:text-amber-500 transition-colors">
                                    <LayoutGrid size={16} /> Projetos
                                </button>
                                <button
                                    onClick={() => router.push('/dashboard/documents')}
                                    className="text-sm font-bold flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors"
                                >
                                    <Folder size={16} /> Tipos de Doc
                                </button>
                            </>
                        ) : (
                            <>
                                <span className="font-headline font-bold tracking-tight text-zinc-900 border-b-2 border-amber-500 pb-1">
                                    {projectName || 'Projeto Atual'}
                                </span>
                                <button onClick={() => router.push('/dashboard/documents')} className="font-headline font-bold tracking-tight text-zinc-500 hover:text-amber-600 transition-colors">
                                    Relatórios
                                </button>
                            </>
                        )}
                    </nav>
                </div>

                {/* Right Section - Search & Actions */}
                <div className="flex items-center gap-4 sm:gap-6 flex-1 justify-end">
                    <div className="relative w-full max-w-[240px] hidden lg:block group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={16} />
                        <input
                            className="w-full bg-zinc-100 border-none focus:ring-1 focus:ring-amber-400 rounded-md py-2 pl-9 pr-4 text-sm font-body outline-none transition-shadow"
                            placeholder="Buscar..."
                            type="text"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="text-zinc-500 hover:text-zinc-900 transition-colors relative">
                            <Bell size={18} />
                            {hasActiveProcessing && <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full border border-white"></span>}
                        </button>
                        <button className="text-zinc-500 hover:text-zinc-900 transition-colors">
                            <Settings size={18} />
                        </button>
                        <div className="h-6 w-[1px] bg-zinc-200"></div>
                        <button
                            onClick={() => router.push('/uploadZone')}
                            className="bg-primary-container text-on-primary-fixed px-5 py-1.5 rounded-md font-['Space_Grotesk'] font-bold text-sm tracking-tight hover:scale-95 transition-transform duration-100"
                        >
                            Upload
                        </button>
                        <div className="relative" ref={profileRef}>
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-2 focus:outline-none ml-1 hover:opacity-80 transition-opacity"
                            >
                                <div className="w-8 h-8 rounded-full bg-zinc-800 text-white flex items-center justify-center font-bold text-xs tracking-widest border-2 border-amber-400">
                                    {userInitials}
                                </div>
                                <ChevronDown size={14} className="text-zinc-500" />
                            </button>

                            {isProfileOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-zinc-100 rounded-lg shadow-xl shadow-zinc-200/50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 select-none z-50">
                                    <button className="w-full text-left px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 transition-colors"
                                        onClick={() => router.push('/profile')}
                                    >
                                        <User size={16} className="text-zinc-400" />
                                        Perfil
                                    </button>
                                    <button className="w-full text-left px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 transition-colors"
                                        onClick={() => router.push('/subscription')}
                                    >
                                        <CreditCard size={16} className="text-zinc-400" />

                                        Assinatura
                                    </button>
                                    <div className="h-px bg-zinc-100 my-1"></div>
                                    <button
                                        onClick={onLogout}
                                        className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                    >
                                        <LogOut size={16} className="text-red-400" />
                                        Sair
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
