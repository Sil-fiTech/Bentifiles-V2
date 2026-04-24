import { Response } from 'express';

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

export const getAuthCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: ONE_DAY_IN_MS,
    path: '/',
});

export const setAuthCookie = (res: Response, token: string) => {
    res.cookie('token', token, getAuthCookieOptions());
};

export const clearAuthCookie = (res: Response) => {
    res.clearCookie('token', getAuthCookieOptions());
};
