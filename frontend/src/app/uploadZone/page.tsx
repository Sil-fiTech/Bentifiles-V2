'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { UploadCloud, File as FileIcon, CheckCircle, AlertTriangle, XCircle, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';

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
            const res = await axios.get('http://localhost:3001/api/files', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFiles(res.data);
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
                const res = await axios.post('http://localhost:3001/api/files/upload', formData, {
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
            case 'APPROVED': return <CheckCircle color="var(--success)" size={20} />;
            case 'CONDITIONAL': return <AlertTriangle color="var(--warning)" size={20} />;
            case 'REJECTED': return <XCircle color="var(--danger)" size={20} />;
            default: return null;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'var(--success)';
            case 'CONDITIONAL': return 'var(--warning)';
            case 'REJECTED': return 'var(--danger)';
            default: return 'var(--text-secondary)';
        }
    }

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>My Documents</h1>
                <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                    <LogOut size={18} /> Logout
                </button>
            </header>

            <div
                {...getRootProps()}
                className="glass-panel"
                style={{
                    padding: '60px 40px',
                    textAlign: 'center',
                    border: `2px dashed ${isDragActive ? 'var(--accent-light)' : 'var(--card-border)'}`,
                    backgroundColor: isDragActive ? 'rgba(139, 92, 246, 0.1)' : 'var(--card-bg)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginBottom: '40px'
                }}
            >
                <input {...getInputProps()} />
                <UploadCloud size={48} color={isDragActive ? 'var(--accent-light)' : 'var(--text-secondary)'} style={{ margin: '0 auto 16px' }} />
                {uploading ? (
                    <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>Uploading & Validating...</p>
                ) : isDragActive ? (
                    <p style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--accent-light)' }}>Drop files here...</p>
                ) : (
                    <div>
                        <p style={{ fontSize: '1.2rem', fontWeight: 500, marginBottom: '8px' }}>Drag & drop files here, or click to select</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Supports JPG, PNG, PDF, DOCX (Max 10MB)</p>
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                {files.map((file: any) => {
                    const result = file.verificationResults?.[0];
                    return (
                        <div key={file.id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                                    <FileIcon size={24} color="var(--accent-light)" />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.originalName}>
                                        {file.originalName}
                                    </h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                                        {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {result && (
                                <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: `4px solid ${getStatusColor(result.status)}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: getStatusColor(result.status) }}>
                                            {getStatusIcon(result.status)}
                                            {result.status}
                                        </div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                                            {result.score}<span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/100</span>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        {result.recommendation && result.recommendation.split(' | ').map((rec: string, i: number) => (
                                            <p key={i} style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                                                <span style={{ color: 'var(--accent-light)' }}>•</span> {rec}
                                            </p>
                                        ))}
                                    </div>

                                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span>Blur</span>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{result.blurScore ? result.blurScore.toFixed(0) : 'N/A'}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span>Brightness</span>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{result.brightness ? result.brightness.toFixed(0) : 'N/A'}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span>OCR Text</span>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{result.textDetected ? 'Detected' : 'None'}</span>
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
