export const sendVerificationEmail = async (email: string, token: string, name: string) => {
    const frontendUrl = 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;
    const html = `
    <!-- Header -->
    <a href="${verifyUrl}">Confirmar meu E-mail</a>
    `;
    console.log(html);
}
sendVerificationEmail('test@email.com', '1234', 'Dudu');
