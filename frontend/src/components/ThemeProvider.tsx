'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'bentifiles-theme';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

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

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function getPreferredTheme(): Theme {
  const storedTheme = window.localStorage.getItem(STORAGE_KEY);

  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  // Default theme is always light unless the user explicitly chose otherwise.
  return 'light';
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = isPublicPath(pathname || '/');

  // Keep the first render deterministic between SSR and the client to avoid
  // hydration mismatches. We later sync to the user's preferred theme.
  const [theme, setThemeState] = useState<Theme>('light');

  useIsomorphicLayoutEffect(() => {
    if (isPublic) {
      setThemeState('light');
      return;
    }

    const preferredTheme = getPreferredTheme();
    setThemeState((currentTheme) =>
      currentTheme === preferredTheme ? currentTheme : preferredTheme
    );
  }, [isPublic]);

  useEffect(() => {
    if (isPublic) {
      applyTheme('light');
      return;
    }

    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, isPublic]);

  const value: ThemeContextValue = {
    theme,
    resolvedTheme: theme,
    setTheme: setThemeState,
    toggleTheme: () =>
      setThemeState((currentTheme) =>
        currentTheme === 'dark' ? 'light' : 'dark'
      ),
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
