'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function SessionTokenSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (status !== 'authenticated') return;

    const token = session?.user?.token;
    if (token) {
      window.localStorage.setItem('backend_token', token);
    }
  }, [status, session?.user?.token]);

  return null;
}

