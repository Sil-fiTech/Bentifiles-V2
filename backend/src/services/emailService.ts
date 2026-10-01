import nodemailer from 'nodemailer';

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

const createTransporter = async () => {
    if (!transporterPromise) {
        const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
        });

        transporterPromise = transporter.verify()
            .then(() => transporter)
            .catch((error) => {
                transporterPromise = null;
                throw error;
            });
    }

    return transporterPromise;
};

const getFrontendUrl = () => {
    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    if (!frontendUrl.startsWith('http')) {
        frontendUrl = `https://${frontendUrl}`;
    }

    return frontendUrl;
};

const sendEmail = async (params: {
    to: string;
    subject: string;
    html: string;
}) => {
    const transporter = await createTransporter();

    await transporter.sendMail({
        from: `"BentiFiles" <${process.env.SMTP_USER || 'noreply@bentifiles.com'}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
    });
};

const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const buildVerificationUrl = (
    token: string,
    inviteToken?: string | null,
    officeInviteToken?: string | null,
    affiliateRef?: string | null
) => {
    const frontendUrl = getFrontendUrl();
    const verifyUrl = new URL('/verify-email', frontendUrl);
    verifyUrl.searchParams.set('token', token);

    if (inviteToken) {
        verifyUrl.searchParams.set('invite', inviteToken);
    }

    if (officeInviteToken) {
        verifyUrl.searchParams.set('officeInvite', officeInviteToken);
    }

    if (affiliateRef) {
        verifyUrl.searchParams.set('ref', affiliateRef);
    }

    return verifyUrl.toString();
};

export const sendProjectInviteEmail = async (params: {
    email: string;
    inviteLink: string;
    projectName: string;
    invitedByName: string;
}) => {
    try {
        const frontendUrl = getFrontendUrl();
        const safeProjectName = escapeHtml(params.projectName);
        const safeInvitedByName = escapeHtml(params.invitedByName);

        const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: 'Space Grotesk', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f9f9f9; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #e4e4e7;">
                    <tr>
                        <td align="center" style="padding: 40px 0; background-color: #ffffff; border-bottom: 1px solid #e4e4e7;">
                            <img src="${frontendUrl}/logo.png" alt="BentiFiles Logo" height="40" style="display: block; max-width: 100%; height: 40px; margin: 0 auto; object-fit: contain;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 40px 30px 40px;">
                            <h2 style="color: #1a1c1c; margin: 0 0 20px 0; font-size: 22px; font-weight: 700;">Convite para projeto</h2>
                            <p style="margin: 0 0 16px 0; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                                <strong style="color: #18181b;">${safeInvitedByName}</strong> convidou voce para participar do projeto <strong style="color: #18181b;">${safeProjectName}</strong> no BentiFiles.
                            </p>
                            <p style="margin: 0 0 32px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                                Use o link abaixo para acessar o projeto. Se voce ainda nao tiver conta, o fluxo de cadastro sera iniciado automaticamente.
                            </p>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 32px;">
                                        <a href="${params.inviteLink}" style="display: inline-block; background-color: #fbbf24; color: #1a1c1c; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 8px; box-shadow: 0 2px 4px 0 rgba(251, 191, 36, 0.2); border: 1px solid #f59e0b;">
                                            Acessar projeto
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; border: 1px dashed #d4d4d8;">
                                <p style="margin: 0 0 8px 0; color: #52525b; font-size: 14px; text-align: center;">
                                    O botao nao funcionou? Copie e cole o link abaixo no seu navegador:
                                </p>
                                <p style="margin: 0; color: #3b82f6; font-size: 13px; text-align: center; word-break: break-all; line-height: 1.5;">
                                    <a href="${params.inviteLink}" style="color: #3b82f6; text-decoration: underline;">${params.inviteLink}</a>
                                </p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9f9f9; border-top: 1px solid #e4e4e7; text-align: center;">
                            <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 1.5;">
                                Este convite expira em 24 horas.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        await sendEmail({
            to: params.email,
            subject: `BentiFiles: convite para ${params.projectName}`,
            html,
        });

        console.log(`[Email] Convite de projeto enviado para ${params.email}`);
    } catch (error) {
        console.error('Erro ao enviar email de convite:', error);
        throw new Error('Falha no envio de e-mail de convite');
    }
};

export const sendVerificationEmail = async (
    email: string,
    token: string,
    name: string,
    inviteToken?: string | null,
    officeInviteToken?: string | null,
    affiliateRef?: string | null
) => {
    try {
        const frontendUrl = getFrontendUrl();
        const verifyUrl = buildVerificationUrl(token, inviteToken, officeInviteToken, affiliateRef);
        const safeName = escapeHtml(name);

        const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: 'Space Grotesk', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f9f9f9; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #e4e4e7;">
                    <tr>
                        <td align="center" style="padding: 40px 0; background-color: #ffffff; border-bottom: 1px solid #e4e4e7;">
                            <img src="${frontendUrl}/logo.png" alt="BentiFiles Logo" height="40" style="display: block; max-width: 100%; height: 40px; margin: 0 auto; object-fit: contain;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 40px 30px 40px;">
                            <h2 style="color: #1a1c1c; margin: 0 0 20px 0; font-size: 22px; font-weight: 700;">Confirme seu E-mail</h2>
                            <p style="margin: 0 0 16px 0; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                                Olá, <strong style="color: #18181b;">${safeName}</strong>!
                            </p>
                            <p style="margin: 0 0 32px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                                Ficamos felizes em ter você conosco! Para começar a usar a plataforma e liberar seu acesso, precisamos apenas que você confirme seu e-mail clicando no botão abaixo:
                            </p>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 32px;">
                                        <a href="${verifyUrl}" style="display: inline-block; background-color: #fbbf24; color: #1a1c1c; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 8px; box-shadow: 0 2px 4px 0 rgba(251, 191, 36, 0.2); border: 1px solid #f59e0b;">
                                            Confirmar meu E-mail
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; border: 1px dashed #d4d4d8;">
                                <p style="margin: 0 0 8px 0; color: #52525b; font-size: 14px; text-align: center;">
                                    O botão não funcionou? Copie e cole o link abaixo no seu navegador:
                                </p>
                                <p style="margin: 0; color: #3b82f6; font-size: 13px; text-align: center; word-break: break-all; line-height: 1.5;">
                                    <a href="${verifyUrl}" style="color: #3b82f6; text-decoration: underline;">${verifyUrl}</a>
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9f9f9; border-top: 1px solid #e4e4e7; text-align: center;">
                            <p style="margin: 0 0 8px 0; color: #71717a; font-size: 13px; line-height: 1.5;">
                                Se você não se cadastrou no <strong style="color: #3f3f46;">BentiFiles</strong>, pode ignorar este e-mail.
                            </p>
                            <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
                                Este link de confirmação expirará em 24 horas.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        await sendEmail({
            to: email,
            subject: 'BentiFiles: Confirme seu E-mail',
            html,
        });

        console.log(`[Email] Verificacao enviada para ${email}`);
    } catch (error) {
        console.error('Erro ao enviar email de verificacao:', error);
        throw new Error('Falha no envio de e-mail');
    }
};

export const sendPasswordResetEmail = async (
    email: string,
    token: string,
    name: string
) => {
    try {
        const frontendUrl = getFrontendUrl();
        const resetUrl = new URL('/login', frontendUrl);
        resetUrl.searchParams.set('mode', 'reset');
        resetUrl.searchParams.set('token', token);
        const safeName = escapeHtml(name);
        const safeResetUrl = resetUrl.toString();

        const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: 'Space Grotesk', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f9f9f9; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #e4e4e7;">
                    <tr>
                        <td align="center" style="padding: 40px 0; background-color: #ffffff; border-bottom: 1px solid #e4e4e7;">
                            <img src="${frontendUrl}/logo.png" alt="BentiFiles Logo" height="40" style="display: block; max-width: 100%; height: 40px; margin: 0 auto; object-fit: contain;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 40px 30px 40px;">
                            <h2 style="color: #1a1c1c; margin: 0 0 20px 0; font-size: 22px; font-weight: 700;">Recuperacao de senha</h2>
                            <p style="margin: 0 0 16px 0; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                                Ola, <strong style="color: #18181b;">${safeName}</strong>!
                            </p>
                            <p style="margin: 0 0 32px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                                Recebemos uma solicitacao para redefinir sua senha. Clique no botao abaixo para criar uma nova senha.
                            </p>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 32px;">
                                        <a href="${safeResetUrl}" style="display: inline-block; background-color: #fbbf24; color: #1a1c1c; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 8px; box-shadow: 0 2px 4px 0 rgba(251, 191, 36, 0.2); border: 1px solid #f59e0b;">
                                            Redefinir senha
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; border: 1px dashed #d4d4d8;">
                                <p style="margin: 0 0 8px 0; color: #52525b; font-size: 14px; text-align: center;">
                                    Se o botao nao funcionar, copie e cole este link no navegador:
                                </p>
                                <p style="margin: 0; color: #3b82f6; font-size: 13px; text-align: center; word-break: break-all; line-height: 1.5;">
                                    <a href="${safeResetUrl}" style="color: #3b82f6; text-decoration: underline;">${safeResetUrl}</a>
                                </p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9f9f9; border-top: 1px solid #e4e4e7; text-align: center;">
                            <p style="margin: 0 0 8px 0; color: #71717a; font-size: 13px; line-height: 1.5;">
                                Se voce nao solicitou a redefinicao, pode ignorar este e-mail.
                            </p>
                            <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
                                Este link expira em 1 hora.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        await sendEmail({
            to: email,
            subject: 'BentiFiles: redefinicao de senha',
            html,
        });

        console.log(`[Email] Recuperacao de senha enviada para ${email}`);
    } catch (error) {
        console.error('Erro ao enviar email de recuperacao de senha:', error);
        throw new Error('Falha no envio de e-mail de recuperacao de senha');
    }
};

export const sendOfficeSubscriptionInviteEmail = async (params: {
    email: string;
    inviteLink: string;
    invitedByName: string;
    seatsLabel?: string;
}) => {
    try {
        const frontendUrl = getFrontendUrl();
        const safeInvitedByName = escapeHtml(params.invitedByName);
        const safeSeatsLabel = escapeHtml(params.seatsLabel || 'licenca OFFICE');

        const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: 'Space Grotesk', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f9f9f9; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #e4e4e7;">
                    <tr>
                        <td align="center" style="padding: 40px 0; background-color: #ffffff; border-bottom: 1px solid #e4e4e7;">
                            <img src="${frontendUrl}/logo.png" alt="BentiFiles Logo" height="40" style="display: block; max-width: 100%; height: 40px; margin: 0 auto; object-fit: contain;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 40px 30px 40px;">
                            <h2 style="color: #1a1c1c; margin: 0 0 20px 0; font-size: 22px; font-weight: 700;">Convite para licenca OFFICE</h2>
                            <p style="margin: 0 0 16px 0; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                                <strong style="color: #18181b;">${safeInvitedByName}</strong> convidou voce para ocupar uma ${safeSeatsLabel} no BentiFiles.
                            </p>
                            <p style="margin: 0 0 32px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                                Use o link abaixo para aceitar o convite. Se voce ainda nao tiver conta, o cadastro e a validacao do e-mail acontecem no mesmo fluxo.
                            </p>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 32px;">
                                        <a href="${params.inviteLink}" style="display: inline-block; background-color: #fbbf24; color: #1a1c1c; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 8px; box-shadow: 0 2px 4px 0 rgba(251, 191, 36, 0.2); border: 1px solid #f59e0b;">
                                            Aceitar convite
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; border: 1px dashed #d4d4d8;">
                                <p style="margin: 0 0 8px 0; color: #52525b; font-size: 14px; text-align: center;">
                                    Se o botao nao funcionar, copie e cole o link abaixo no navegador:
                                </p>
                                <p style="margin: 0; color: #3b82f6; font-size: 13px; text-align: center; word-break: break-all; line-height: 1.5;">
                                    <a href="${params.inviteLink}" style="color: #3b82f6; text-decoration: underline;">${params.inviteLink}</a>
                                </p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9f9f9; border-top: 1px solid #e4e4e7; text-align: center;">
                            <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 1.5;">
                                Este convite expira em 72 horas.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        await sendEmail({
            to: params.email,
            subject: 'BentiFiles: convite para licenca OFFICE',
            html,
        });
    } catch (error) {
        console.error('Erro ao enviar email de convite OFFICE:', error);
        throw new Error('Falha no envio de e-mail de convite OFFICE');
    }
};

export const sendEndingReminderEmail = async (params: {
    email: string;
    name: string;
    expiresAt: Date;
    daysRemaining: 1 | 2;
    type: 'trial' | 'subscription';
}) => {
    try {
        const frontendUrl = getFrontendUrl();
        const billingUrl = new URL('/subscription', frontendUrl).toString();
        const safeName = escapeHtml(params.name);
        const periodLabel = params.type === 'trial' ? 'seu teste gratuito' : 'sua assinatura';
        const actionLabel = params.type === 'trial' ? 'Escolher um plano' : 'Gerenciar assinatura';
        const title = params.daysRemaining === 1
            ? `${periodLabel} termina amanha`
            : `${periodLabel} termina em ${params.daysRemaining} dias`;
        const formattedDate = params.expiresAt.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });

        const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: 'Space Grotesk', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f9f9f9; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #e4e4e7;">
                    <tr>
                        <td align="center" style="padding: 40px 0; background-color: #ffffff; border-bottom: 1px solid #e4e4e7;">
                            <img src="${frontendUrl}/logo.png" alt="BentiFiles Logo" height="40" style="display: block; max-width: 100%; height: 40px; margin: 0 auto; object-fit: contain;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 40px 30px 40px;">
                            <h2 style="color: #1a1c1c; margin: 0 0 20px 0; font-size: 22px; font-weight: 700;">Seu acesso esta perto do fim</h2>
                            <p style="margin: 0 0 16px 0; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                                Ola, <strong style="color: #18181b;">${safeName}</strong>!
                            </p>
                            <p style="margin: 0 0 16px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                                Este e-mail e um lembrete de que ${periodLabel} termina em <strong>${params.daysRemaining} ${params.daysRemaining === 1 ? 'dia' : 'dias'}</strong>.
                            </p>
                            <p style="margin: 0 0 32px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                                A data prevista de encerramento e <strong>${formattedDate}</strong>. Para continuar com acesso aos recursos da plataforma, recomendamos revisar isso agora.
                            </p>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 32px;">
                                        <a href="${billingUrl}" style="display: inline-block; background-color: #fbbf24; color: #1a1c1c; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 8px; box-shadow: 0 2px 4px 0 rgba(251, 191, 36, 0.2); border: 1px solid #f59e0b;">
                                            ${actionLabel}
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; border: 1px dashed #d4d4d8;">
                                <p style="margin: 0; color: #52525b; font-size: 14px; text-align: center; line-height: 1.6;">
                                    Se voce ja regularizou isso recentemente, pode desconsiderar esta mensagem.
                                </p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9f9f9; border-top: 1px solid #e4e4e7; text-align: center;">
                            <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 1.5;">
                                Equipe BentiFiles
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        await sendEmail({
            to: params.email,
            subject: `BentiFiles: ${title}`,
            html,
        });

        console.log(`[Reminder Email] ${params.type} ${params.daysRemaining}d sent to ${params.email}`);
    } catch (error) {
        console.error('Erro ao enviar email de lembrete:', error);
        throw new Error('Falha no envio de e-mail de lembrete');
    }
};
