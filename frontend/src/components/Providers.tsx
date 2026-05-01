'use client';

import { SessionProvider } from 'next-auth/react';
import AxiosInterceptor from './AxiosInterceptor';
import CookieConsent from './CookieConsent';
import { ThemeProvider } from './ThemeProvider';
import SessionTokenSync from './SessionTokenSync';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
        <SessionTokenSync />
        <AxiosInterceptor>
          {children}
          <CookieConsent />
        </AxiosInterceptor>
      </SessionProvider>
    </ThemeProvider>
  );
}
