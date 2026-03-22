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
      const endpoint = isLogin ? '/api/users/login' : '/api/users/register';
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
    <div className="min-h-screen w-full relative flex items-center justify-center bg-zinc-50 overflow-hidden font-body text-zinc-900 selection:bg-amber-200">
      
      {/* Premium Background Orbs & Ambient Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-300/40 rounded-full blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-300/30 rounded-full blur-[120px] mix-blend-multiply animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-rose-200/30 rounded-full blur-[100px] mix-blend-multiply animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />

      {/* Decorative Grid Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEgMWgydjJIMUMxeiIgZmlsbD0iI2Y0ZjRmNSIgZmlsbC1vcGFjaXR5PSIwLjM1IiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)] opacity-60"></div>

      <main className="relative z-10 w-full max-w-[460px] p-6 lg:p-0">
        
        {/* Brand Header */}
        <div className="mb-10 text-center animate-fade-in-up flex flex-col items-center">
          <div className="inline-flex items-center justify-center p-3 mb-6 hover:scale-105 transition-transform duration-500">
             {/* <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-amber-500">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
             </svg> */}
             <img src="./favicon.ico" alt="Logo" width={36} height={36} style={{width: "100px", height: "100px"}}/>
          </div>
          <h1 className="font-headline text-5xl md:text-6xl font-black tracking-tighter text-zinc-900 drop-shadow-sm">
            Benti<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">Files</span>
          </h1>
          <p className="mt-4 text-[15px] text-zinc-500 font-medium tracking-tight">Validação Inteligente & Gestão de Documentos</p>
        </div>

        {/* Glassmorphism Auth Card */}
        <div className="bg-white/70 backdrop-blur-2xl p-8 sm:p-10 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-white">
          <div className="flex flex-col mb-8">
            <h2 className="font-headline text-2xl font-black text-zinc-900 tracking-tight">
              {isLogin ? 'Bem-vindo(a) de volta' : 'Crie sua conta'}
            </h2>
            <p className="text-sm text-zinc-500 mt-1 font-medium">
              {isLogin ? 'Faça o login para acessar o workspace.' : 'Junte-se a nós para gerenciar seus arquivos.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {!isLogin && (
              <div className="group">
                <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-widest mb-2 px-1 transition-colors group-focus-within:text-amber-600">Nome</label>
                <input
                  type="text"
                  className="w-full px-5 py-4 bg-white/50 border border-zinc-200/80 rounded-2xl focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 focus:bg-white transition-all outline-none text-zinc-900 text-[15px] font-medium placeholder:text-zinc-400 shadow-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  placeholder="Seu nome completo"
                />
              </div>
            )}

            <div className="group">
              <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-widest mb-2 px-1 transition-colors group-focus-within:text-amber-600">E-mail</label>
              <input
                type="email"
                className="w-full px-5 py-4 bg-white/50 border border-zinc-200/80 rounded-2xl focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 focus:bg-white transition-all outline-none text-zinc-900 text-[15px] font-medium placeholder:text-zinc-400 shadow-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="nome@empresa.com"
              />
            </div>

            <div className="group">
              <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-widest mb-2 px-1 transition-colors group-focus-within:text-amber-600">Senha</label>
              <input
                type="password"
                className="w-full px-5 py-4 bg-white/50 border border-zinc-200/80 rounded-2xl focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 focus:bg-white transition-all outline-none text-zinc-900 text-[15px] font-medium placeholder:text-zinc-400 shadow-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="mt-2 w-full py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-amber-950 rounded-2xl font-headline font-black text-base tracking-wide shadow-xl shadow-amber-500/20 hover:shadow-amber-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all flex items-center justify-center gap-3 relative overflow-hidden group/btn"
              disabled={loading}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-in-out"></div>
              <span className="relative">{loading ? 'Validando...' : isLogin ? 'Acessar Plataforma' : 'Criar Conta Agora'}</span>
            </button>
          </form>

          <div className="flex items-center gap-4 my-8">
            <hr className="flex-1 border-t border-zinc-200/80" />
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2 bg-white/30 rounded-full py-1">ou conecte com</span>
            <hr className="flex-1 border-t border-zinc-200/80" />
          </div>

          <button
            type="button"
            className="w-full py-4 bg-white border border-zinc-200/80 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 rounded-2xl font-headline font-bold text-[15px] shadow-sm hover:shadow active:scale-[0.98] transition-all flex items-center justify-center gap-3"
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

        {/* Footer actions */}
        <div className="mt-8 text-center bg-white/30 backdrop-blur-md py-4 px-6 rounded-2xl border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] max-w-[max-content] mx-auto">
          <span className="text-14px text-zinc-600 font-medium">
            {isLogin ? "Ainda não tem acesso? " : "Já possui um cadastro? "}
          </span>
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-amber-600 font-black hover:text-amber-700 transition-colors ml-1.5 underline decoration-amber-600/30 underline-offset-4 hover:decoration-amber-600"
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
  )
}
