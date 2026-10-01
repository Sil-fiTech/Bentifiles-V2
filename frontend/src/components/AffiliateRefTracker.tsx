'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { PENDING_AFFILIATE_REF_KEY, flushPendingAffiliateRef } from '@/lib/affiliate/affiliateApi';

/**
 * Captures `?ref=` from any URL into localStorage so affiliate attribution
 * survives the signup / e-mail-verification round-trip. Also flushes it once a
 * NextAuth session exists (the Google sign-in path). Credentials and e-mail
 * verification flush explicitly from their own success handlers.
 */
export default function AffiliateRefTracker() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const ref = new URL(window.location.href).searchParams.get('ref');
      if (ref && ref.trim()) {
        localStorage.setItem(PENDING_AFFILIATE_REF_KEY, ref.trim());
      }
    } catch {
      /* no-op */
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    void flushPendingAffiliateRef(session?.user?.token);
  }, [status, session?.user?.token]);

  return null;
}
