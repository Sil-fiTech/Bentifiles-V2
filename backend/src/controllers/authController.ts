import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { notifyErrorEvent, notifySignupCreated } from '../services/discordAlertService';
import { computeSystemAccess } from '../services/accessService';
import { generateVerificationToken } from '../utils/cryptoUtil';
import { logError } from '../utils/logger';
import { clearAuthCookie, setAuthCookie } from '../utils/authCookie';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/emailService';

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_SYMBOL_REGEX = /[^A-Za-z0-9]/;

const validatePasswordRequirements = (password: string) => {
    const errors: string[] = [];

    if (password.length < PASSWORD_MIN_LENGTH) {
        errors.push(`A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('A senha deve conter ao menos 1 letra maiuscula.');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('A senha deve conter ao menos 1 letra minuscula.');
    }

    if (!/\d/.test(password)) {
        errors.push('A senha deve conter ao menos 1 numero.');
    }

    if (!PASSWORD_SYMBOL_REGEX.test(password)) {
        errors.push('A senha deve conter ao menos 1 simbolo.');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

type TurnstileVerifyResult = { success: boolean; errorCodes: string[] };

const getClientIp = (req: Request): string | undefined => {
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim()) return cfConnectingIp.trim();

    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
        return forwardedFor.split(',')[0]?.trim() || undefined;
    }

    if (typeof req.ip === 'string' && req.ip.trim()) return req.ip.trim();

    return undefined;
};

const verifyTurnstile = async (token: string, remoteip?: string): Promise<TurnstileVerifyResult> => {
    if (!token) return { success: false, errorCodes: ['missing-input-response'] };

    try {
        const secret = process.env.TURNSTILE_SECRET_KEY;
        if (!secret) {
            console.error('TURNSTILE_SECRET_KEY nao configurado no servidor');
            return { success: false, errorCodes: ['missing-input-secret'] };
        }

        const params = new URLSearchParams();
        params.set('secret', secret);
        params.set('response', token);
        if (remoteip) params.set('remoteip', remoteip);

        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        if (!response.ok) {
            console.error('Falha HTTP ao validar Turnstile:', response.status, response.statusText);
            return { success: false, errorCodes: ['bad-request'] };
        }

        const data = (await response.json()) as { success?: boolean; 'error-codes'?: string[] };
        return {
            success: Boolean(data?.success),
            errorCodes: Array.isArray(data?.['error-codes']) ? data['error-codes'] : [],
        };
    } catch (error) {
        console.error('Erro na validacao do Turnstile:', error);
        return { success: false, errorCodes: ['internal-error'] };
    }
};

export const register = async (req: Request, res: Response) => {
    try {
        const { name, email, password, turnstileToken, inviteToken, officeInviteToken, affiliateRef } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Campos obrigatorios ausentes' });
        }

        const passwordValidation = validatePasswordRequirements(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                message: 'A senha nao atende aos requisitos de seguranca.',
                errors: passwordValidation.errors,
            });
        }

        const turnstileVerify = await verifyTurnstile(turnstileToken, getClientIp(req));
        if (!turnstileVerify.success) {
            console.warn('Turnstile invalido (register):', { errorCodes: turnstileVerify.errorCodes });
            return res.status(400).json({ message: 'Falha na verificacao de seguranca (Turnstile)' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser) {
            return res.status(409).json({ message: 'E-mail ja esta em uso' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = generateVerificationToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const user = await prisma.user.create({
            data: {
                name,
                email: normalizedEmail,
                password: hashedPassword,
                emailVerifyToken: verificationToken,
                emailVerifyExpires: expiresAt,
            },
        });

        sendVerificationEmail(user.email, verificationToken, user.name, inviteToken, officeInviteToken, affiliateRef).catch(console.error);
        notifySignupCreated({
            userId: user.id,
            email: user.email,
            name: user.name,
            provider: 'credentials',
        });

        res.status(201).json({
            message: 'Usuario registrado com sucesso. Verifique seu e-mail para validar a conta.',
        });
    } catch (error) {
        logError('Registration error', error);
        notifyErrorEvent('Falha no cadastro', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password, turnstileToken } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Campos obrigatorios ausentes' });
        }

        const turnstileVerify = await verifyTurnstile(turnstileToken, getClientIp(req));
        if (!turnstileVerify.success) {
            console.warn('Turnstile invalido (login):', { errorCodes: turnstileVerify.errorCodes });
            return res.status(400).json({ message: 'Falha na verificacao de seguranca (Turnstile)' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user || !user.password) {
            return res.status(401).json({ message: 'Credenciais invalidas' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Credenciais invalidas' });
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

        setAuthCookie(res, token);

        res.status(200).json({
            message: 'Login realizado com sucesso',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                systemRole: user.systemRole,
                hasSystemAccess: computeSystemAccess(user)
            },
        });
    } catch (error) {
        logError('Login error', error);
        notifyErrorEvent('Falha no login', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const googleLogin = async (req: Request, res: Response) => {
    try {
        const { email, name, image, providerId } = req.body;

        if (!email || !name || !providerId) {
            return res.status(400).json({ message: 'Dados incompletos recebidos do Google' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

        if (user) {
            if (!user.providerId || user.image !== image || !user.emailVerified) {
                user = await prisma.user.update({
                    where: { email: normalizedEmail },
                    data: {
                        image: image || user.image,
                        provider: 'google',
                        providerId,
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
                    email: normalizedEmail,
                    image,
                    provider: 'google',
                    providerId,
                    emailVerified: true,
                },
            });

            notifySignupCreated({
                userId: user.id,
                email: user.email,
                name: user.name,
                provider: 'google',
            });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'fallback-secret', {
            expiresIn: '24h',
        });

        setAuthCookie(res, token);

        res.status(200).json({
            message: 'Login com Google realizado com sucesso',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                systemRole: user.systemRole,
                hasSystemAccess: computeSystemAccess(user)
            },
        });
    } catch (error) {
        logError('Google login error', error);
        notifyErrorEvent('Falha no login Google', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
};

export const verifyEmail = async (req: Request, res: Response) => {
    try {
        const { token } = req.query;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ message: 'Token nao fornecido ou invalido.' });
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
            return res.status(400).json({ message: 'Token invalido ou expirado.' });
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

        setAuthCookie(res, jwtToken);

        res.status(200).json({
            message: 'E-mail verificado com sucesso!',
            token: jwtToken,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        logError('Verify email error', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

export const resendVerification = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'E-mail obrigatorio.' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

        if (user && !user.emailVerified) {
            const verificationToken = generateVerificationToken();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    emailVerifyToken: verificationToken,
                    emailVerifyExpires: expiresAt
                }
            });

            sendVerificationEmail(user.email, verificationToken, user.name).catch(console.error);
        }

        res.status(200).json({ message: 'Se o e-mail estiver cadastrado e nao verificado, um novo link sera enviado.' });
    } catch (error) {
        logError('Resend verification error', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'E-mail obrigatorio.' });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

        if (user && user.password) {
            const resetToken = generateVerificationToken();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordResetToken: resetToken,
                    passwordResetExpires: expiresAt,
                } as any,
            });

            sendPasswordResetEmail(user.email, resetToken, user.name).catch(console.error);
        }

        return res.status(200).json({
            message: 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.',
        });
    } catch (error) {
        logError('Forgot password error', error);
        return res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: 'Token e nova senha sao obrigatorios.' });
        }

        const passwordValidation = validatePasswordRequirements(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                message: 'A senha nao atende aos requisitos de seguranca.',
                errors: passwordValidation.errors,
            });
        }

        const user = await prisma.user.findFirst({
            where: {
                passwordResetToken: token,
                passwordResetExpires: {
                    gt: new Date(),
                },
            } as any,
        });

        if (!user) {
            return res.status(400).json({ message: 'Link de recuperacao invalido ou expirado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
            } as any,
        });

        return res.status(200).json({ message: 'Senha atualizada com sucesso. Voce ja pode fazer login.' });
    } catch (error) {
        logError('Reset password error', error);
        return res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

export const logout = async (req: Request, res: Response) => {
    clearAuthCookie(res);
    res.status(200).json({ message: 'Logout realizado com sucesso' });
};
