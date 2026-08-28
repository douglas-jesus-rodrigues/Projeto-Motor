const resend = require("./email");

async function enviarEmailRecuperacao(destinatario, token) {
    const linkRecuperacao = `http://localhost:4000/pages/redefinir-senha.html?token=${token}`;

    try {
        const data = await resend.emails.send({
            from: 'MotorFlex <onboarding@resend.dev>',
            to: destinatario,
            subject: 'Recuperação de Senha - MotorFlex',
            html: `
                <div style="font-family: Arial, sans-serif; background-color: #12121a; color: #e1e1e6; padding: 30px; border-radius: 8px;">
                    <h2 style="color: #ff1e27;">Motor<span style="color: #ffffff;">Flex</span></h2>
                    <p>Você solicitou a recuperação de senha da sua conta.</p>
                    <p>Clique no botão abaixo para redefinir sua senha:</p>
                    <a href="${linkRecuperacao}" style="display: inline-block; padding: 12px 20px; background-color: #ff1e27; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px;">Redefinir Senha</a>
                    <p style="margin-top: 25px; font-size: 12px; color: #a0a0b2;">Se você não solicitou isso, ignore este e-mail.</p>
                </div>
            `,
        });

        return { sucesso: true, data };
    } catch (error) {
        console.error("Erro ao enviar e-mail via Resend:", error);
        throw error;
    }
}

module.exports = { enviarEmailRecuperacao };