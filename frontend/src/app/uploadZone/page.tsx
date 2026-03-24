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
import styles from './page.module.scss';

export default function UploadZonePage() {
    const [files, setFiles] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const router = useRouter();
    const { data: session, status } = useSession();

    useEffect(() => {
        if (status === 'loading') return;
        const localToken = localStorage.getItem('token');
        const activeToken = session?.user?.token || localToken;
        if (!activeToken) { router.push('/'); return; }
        fetchFiles(activeToken as string);
    }, [status, session]);

    const fetchFiles = async (token: string) => {
        try {
            const res = await api.get('/api/files', { headers: { Authorization: `Bearer ${token}` } });
            setFiles(res.data.files || res.data);
        } catch (error) {
            toast.error('Failed to fetch files');
            if (axios.isAxiosError(error) && error.response?.status === 401) handleLogout();
        }
    };

    const handleLogout = async () => {
        localStorage.removeItem('token');
        if (session) await signOut({ redirect: false });
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
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
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
            case 'APPROVED':    return <CheckCircle style={{ color: '#10b981' }} size={20} />;
            case 'CONDITIONAL': return <AlertTriangle style={{ color: '#f59e0b' }} size={20} />;
            case 'REJECTED':    return <XCircle style={{ color: '#ef4444' }} size={20} />;
            default:            return null;
        }
    };

    const getResultPanelClass = (status: string) => {
        switch (status) {
            case 'APPROVED':    return `${styles.resultPanel} ${styles.approved}`;
            case 'CONDITIONAL': return `${styles.resultPanel} ${styles.conditional}`;
            case 'REJECTED':    return `${styles.resultPanel} ${styles.rejected}`;
            default:            return `${styles.resultPanel} ${styles.default}`;
        }
    };

    const userName = session?.user?.name || 'User';
    const userInitials = userName.substring(0, 2).toUpperCase();

    return (
        <div className={styles.root}>
            <main className={styles.main}>
                <Nav userInitials={userInitials} onLogout={handleLogout} />

                <div className={styles.canvas}>
                    <header className={styles.pageHeader}>
                        <h1 className={styles.pageTitle}>My Documents</h1>
                        <p className={styles.pageSubtitle}>Upload and validate your documents.</p>
                    </header>

                    {/* Dropzone */}
                    <div
                        {...getRootProps()}
                        className={`${styles.dropzone} ${isDragActive ? styles.active : ''}`}
                        style={{ marginBottom: '1.5rem' }}
                    >
                        <input {...getInputProps()} />
                        <UploadCloud size={48} style={{ margin: '0 auto 1rem', color: isDragActive ? '#f59e0b' : '#a1a1aa', display: 'block' }} />
                        {uploading ? (
                            <p className={styles.dropzoneTitle}>Uploading &amp; Validating...</p>
                        ) : isDragActive ? (
                            <p className={`${styles.dropzoneTitle} ${styles.active}`}>Drop files here...</p>
                        ) : (
                            <div>
                                <p className={styles.dropzoneTitle}>Drag &amp; drop files here, or click to select</p>
                                <p className={styles.dropzoneSubtitle}>Supports JPG, PNG, PDF, DOCX (Max 10MB)</p>
                            </div>
                        )}
                    </div>

                    {/* Files grid */}
                    <div className={styles.fileGrid}>
                        {files.map((file: any) => {
                            const result = file.verificationResults?.[0];
                            return (
                                <div key={file.id} className={styles.fileCard}>
                                    <div className={styles.fileCardTop}>
                                        <div className={styles.fileIconWrapper}>
                                            <FileIcon size={24} style={{ color: '#f59e0b' }} />
                                        </div>
                                        <div className={styles.fileCardInfo}>
                                            <h3 className={styles.fileName} title={file.originalName}>
                                                {file.originalName}
                                            </h3>
                                            <p className={styles.fileMeta}>
                                                {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    {result && (
                                        <div className={getResultPanelClass(result.status)}>
                                            <div className={styles.resultHeader}>
                                                <div className={styles.resultStatus}>
                                                    {getStatusIcon(result.status)}
                                                    {result.status}
                                                </div>
                                                <div className={styles.resultScore}>
                                                    {result.score}<span className={styles.resultScoreUnit}>/100</span>
                                                </div>
                                            </div>

                                            <div className={styles.resultRecs}>
                                                {result.recommendation && result.recommendation.split(' | ').map((rec: string, i: number) => (
                                                    <p key={i} className={styles.resultRec}>
                                                        <span className={styles.resultRecDot}>•</span> {rec}
                                                    </p>
                                                ))}
                                            </div>

                                            <div className={styles.resultMetrics}>
                                                <div className={styles.resultMetricItem}>
                                                    <span>Blur</span>
                                                    <span className={styles.resultMetricValue}>{result.blurScore ? result.blurScore.toFixed(0) : 'N/A'}</span>
                                                </div>
                                                <div className={styles.resultMetricItem}>
                                                    <span>Brightness</span>
                                                    <span className={styles.resultMetricValue}>{result.brightness ? result.brightness.toFixed(0) : 'N/A'}</span>
                                                </div>
                                                <div className={styles.resultMetricItem}>
                                                    <span>OCR Text</span>
                                                    <span className={styles.resultMetricValue}>{result.textDetected ? 'Detected' : 'None'}</span>
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
