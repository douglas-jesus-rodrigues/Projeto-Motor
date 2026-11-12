"use strict";

const jwt = require("jsonwebtoken");

// ==========================================
// EXTRAIR TOKEN DA CONEXÃO
// ==========================================
function extrairToken(socket) {
    const tokenAuth =
        socket.handshake.auth?.token;

    if (
        typeof tokenAuth === "string" &&
        tokenAuth.trim()
    ) {
        return tokenAuth
            .trim()
            .replace(
                /^Bearer\s+/i,
                ""
            );
    }

    const cabecalho =
        socket.handshake.headers
            ?.authorization;

    if (
        typeof cabecalho === "string" &&
        cabecalho.startsWith("Bearer ")
    ) {
        return cabecalho
            .slice(7)
            .trim();
    }

    return null;
}

// ==========================================
// OBTER ID DO TOKEN
// ==========================================
function obterUsuarioId(
    decodificado
) {
    const id = Number(
        decodificado?.id ||
        decodificado?._id ||
        decodificado?.usuario_id
    );

    return (
        Number.isInteger(id) &&
        id > 0
    )
        ? id
        : null;
}

// ==========================================
// NOME DA SALA DO USUÁRIO
// ==========================================
function salaDoUsuario(
    usuarioId
) {
    return `usuario:${Number(usuarioId)}`;
}

// ==========================================
// INICIAR SOCKET PRIVADO
// ==========================================
function iniciarChatPrivado(io) {
    if (!io) {
        throw new Error(
            "Instância do Socket.IO não fornecida."
        );
    }

    // ======================================
    // AUTENTICAÇÃO DA CONEXÃO
    // ======================================
    io.use((socket, next) => {
        const token =
            extrairToken(socket);

        if (!token) {
            const erro = new Error(
                "Token de autenticação não fornecido."
            );

            erro.data = {
                codigo: "TOKEN_AUSENTE"
            };

            return next(erro);
        }

        try {
            const segredo =
                process.env.JWT_SECRET ||
                "motorflex_secret_key";

            const decodificado =
                jwt.verify(
                    token,
                    segredo
                );

            const usuarioId =
                obterUsuarioId(
                    decodificado
                );

            if (!usuarioId) {
                const erro = new Error(
                    "Token sem usuário válido."
                );

                erro.data = {
                    codigo:
                        "USUARIO_INVALIDO"
                };

                return next(erro);
            }

            /*
             * O usuário do socket vem somente
             * do token validado.
             */
            socket.usuario = {
                ...decodificado,
                id: usuarioId
            };

            return next();
        } catch (erroJwt) {
            const mensagem =
                erroJwt.name ===
                "TokenExpiredError"
                    ? "Sessão expirada. Faça login novamente."
                    : "Token de autenticação inválido.";

            const erro =
                new Error(mensagem);

            erro.data = {
                codigo:
                    erroJwt.name ===
                    "TokenExpiredError"
                        ? "TOKEN_EXPIRADO"
                        : "TOKEN_INVALIDO"
            };

            return next(erro);
        }
    });

    // ======================================
    // CONEXÃO AUTENTICADA
    // ======================================
    io.on(
        "connection",
        (socket) => {
            const usuarioId =
                Number(
                    socket.usuario.id
                );

            const sala =
                salaDoUsuario(
                    usuarioId
                );

            /*
             * O cliente não escolhe sua sala.
             * Ela é criada usando o ID do token.
             */
            socket.join(sala);

            socket.emit(
                "privado:conectado",
                {
                    sucesso: true,
                    usuario_id:
                        usuarioId
                }
            );
        }
    );

    console.log(
        "🔒 Socket.IO privado autenticado e preparado."
    );
}

module.exports =
    iniciarChatPrivado;

module.exports.salaDoUsuario =
    salaDoUsuario;