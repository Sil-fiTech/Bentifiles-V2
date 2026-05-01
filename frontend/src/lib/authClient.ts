import { signOut } from 'next-auth/react';
import api from './api';

export const getAuthHeaders = (token?: string | null) => {
    if (!token) {
        return undefined;
    }

    return { Authorization: `Bearer ${token}` };
};

export const performLogout = async () => {
    await api.post('/api/users/logout').catch(() => undefined);
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem('backend_token');
    }
    await signOut({ redirect: false });
};
