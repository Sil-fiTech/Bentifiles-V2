'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import { signIn, useSession } from 'next-auth/react';
import { Turnstile } from '@marsidev/react-turnstile';
import styles from './page.module.scss';

function HomeContent() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const { data: session, status } = useSession();

  useEffect(() => {
    if (inviteToken) {
      setIsLogin(false);
      localStorage.setItem('pendingInvite', inviteToken);
    }
  }, [inviteToken]);

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
      return;
    }
    
    if (status !== 'loading') {
      const localToken = localStorage.getItem('token');
      if (localToken) {
        router.push('/dashboard');
      }
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!turnstileToken) {
      toast.error('Por favor, complete a verificação de segurança');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/users/login' : '/api/users/register';
      const payload = isLogin 
        ? { email, password, turnstileToken } 
        : { name, email, password, turnstileToken };

      const res = await api.post(endpoint, payload);

      localStorage.setItem('token', res.data.token);
      toast.success(res.data.message);
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Falha na autenticação');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    try {
      signIn('google', { callbackUrl: '/dashboard' });
    } catch (error) {
      toast.error('Falha ao iniciar login com Google');
      setLoading(false);
    }
  };

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
            <img src="./favicon.ico" alt="Logo" className={styles.logoImg} />
          </div>
          <h1 className={styles.headline}>
            Benti<span className={styles.headlineAccent}>Files</span>
          </h1>
          <p className={styles.tagline}>Validação Inteligente &amp; Gestão de Documentos</p>
        </div>

        {/* Auth card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              {isLogin ? 'Bem-vindo(a) de volta' : 'Crie sua conta'}
            </h2>
            <p className={styles.cardSubtitle}>
              {isLogin ? 'Faça o login para acessar o workspace.' : 'Junte-se a nós para gerenciar seus arquivos.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {!isLogin && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Nome</label>
                <input
                  type="text"
                  className={styles.fieldInput}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  placeholder="Seu nome completo"
                />
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>E-mail</label>
              <input
                type="email"
                className={styles.fieldInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="nome@empresa.com"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Senha</label>
              <input
                type="password"
                className={styles.fieldInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <Turnstile 
              siteKey="0x4AAAAAACvFRhV6i6pVbKYu" 
              onSuccess={(token: string) => setTurnstileToken(token)}
              options={{ theme: 'light' }}
            />

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              <div className={styles.submitBtnSheen} />
              <span className={styles.submitBtnText}>
                {loading ? 'Validando...' : isLogin ? 'Acessar Plataforma' : 'Criar Conta Agora'}
              </span>
            </button>
          </form>

          <div className={styles.divider}>
            <hr className={styles.dividerLine} />
            <span className={styles.dividerLabel}>Ou conecte com</span>
            <hr className={styles.dividerLine} />
          </div>

          <button
            type="button"
            className={styles.googleBtn}
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              <path d="M1 1h22v22H1z" fill="none" />
            </svg>
            Google Auth
          </button>
        </div>

        {/* Footer toggle */}
        <div className={styles.footer}>
          <span className={styles.footerText}>
            {isLogin ? 'Ainda não tem acesso? ' : 'Já possui um cadastro? '}
          </span>
          <button
            onClick={() => setIsLogin(!isLogin)}
            className={styles.footerToggle}
          >
            {isLogin ? 'Solicitar Cadastro' : 'Entrar na Conta'}
          </button>
        </div>

      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <HomeContent />
    </Suspense>
  );
}
