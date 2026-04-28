import type { Metadata } from 'next';
import './globals.scss';
import Providers from '../components/Providers';
import ThemeToggleGate from '../components/ThemeToggleGate';
import ThemedToaster from '../components/ThemedToaster';

export const metadata: Metadata = {
  title: 'Bentifiles — Centralize, Organize e Padronize seus Documentos',
  description:
    'O Bentifiles é uma plataforma de gestão de documentos, projetos e templates. Reduza o retrabalho e mantenha sua equipe alinhada com organização inteligente.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          {children}
          <ThemeToggleGate />
          <ThemedToaster />
        </Providers>
      </body>
    </html>
  );
}
