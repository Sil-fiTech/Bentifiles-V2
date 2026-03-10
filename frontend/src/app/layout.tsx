import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import Providers from '../components/Providers';

export const metadata: Metadata = {
  title: 'BentiFiles | Validação Inteligente de Documentos',
  description: 'Envie, valide e compartilhe seus documentos de forma simples e segura.',
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
          <main>{children}</main>
          <Toaster theme="dark" position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
