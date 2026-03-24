import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

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

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        });

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'fallback-secret', {
            expiresIn: '24h',
        });

        res.status(201).json({
            message: 'Usuário registrado com sucesso',
            token,
            user: { id: user.id, name: user.name, email: user.email },
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
            // Se o usuário existir mas não tiver os dados de provedor (ou se a imagem mudou), atualizamos
            if (!user.providerId || user.image !== image) {
                user = await prisma.user.update({
                    where: { email },
                    data: {
                        image: image || user.image,
                        provider: 'google',
                        providerId: providerId,
                    }
                });
            }
        } else {
            // Se o usuário não existir, cria um novo
            user = await prisma.user.create({
                data: {
                    name,
                    email,
                    image,
                    provider: 'google',
                    providerId,
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
