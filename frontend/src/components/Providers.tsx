'use client';

import { SessionProvider } from 'next-auth/react';
import AxiosInterceptor from './AxiosInterceptor';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
            <AxiosInterceptor>
                {children}
            </AxiosInterceptor>
        </SessionProvider>
    );
}
