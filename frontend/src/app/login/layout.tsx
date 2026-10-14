import type { Metadata } from 'next';
import { openGraphFor } from '@/lib/seo';

const title = 'Entrar ou criar conta';
const description = 'Acesse o Bentifiles ou crie sua conta para solicitar documentos e validar a legibilidade de cada arquivo.';

export const metadata: Metadata = {
    title,
    description,
    alternates: { canonical: '/login' },
    openGraph: openGraphFor({ title, description, path: '/login' }),
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return children;
}
