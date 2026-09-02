'use client';

import { SessionProvider } from 'next-auth/react';
import AxiosInterceptor from './AxiosInterceptor';
import CookieConsent from './CookieConsent';
import { ThemeProvider } from './ThemeProvider';
import SessionTokenSync from './SessionTokenSync';
import AffiliateRefTracker from './AffiliateRefTracker';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
        <SessionTokenSync />
        <AffiliateRefTracker />
        <AxiosInterceptor>
          {children}
          <CookieConsent />
        </AxiosInterceptor>
      </SessionProvider>
    </ThemeProvider>
  );
}
