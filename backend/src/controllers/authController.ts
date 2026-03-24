import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { generateVerificationToken } from '../utils/cryptoUtil';
import { sendVerificationEmail } from '../services/emailService';

const verifyTurnstile = async (token: string): Promise<boolean> => {
    if (!token) return false;
    
    try {
        const secret = process.env.TURNSTILE_SECRET_KEY;
        if (!secret) {
            console.error('TURNSTILE_SECRET_KEY não configurado no servidor');
            return false;
        }
        
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                secret,
                response: token,
            }),
        });

        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Erro na validação do Turnstile:', error);
        return false;
    }
};

export const register = async (req: Request, res: Response) => {
    try {
        const { name, email, password, turnstileToken } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Campos obrigatórios ausentes' });
        }

        const isTurnstileValid = await verifyTurnstile(turnstileToken);
        if (!isTurnstileValid) {
            return res.status(400).json({ message: 'Falha na verificação de segurança (Turnstile)' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ message: 'E-mail já está em uso' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = generateVerificationToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                emailVerifyToken: verificationToken,
                emailVerifyExpires: expiresAt,
            },
        });

        // Fire and forget email notification
        sendVerificationEmail(user.email, verificationToken, user.name).catch(console.error);

        res.status(201).json({
            message: 'Usuário registrado com sucesso. Verifique seu e-mail para validar a conta.',
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password, turnstileToken } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Campos obrigatórios ausentes' });
        }

        const isTurnstileValid = await verifyTurnstile(turnstileToken);
        if (!isTurnstileValid) {
            return res.status(400).json({ message: 'Falha na verificação de segurança (Turnstile)' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) {
            return res.status(401).json({ message: 'Credenciais inválidas' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Credenciais inválidas' });
        }

        if (!user.emailVerified) {
            return res.status(403).json({ 
                error: 'EMAIL_NOT_VERIFIED',
                message: 'Por favor, confirme seu e-mail antes de fazer login.' 
            });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'fallback-secret', {
            expiresIn: '24h',
        });

        res.status(200).json({
            message: 'Login realizado com sucesso',
            token,
            user: { id: user.id, name: user.name, email: user.email },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const googleLogin = async (req: Request, res: Response) => {
    try {
        const { email, name, image, providerId } = req.body;

        if (!email || !name || !providerId) {
            return res.status(400).json({ message: 'Dados incompletos recebidos do Google' });
        }

        let user = await prisma.user.findUnique({ where: { email } });

        if (user) {
            if (!user.providerId || user.image !== image || !user.emailVerified) {
                user = await prisma.user.update({
                    where: { email },
                    data: {
                        image: image || user.image,
                        provider: 'google',
                        providerId: providerId,
                        emailVerified: true,
                        emailVerifyToken: null,
                        emailVerifyExpires: null
                    }
                });
            }
        } else {
            user = await prisma.user.create({
                data: {
                    name,
                    email,
                    image,
                    provider: 'google',
                    providerId,
                    emailVerified: true,
                },
            });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'fallback-secret', {
            expiresIn: '24h',
        });

        res.status(200).json({
            message: 'Login com Google realizado com sucesso',
            token,
            user: { id: user.id, name: user.name, email: user.email, image: user.image },
        });
    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
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
