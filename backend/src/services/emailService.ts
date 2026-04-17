import nodemailer from 'nodemailer';

export const sendVerificationEmail = async (email: string, token: string, name: string) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.ethereal.email',
            port: Number(process.env.SMTP_PORT) || 465,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        if (!frontendUrl.startsWith('http')) {
            frontendUrl = `https://${frontendUrl}`;
        }
        const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

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
                    <!-- Header -->
                    <tr>
                        <td align="center" style="padding: 40px 0; background-color: #ffffff; border-bottom: 1px solid #e4e4e7;">
                            <img src="${frontendUrl}/logo.png" alt="BentiFiles Logo" height="40" style="display: block; max-width: 100%; height: 40px; margin: 0 auto; object-fit: contain;" />
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 40px 30px 40px;">
                            <h2 style="color: #1a1c1c; margin: 0 0 20px 0; font-size: 22px; font-weight: 700;">Confirme seu E-mail</h2>
                            
                            <p style="margin: 0 0 16px 0; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                                Olá, <strong style="color: #18181b;">${name}</strong>!
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

        await transporter.sendMail({
            from: `"BentiFiles" <${process.env.SMTP_USER || 'noreply@bentifiles.com'}>`, 
            to: email, 
            subject: 'BentiFiles: Confirme seu E-mail',
            html: html, 
        });

        console.log(`Email de verificação enviado para ${email}`);
    } catch (error) {
        console.error('Erro ao enviar email de verificação:', error);
        throw new Error('Falha no envio de e-mail');
    }
};
