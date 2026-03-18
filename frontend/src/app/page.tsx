'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import { signIn } from 'next-auth/react';

function HomeContent() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  useEffect(() => {
    if (inviteToken) {
      setIsLogin(false);
      localStorage.setItem('pendingInvite', inviteToken);
    }
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin ? { email, password } : { name, email, password };

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h1 className="login-title" style={{ fontSize: '3rem', fontWeight: 800, background: 'linear-gradient(to right, #a78bfa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          BentiFiles
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '10px', fontSize: '1.1rem' }}>Validação Inteligente & Armazenamento de Documentos</p>
      </div>

      <div className="glass-panel login-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
        <h2 style={{ marginBottom: '24px', fontSize: '1.5rem', fontWeight: 600 }}>
          {isLogin ? 'Bem-vindo de volta' : 'Crie uma conta'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!isLogin && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Nome</label>
              <input
                type="text"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
                placeholder="João Silva"
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>E-mail</label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Senha</label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="primary-btn"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Processando...' : isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <hr style={{ flex: 1, borderColor: 'var(--border-color)', opacity: 0.2 }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ou</span>
          <hr style={{ flex: 1, borderColor: 'var(--border-color)', opacity: 0.2 }} />
        </div>

        <button
          type="button"
          className="glass-panel"
          style={{ width: '100%', marginTop: '24px', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 600 }}
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          Entrar com Google
        </button>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isLogin ? "Não tem uma conta? " : "Já tem uma conta? "}
          </span>
          <button
            onClick={() => setIsLogin(!isLogin)}
            style={{ color: 'var(--accent-light)', fontWeight: 600, textDecoration: 'underline' }}
          >
            {isLogin ? 'Cadastre-se' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <HomeContent />
    </Suspense>
  )
}
