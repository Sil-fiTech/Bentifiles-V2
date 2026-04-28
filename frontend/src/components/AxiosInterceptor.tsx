'use client';

import api from '@/lib/api';
import { performLogout } from '@/lib/authClient';
import { toast } from 'sonner';

let isInterceptorSetup = false;

if (typeof window !== 'undefined' && !isInterceptorSetup) {
  isInterceptorSetup = true;

  api.interceptors.request.use((config) => {
    const hasAuthHeader = Boolean((config.headers as any)?.Authorization);
    if (hasAuthHeader) return config;

    const localToken = window.localStorage.getItem('backend_token');
    if (localToken) {
      (config.headers as any) = {
        ...(config.headers as any),
        Authorization: `Bearer ${localToken}`,
      };
    }

    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error.response?.status;
      const message = String(error.response?.data?.message || '');
      const requestHadAuthHeader = Boolean(
        error.config?.headers?.Authorization || error.config?.headers?.authorization
      );

      const shouldForceLogout =
        requestHadAuthHeader &&
        (status === 401 ||
          (status === 403 &&
            (message.includes('Token invalido') || message.includes('expirado'))));

      if (shouldForceLogout) {
        if (!window.sessionStorage.getItem('session_expired_toast_shown')) {
          window.sessionStorage.setItem('session_expired_toast_shown', 'true');
          toast.error('Sessão expirada. Por favor, faça login novamente.');

          setTimeout(() => {
            window.sessionStorage.removeItem('session_expired_toast_shown');
          }, 5000);

          await performLogout();
          window.location.href = '/';
        }
      }

      return Promise.reject(error);
    }
  );
}

export default function AxiosInterceptor({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
