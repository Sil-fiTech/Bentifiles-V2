'use client';

import axios from 'axios';
import { signOut } from 'next-auth/react';
import { toast } from 'sonner';

let isInterceptorSetup = false;

if (typeof window !== 'undefined' && !isInterceptorSetup) {
    isInterceptorSetup = true;
    axios.interceptors.response.use(
        (response) => response,
        async (error) => {
            if (error.response?.status === 401 || error.response?.status === 403) {
                // Prevent duplicate handling
                if (!window.sessionStorage.getItem('session_expired_toast_shown')) {
                    window.sessionStorage.setItem('session_expired_toast_shown', 'true');
                    toast.error('Sessão expirada. Por favor, faça login novamente.');
                    
                    setTimeout(() => {
                        window.sessionStorage.removeItem('session_expired_toast_shown');
                    }, 5000);
                    
                    localStorage.removeItem('token');
                    await signOut({ redirect: false });
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
