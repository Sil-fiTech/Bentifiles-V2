import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import type { DefaultSession } from "next-auth"
import api from '@/lib/api';

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            token?: string;
        } & DefaultSession["user"]
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        }),
    ],
    callbacks: {
        async jwt({ token, account, user }) {
            // Se as credenciais do Google estiverem presentes no momento do login (account e user)
            if (account?.provider === 'google' && user) {
                try {
                    // Chama o backend para criar ou buscar o usuário do banco
                    const res = await api.post(`/api/auth/google`, {
                        email: user.email,
                        name: user.name,
                        image: user.image,
                        providerId: user.id || account.providerAccountId,
                    });

                    if (res.data.user && res.data.token) {
                        // Salva os dados do backend no token do NextAuth
                        token.backendToken = res.data.token;
                        token.backendUserId = res.data.user.id;
                    } else {
                        throw new Error(res.data.message || 'Erro ao sincronizar com backend');
                    }
                } catch (error) {
                    console.error('Erro na sincronização Google->Backend:', error);
                    // Opcionalmente podemos tratar erros ou falhar o login
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (token.backendUserId) {
                session.user.id = token.backendUserId as string;
            }
            if (token.backendToken) {
                session.user.token = token.backendToken as string;
            }
            return session;
        },
    },
    // pages: {
    //     signIn: '/login', // Adicionar página customizada se não quiser a padrão
    // },
    // A secret is required for JWT strategy
    secret: process.env.AUTH_SECRET,
    session: {
        strategy: "jwt"
    }
})
