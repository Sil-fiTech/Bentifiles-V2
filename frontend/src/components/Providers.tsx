'use client';

import { SessionProvider } from 'next-auth/react';
import AxiosInterceptor from './AxiosInterceptor';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <AxiosInterceptor>
                {children}
            </AxiosInterceptor>
        </SessionProvider>
    );
}
