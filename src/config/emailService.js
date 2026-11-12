const {
    obterClienteResend
} = require("./email");

/**
 * Remove barras do final do endereço.
 *
 * Exemplo:
 * http://localhost:4000/
 *
 * Resultado:
 * http://localhost:4000
 */
function obterUrlDoSite() {
    const url =
        process.env.PROD ||
        "http://localhost:4000";

    return url.replace(/\/+$/, "");
}

/**
 * Retorna o remetente configurado.
 *
 * O endereço onboarding@resend.dev deve ser usado
 * somente durante os primeiros testes do Resend.
 */
function obterRemetente() {
    return (
        process.env.EMAIL_FROM ||
        "MotorFlex <onboarding@resend.dev>"
    );
}

/**
 * Validação básica do destinatário.
 */
function validarEmail(email) {
    const valor =
        String(email || "")
            .trim()
            .toLowerCase();

    const formatoValido =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formatoValido.test(valor)) {
        throw new Error(
            "Endereço de e-mail inválido."
        );
    }

    return valor;
}

/**
 * Envia o e-mail de recuperação de senha.
 */
async function enviarEmailRecuperacao(
    destinatario,
    token
) {
    const email =
        validarEmail(destinatario);

    const tokenSeguro =
        encodeURIComponent(
            String(token || "")
        );

    if (!tokenSeguro) {
        throw new Error(
            "Token de recuperação não informado."
        );
    }

    const urlDoSite =
        obterUrlDoSite();

    const linkRecuperacao =
        `${urlDoSite}/pages/redefinir-senha.html?token=${tokenSeguro}`;

    const resend =
        obterClienteResend();

    try {
        const resultado =
            await resend.emails.send({
                from: obterRemetente(),

                to: [email],

                subject:
                    "Recuperação de Senha - MotorFlex",

                text: [
                    "MotorFlex",
                    "",
                    "Você solicitou a recuperação de senha da sua conta.",
                    "",
                    "Acesse o endereço abaixo para redefinir sua senha:",
                    linkRecuperacao,
                    "",
                    "Se você não solicitou isso, ignore este e-mail."
                ].join("\n"),

                html: `
                    <!DOCTYPE html>
                    <html lang="pt-BR">
                    <head>
                        <meta charset="UTF-8">
                        <meta
                            name="viewport"
                            content="width=device-width, initial-scale=1.0"
                        >
                        <title>
                            Recuperação de Senha
                        </title>
                    </head>

                    <body
                        style="
                            margin: 0;
                            padding: 20px;
                            background-color: #0b0b0e;
                            font-family: Arial, sans-serif;
                            color: #e1e1e6;
                        "
                    >
                        <div
                            style="
                                max-width: 560px;
                                margin: 0 auto;
                                padding: 30px;
                                background-color: #12121a;
                                border: 1px solid #27272f;
                                border-radius: 10px;
                            "
                        >
                            <h1
                                style="
                                    margin: 0 0 24px;
                                    color: #ff1e27;
                                    font-size: 28px;
                                "
                            >
                                Motor<span style="color: #ffffff;">Flex</span>
                            </h1>

                            <h2
                                style="
                                    margin: 0 0 16px;
                                    color: #ffffff;
                                    font-size: 20px;
                                "
                            >
                                Recuperação de senha
                            </h2>

                            <p
                                style="
                                    margin: 0 0 12px;
                                    line-height: 1.6;
                                "
                            >
                                Você solicitou a recuperação
                                de senha da sua conta.
                            </p>

                            <p
                                style="
                                    margin: 0 0 24px;
                                    line-height: 1.6;
                                "
                            >
                                Clique no botão abaixo para
                                escolher uma nova senha:
                            </p>

                            <a
                                href="${linkRecuperacao}"
                                style="
                                    display: inline-block;
                                    padding: 12px 20px;
                                    color: #ffffff;
                                    font-weight: bold;
                                    text-decoration: none;
                                    background-color: #ff1e27;
                                    border-radius: 6px;
                                "
                            >
                                Redefinir senha
                            </a>

                            <p
                                style="
                                    margin: 26px 0 0;
                                    color: #a0a0b2;
                                    font-size: 12px;
                                    line-height: 1.5;
                                "
                            >
                                Se você não solicitou esta
                                alteração, ignore este e-mail.
                            </p>

                            <p
                                style="
                                    margin: 12px 0 0;
                                    color: #71717f;
                                    font-size: 11px;
                                    line-height: 1.5;
                                    word-break: break-all;
                                "
                            >
                                Caso o botão não funcione,
                                copie e cole este endereço no
                                navegador:
                                <br>
                                ${linkRecuperacao}
                            </p>
                        </div>
                    </body>
                    </html>
                `
            });

        if (resultado.error) {
            const mensagem =
                resultado.error.message ||
                "O Resend recusou o envio.";

            throw new Error(mensagem);
        }

        console.log(
            "✅ E-mail de recuperação enviado."
        );

        return {
            sucesso: true,
            id: resultado.data?.id || null
        };
    } catch (erro) {
        // Não registra destinatário, token ou chave da API.
        console.error(
            "❌ Erro ao enviar e-mail pelo Resend:",
            erro.message
        );

        throw new Error(
            "Não foi possível enviar o e-mail de recuperação."
        );
    }
}

module.exports = {
    enviarEmailRecuperacao
};