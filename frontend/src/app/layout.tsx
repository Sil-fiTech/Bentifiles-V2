import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.scss';
import Providers from '../components/Providers';
import ThemeToggleGate from '../components/ThemeToggleGate';
import ThemedToaster from '../components/ThemedToaster';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

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
    <html
      lang="pt-BR"
      data-theme="light"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
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
