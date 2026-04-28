'use client';

import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

const LOGGED_PREFIXES = ['/dashboard', '/projects', '/admin', '/profile', '/subscription', '/billing'];
const PUBLIC_PREFIXES = [
  '/',
  '/landing',
  '/login',
  '/signup',
  '/plans',
  '/privacy-policy',
  '/terms-of-service',
  '/verify-email',
  '/billing/success',
  '/billing/cancel',
];

const isPublicPath = (pathname: string) =>
  PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export default function ThemeToggleGate() {
  const pathname = usePathname();

  if (isPublicPath(pathname)) return null;

  const shouldShow = LOGGED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!shouldShow) return null;

  return <ThemeToggle />;
}
