'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import styles from './page.module.scss';
import Link from 'next/link';

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verificando seu e-mail...');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Token de verificação inválido ou ausente.');
            return;
        }

        const verifyToken = async () => {
            try {
                const res = await api.get(`/api/auth/verify-email?token=${token}`);
                setStatus('success');
                
                if (res.data.token) {
                    localStorage.setItem('token', res.data.token);
                    setMessage('E-mail verificado com sucesso! Redirecionando para o painel...');
                    setTimeout(() => {
                        router.push('/dashboard');
                    }, 2000);
                } else {
                    setMessage(res.data.message || 'Seu e-mail foi verificado com sucesso! Você já pode fazer login e acessar a plataforma.');
                }
            } catch (error: any) {
                setStatus('error');
                setMessage(error.response?.data?.message || 'Falha ao verificar e-mail. O link pode ter expirado.');
            }
        };

        verifyToken();
    }, [token]);

    return (
        <div className={styles.root}>
            {/* Background decoration */}
            <div className={styles.orb1} />
            <div className={styles.orb2} />
            <div className={styles.orb3} />
            <div className={styles.gridPattern} />

            <main className={styles.main}>
                {/* Brand header */}
                <div className={styles.brand}>
                    <div className={styles.logoWrapper}>
                        <img src="/favicon.ico" alt="Logo" className={styles.logoImg} />
                    </div>
                    <h1 className={styles.headline}>
                        Benti<span className={styles.headlineAccent}>Files</span>
                    </h1>
                    <p className={styles.tagline}>Validação Inteligente & Gestão de Documentos</p>
                </div>

                <div className={styles.card}>
                    <div className={`${styles.iconWrapper} ${styles[status]}`}>
                        {status === 'loading' && (
                            <svg className={`${styles.icon} animate-spin`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                        )}
                        {status === 'success' && (
                            <svg className={styles.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {status === 'error' && (
                            <svg className={styles.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                    </div>

                    <h1 className={styles.title}>
                        {status === 'loading' && 'Verificando...'}
                        {status === 'success' && 'E-mail Verificado!'}
                        {status === 'error' && 'Ops, algo deu errado'}
                    </h1>
                    
                    <p className={styles.text}>{message}</p>

                    {status === 'error' && (
                        <Link href="/" className={styles.button}>
                            <div className={styles.buttonSheen} />
                            <span className={styles.buttonText}>Voltar para o Login</span>
                        </Link>
                    )}
                    {status === 'success' && (
                        <Link href="/dashboard" className={styles.button}>
                            <div className={styles.buttonSheen} />
                            <span className={styles.buttonText}>Ir para o Dashboard</span>
                        </Link>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className={styles.root}>
                <div className={styles.card}>
                    <div className={styles.iconWrapper + ' ' + styles.loading}></div>
                    <h1 className={styles.title}>Verificando...</h1>
                </div>
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}
