import { Request, Response } from 'express';
import prisma from '../prisma';

export const getProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, image: true, createdAt: true }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ message: 'Nome inválido' });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { name: name.trim() },
            select: { id: true, name: true, email: true, image: true, createdAt: true }
        });

        res.json(user);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const verifyEmail = async (req: Request, res: Response) => {
    try {
        const { token } = req.query;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ message: 'Token não fornecido ou inválido.' });
        }

        const user = await prisma.user.findFirst({
            where: {
                emailVerifyToken: token,
                emailVerifyExpires: {
                    gt: new Date()
                }
            }
        });

        if (!user) {
            return res.status(400).json({ message: 'Token inválido ou expirado.' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                emailVerifyToken: null,
                emailVerifyExpires: null
            }
        });

        const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'fallback-secret', {
            expiresIn: '24h',
        });

        res.status(200).json({
            message: 'E-mail verificado com sucesso!',
            token: jwtToken,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

export const resendVerification = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'E-mail obrigatório.' });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (user && !user.emailVerified) {
            const verificationToken = generateVerificationToken();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    emailVerifyToken: verificationToken,
                    emailVerifyExpires: expiresAt
                }
            });

            sendVerificationEmail(user.email, verificationToken, user.name).catch(console.error);
        }

        res.status(200).json({ message: 'Se o e-mail estiver cadastrado e não verificado, um novo link será enviado.' });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};