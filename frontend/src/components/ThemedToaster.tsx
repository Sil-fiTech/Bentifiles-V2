'use client';

import { Toaster } from 'sonner';
import { useTheme } from './ThemeProvider';

export default function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return <Toaster theme={resolvedTheme} position="bottom-right" />;
}
