import crypto from 'crypto';

/**
 * Generates a secure random verify token.
 * @returns A hex string token
 */
export const generateVerificationToken = (): string => {
    return crypto.randomBytes(32).toString('hex');
};
