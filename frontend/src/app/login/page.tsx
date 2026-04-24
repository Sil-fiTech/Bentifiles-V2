'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import { signIn, useSession } from 'next-auth/react';
import { Turnstile } from '@marsidev/react-turnstile';
import styles from '../page.module.scss';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

const passwordChecks = (password: string) => [
  { key: 'length', label: 'Pelo menos 8 caracteres', ok: password.length >= 8 },
  { key: 'upper', label: '1 letra maiuscula', ok: /[A-Z]/.test(password) },
  { key: 'lower', label: '1 letra minuscula', ok: /[a-z]/.test(password) },
  { key: 'number', label: '1 numero', ok: /\d/.test(password) },
  { key: 'symbol', label: '1 simbolo', ok: /[^A-Za-z0-9]/.test(password) },
];

function LoginContent() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const officeInviteToken = searchParams.get('officeInvite');
  const urlMode = searchParams.get('mode');
  const resetToken = searchParams.get('token');

  const { data: session, status } = useSession();
  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  const shouldShowPasswordRules = isRegister || isReset;
  const passwordRequirements = useMemo(() => passwordChecks(password), [password]);
  const completedPasswordRequirements = passwordRequirements.filter((item) => item.ok).length;
  const passwordProgress = Math.round((completedPasswordRequirements / passwordRequirements.length) * 100);
  const passwordIsValid = passwordRequirements.every((item) => item.ok);
  const passwordStrengthLabel =
    passwordProgress === 100
      ? 'Senha forte'
      : passwordProgress >= 60
        ? 'Quase la'
        : passwordProgress > 0
          ? 'Em andamento'
          : 'Comece a digitar';

  useEffect(() => {
    if (urlMode === 'register') {
      setMode('register');
    } else if (urlMode === 'forgot') {
      setMode('forgot');
    } else if (urlMode === 'reset' && resetToken) {
      setMode('reset');
    }
  }, [urlMode, resetToken]);

  useEffect(() => {
    if (inviteToken) {
      setMode('register');
      localStorage.setItem('pendingInvite', inviteToken);
    }
  }, [inviteToken]);

  useEffect(() => {
    if (officeInviteToken) {
      setMode('register');
      localStorage.setItem('pendingOfficeInvite', officeInviteToken);
    }
  }, [officeInviteToken]);

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
  }, [status, router, session]);

  const resetFormState = () => {
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setTurnstileToken(null);
    setLoading(false);
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    resetFormState();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((isLogin || isRegister) && !turnstileToken) {
      toast.error('Por favor, complete a verificacao de seguranca');
      return;
    }

    if (shouldShowPasswordRules && !passwordIsValid) {
      toast.error('Sua senha ainda nao atende aos requisitos.');
      return;
    }

    if (isReset && password !== confirmPassword) {
      toast.error('A confirmacao da senha nao confere.');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const res = await api.post('/api/users/login', { email, password, turnstileToken });
        localStorage.setItem('token', res.data.token);
        toast.success(res.data.message);
        router.push('/dashboard');
        return;
      }

      if (isRegister) {
        const pendingInvite = inviteToken || localStorage.getItem('pendingInvite');
        const pendingOfficeInvite = officeInviteToken || localStorage.getItem('pendingOfficeInvite');
        await api.post('/api/users/register', {
          name,
          email,
          password,
          turnstileToken,
          inviteToken: pendingInvite,
          officeInviteToken: pendingOfficeInvite,
        });

        toast.success('Conta criada! Verifique seu e-mail para validar a conta.');
        switchMode('login');
        return;
      }

      if (isForgot) {
        const res = await api.post('/api/users/forgot-password', { email });
        toast.success(res.data.message);
        switchMode('login');
        return;
      }

      if (isReset) {
        const res = await api.post('/api/users/reset-password', {
          token: resetToken,
          password,
        });
        toast.success(res.data.message);
        switchMode('login');
        return;
      }
    } catch (error: any) {
      if (error.response?.data?.error === 'EMAIL_NOT_VERIFIED') {
        toast.error(error.response?.data?.message || 'E-mail nao verificado.', {
          action: {
            label: 'Reenviar E-mail',
            onClick: async () => {
              try {
                await api.post('/api/users/resend-verification', {
                  email,
                  inviteToken: inviteToken || localStorage.getItem('pendingInvite'),
                  officeInviteToken: officeInviteToken || localStorage.getItem('pendingOfficeInvite'),
                });
                toast.success('Novo e-mail de verificacao enviado! Verifique sua caixa de entrada.');
              } catch {
                toast.error('Erro ao reenviar e-mail de verificacao.');
              }
            }
          },
          duration: 10000
        });
      } else if (Array.isArray(error.response?.data?.errors) && error.response.data.errors.length > 0) {
        toast.error(error.response.data.errors[0]);
      } else {
        toast.error(error.response?.data?.message || 'Falha na autenticacao');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    try {
      signIn('google', { callbackUrl: '/dashboard' });
    } catch {
      toast.error('Falha ao iniciar login com Google');
      setLoading(false);
    }
  };

  const title = isLogin
    ? 'Bem-vindo(a) de volta'
    : isRegister
      ? 'Crie sua conta'
      : isForgot
        ? 'Recuperar senha'
        : 'Defina sua nova senha';

  const subtitle = isLogin
    ? 'Faca o login para acessar o workspace.'
    : isRegister
      ? 'Junte-se a nos para gerenciar seus arquivos.'
      : isForgot
        ? 'Enviaremos um link de recuperacao para o seu e-mail.'
        : 'Escolha uma senha forte para voltar ao sistema com seguranca.';

  return (
    <div className={styles.root}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.orb3} />
      <div className={styles.gridPattern} />

      <main className={styles.main}>
        <div className={styles.brand}>
          <div className={styles.logoWrapper}>
            <img src="/favicon.ico" alt="Logo" className={styles.logoImg} />
          </div>
          <h1 className={styles.headline}>
            Benti<span className={styles.headlineAccent}>Files</span>
          </h1>
          <p className={styles.tagline}>Validacao Inteligente &amp; Gestao de Documentos</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>{title}</h2>
            <p className={styles.cardSubtitle}>{subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {isRegister && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Nome</label>
                <input
                  type="text"
                  className={styles.fieldInput}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Seu nome completo"
                />
              </div>
            )}

            {!isReset && (
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
            )}

            {!isForgot && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{isReset ? 'Nova senha' : 'Senha'}</label>
                <div className={styles.passwordField}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={styles.fieldInput}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="********"
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M3 4.5L19.5 21M10.58 10.58A2 2 0 0013.42 13.42M9.88 5.09A10.94 10.94 0 0112 4.9c5.05 0 9.27 3.11 10.5 7.1a11.8 11.8 0 01-4.04 5.55M6.61 6.61A11.77 11.77 0 001.5 12c.56 1.83 1.73 3.55 3.32 4.93M14.12 14.12A3 3 0 019.88 9.88"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M1.5 12S5.5 4.9 12 4.9 22.5 12 22.5 12 18.5 19.1 12 19.1 1.5 12 1.5 12z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {shouldShowPasswordRules && (
              <div className={styles.passwordChecklist}>
                <div className={styles.passwordChecklistHeader}>
                  <p className={styles.passwordChecklistEyebrow}>Seguranca da senha</p>
                  <div className={styles.passwordChecklistTopline}>
                    <p className={styles.passwordChecklistTitle}>Sua senha deve conter:</p>
                    <span className={styles.passwordChecklistStatus}>{passwordStrengthLabel}</span>
                  </div>
                  <div className={styles.passwordProgressMeta}>
                    <span>{completedPasswordRequirements} de {passwordRequirements.length} requisitos</span>
                    <span>{passwordProgress}%</span>
                  </div>
                  <div className={styles.passwordProgressTrack} aria-hidden="true">
                    <div
                      className={styles.passwordProgressFill}
                      style={{ width: `${passwordProgress}%` }}
                    />
                  </div>
                </div>
                <ul className={styles.passwordChecklistList}>
                  {passwordRequirements.map((item) => (
                    <li
                      key={item.key}
                      className={item.ok ? styles.passwordChecklistItemOk : styles.passwordChecklistItemPending}
                    >
                      <span className={styles.passwordChecklistIcon} aria-hidden="true">
                        {item.ok ? 'OK' : '--'}
                      </span>
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isReset && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Confirmar nova senha</label>
                <div className={styles.passwordField}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className={styles.fieldInput}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="********"
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    aria-label={showConfirmPassword ? 'Ocultar confirmacao de senha' : 'Mostrar confirmacao de senha'}
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M3 4.5L19.5 21M10.58 10.58A2 2 0 0013.42 13.42M9.88 5.09A10.94 10.94 0 0112 4.9c5.05 0 9.27 3.11 10.5 7.1a11.8 11.8 0 01-4.04 5.55M6.61 6.61A11.77 11.77 0 001.5 12c.56 1.83 1.73 3.55 3.32 4.93M14.12 14.12A3 3 0 019.88 9.88"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M1.5 12S5.5 4.9 12 4.9 22.5 12 22.5 12 18.5 19.1 12 19.1 1.5 12 1.5 12z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {(isLogin || isRegister) && (
              <Turnstile
                siteKey="0x4AAAAAACvhVvi_0lSDhv6U"
                onSuccess={(token: string) => setTurnstileToken(token)}
                options={{ theme: 'light' }}
              />
            )}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              <div className={styles.submitBtnSheen} />
              <span className={styles.submitBtnText}>
                {loading
                  ? 'Validando...'
                  : isLogin
                    ? 'Acessar Plataforma'
                    : isRegister
                      ? 'Criar Conta Agora'
                      : isForgot
                        ? 'Enviar Link de Recuperacao'
                        : 'Salvar Nova Senha'}
              </span>
            </button>
          </form>

          {isLogin && (
            <button type="button" className={styles.inlineLink} onClick={() => switchMode('forgot')}>
              Esqueci minha senha
            </button>
          )}

          {(isLogin || isRegister) && (
            <>
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
            </>
          )}
        </div>

        <div className={styles.footer}>
          {isLogin && (
            <>
              <span className={styles.footerText}>Ainda nao tem acesso? </span>
              <button onClick={() => switchMode('register')} className={styles.footerToggle}>
                Criar Conta
              </button>
            </>
          )}

          {isRegister && (
            <>
              <span className={styles.footerText}>Ja possui um cadastro? </span>
              <button onClick={() => switchMode('login')} className={styles.footerToggle}>
                Entrar na Conta
              </button>
            </>
          )}

          {(isForgot || isReset) && (
            <>
              <span className={styles.footerText}>Lembrou a senha? </span>
              <button onClick={() => switchMode('login')} className={styles.footerToggle}>
                Voltar para o login
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <LoginContent />
    </Suspense>
  );
}
