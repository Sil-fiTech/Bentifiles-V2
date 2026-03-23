'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '@/lib/api';
import axios from 'axios';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { UploadCloud, File as FileIcon, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { Nav } from '@/components/Nav';

export default function Dashboard() {
    const [files, setFiles] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
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
        fetchFiles(activeToken as string);
    }, [status, session]);

    const fetchFiles = async (token: string) => {
        try {
            const res = await api.get('/api/files', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFiles(res.data.files || res.data);
        } catch (error) {
            toast.error('Failed to fetch files');
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                handleLogout();
            }
        }
    };

    const handleLogout = async () => {
        localStorage.removeItem('token');
        if (session) {
            await signOut({ redirect: false });
        }
        router.push('/');
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        setUploading(true);
        const token = session?.user?.token || localStorage.getItem('token');

        for (const file of acceptedFiles) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await api.post('/api/files/upload', formData, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                toast.success(`Uploaded ${file.name}`);
                setFiles(prev => [res.data.file, ...prev]);
            } catch (error: any) {
                toast.error(`Failed to upload ${file.name}: ${error.response?.data?.message || 'Error'}`);
            }
        }
        setUploading(false);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/jpeg': ['.jpeg', '.jpg'],
            'image/png': ['.png'],
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        }
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'APPROVED': return <CheckCircle className="text-emerald-500" size={20} />;
            case 'CONDITIONAL': return <AlertTriangle className="text-amber-500" size={20} />;
            case 'REJECTED': return <XCircle className="text-red-500" size={20} />;
            default: return null;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'text-emerald-600 border-emerald-300';
            case 'CONDITIONAL': return 'text-amber-600 border-amber-300';
            case 'REJECTED': return 'text-red-600 border-red-300';
            default: return 'text-zinc-500 border-zinc-200';
        }
    };

    const userName = session?.user?.name || 'User';
    const userInitials = userName.substring(0, 2).toUpperCase();

    return (
        <div className="bg-background font-body text-on-surface antialiased overflow-hidden flex h-screen w-full relative">
            <main className="flex-1 h-screen flex flex-col items-center bg-surface overflow-y-auto relative w-full custom-scrollbar">
                <Nav
                    userInitials={userInitials}
                    onLogout={handleLogout}
                />

                <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 space-y-8 pb-24">
                    <header className="mb-8">
                        <h1 className="text-3xl font-headline font-black text-zinc-900 tracking-tighter">My Documents</h1>
                        <p className="text-sm text-zinc-500 font-medium mt-1">Upload and validate your documents.</p>
                    </header>

                    {/* Dropzone */}
                    <div
                        {...getRootProps()}
                        className={`
                            bg-white border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 shadow-sm
                            ${isDragActive ? 'border-amber-400 bg-amber-50/50' : 'border-zinc-300 hover:border-zinc-400'}
                        `}
                    >
                        <input {...getInputProps()} />
                        <UploadCloud size={48} className={`mx-auto mb-4 ${isDragActive ? 'text-amber-500' : 'text-zinc-400'}`} />
                        {uploading ? (
                            <p className="text-lg font-bold text-zinc-700">Uploading & Validating...</p>
                        ) : isDragActive ? (
                            <p className="text-lg font-bold text-amber-600">Drop files here...</p>
                        ) : (
                            <div>
                                <p className="text-lg font-bold text-zinc-700 mb-2">Drag & drop files here, or click to select</p>
                                <p className="text-sm text-zinc-500">Supports JPG, PNG, PDF, DOCX (Max 10MB)</p>
                            </div>
                        )}
                    </div>

                    {/* Files grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {files.map((file: any) => {
                            const result = file.verificationResults?.[0];
                            return (
                                <div key={file.id} className="bg-white border border-zinc-200/60 rounded-xl shadow-sm p-6 flex flex-col gap-4 transition-all duration-200 hover:shadow-md">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                            <FileIcon size={24} className="text-amber-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-headline font-bold text-zinc-900 truncate" title={file.originalName}>
                                                {file.originalName}
                                            </h3>
                                            <p className="text-xs text-zinc-500 mt-1">
                                                {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    {result && (
                                        <div className={`p-4 bg-zinc-50 rounded-xl border-l-4 ${getStatusColor(result.status)}`}>
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex items-center gap-2 font-bold text-sm">
                                                    {getStatusIcon(result.status)}
                                                    {result.status}
                                                </div>
                                                <div className="text-lg font-black font-headline text-zinc-900">
                                                    {result.score}<span className="text-xs text-zinc-500 font-normal">/100</span>
                                                </div>
                                            </div>

                                            <div className="text-xs text-zinc-600 space-y-1">
                                                {result.recommendation && result.recommendation.split(' | ').map((rec: string, i: number) => (
                                                    <p key={i} className="flex gap-1.5">
                                                        <span className="text-amber-500">•</span> {rec}
                                                    </p>
                                                ))}
                                            </div>

                                            <div className="flex gap-6 mt-4 text-xs text-zinc-500">
                                                <div className="flex flex-col">
                                                    <span>Blur</span>
                                                    <span className="font-bold text-zinc-900">{result.blurScore ? result.blurScore.toFixed(0) : 'N/A'}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span>Brightness</span>
                                                    <span className="font-bold text-zinc-900">{result.brightness ? result.brightness.toFixed(0) : 'N/A'}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span>OCR Text</span>
                                                    <span className="font-bold text-zinc-900">{result.textDetected ? 'Detected' : 'None'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
}
