import type { Metadata } from 'next';
import './globals.scss';
import { Toaster } from 'sonner';
import Providers from '../components/Providers';

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
    <html lang="pt-BR">
      <body>
        <Providers>
          {children}
          <Toaster theme="dark" position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
