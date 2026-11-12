const { Resend } = require("resend");

require("dotenv").config();

let clienteResend = null;

/**
 * Retorna o cliente do Resend.
 *
 * O cliente só é criado quando realmente for necessário
 * enviar um e-mail. Isso permite iniciar o projeto localmente
 * mesmo antes de configurar o Resend.
 */
function obterClienteResend() {
    const apiKey =
        process.env.RESEND_API_KEY;

    if (!apiKey) {
        throw new Error(
            "RESEND_API_KEY não foi configurada."
        );
    }

    if (!clienteResend) {
        clienteResend =
            new Resend(apiKey);
    }

    return clienteResend;
}

module.exports = {
    obterClienteResend
};