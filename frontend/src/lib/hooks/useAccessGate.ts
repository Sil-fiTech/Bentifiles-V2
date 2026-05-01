'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getAccessStatus, AccessStatus } from '../billing/getAccessStatus';
import { performLogout } from '../authClient';

/**
 * useAccessGate
 * 
 * Protects frontend routes by checking backend access status.
 * Redirects to /plans if the user does not have system access.
 */
export const useAccessGate = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Avoid running while session is still loading
    if (sessionStatus === 'loading') return;

    const publicPaths = ['/', '/login', '/signup', '/verify-email', '/plans', '/billing/success', '/billing/cancel'];
    const isPublicPath = publicPaths.includes(pathname);

    const checkAccess = async () => {
      try {
        const activeToken = session?.user?.token;

        if (!activeToken) {
          const cookieStatus = await getAccessStatus();
          if (cookieStatus?.authenticated) {
            setAccess(cookieStatus);
            return;
          }

          if (!isPublicPath) {
            await performLogout();
            router.push('/login');
            console.warn('[AccessGate] No active session found. Redirecting to login.');
          }
          return;
        }

        const status = await getAccessStatus(activeToken);

        if (!status || !status.authenticated) {
          if (!isPublicPath) {
            await performLogout();
            router.push('/login');
            console.error('[AccessGate] Unauthenticated according to backend. Redirecting to login.');
          }
          return;
        }

        setAccess(status);
      } catch (error) {
        console.error('[AccessGate] Error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [pathname, sessionStatus, session?.user?.token]);

  return { access, loading };
};
