"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const SALA_GLOBAL = "chat-global";
const TAMANHO_MAXIMO = 500;

// Máximo de cinco mensagens em dez segundos.
const LIMITE_MENSAGENS = 5;
const INTERVALO_LIMITE = 10 * 1000;

module.exports = function iniciarChatGlobal(io) {
    const conexoesPorUsuario = new Map();

    // ==========================================
    // AUTENTICAÇÃO DO SOCKET
    // ==========================================
    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!process.env.JWT_SECRET) {
            return next(
                new Error("JWT_SECRET não foi configurado.")
            );
        }

        if (!token) {
            return next(
                new Error("Faça login para entrar no chat.")
            );
        }

        try {
            const dadosToken = jwt.verify(
                token,
                process.env.JWT_SECRET
            );

            const usuarioId = Number(
                dadosToken.id ||
                dadosToken.usuario_id ||
                dadosToken._id
            );

            if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
                return next(
                    new Error("Usuário do token inválido.")
                );
            }

            const [usuarios] = await db.query(
                `SELECT
                    id,
                    nome,
                    sobrenome,
                    foto_perfil,
                    status
                 FROM usuarios
                 WHERE id = ?
                   AND deleted_at IS NULL
                 LIMIT 1`,
                [usuarioId]
            );

            const usuario = usuarios[0];

            if (!usuario) {
                return next(
                    new Error("Usuário não encontrado.")
                );
            }

            if (usuario.status === "bloqueado") {
                return next(
                    new Error("Este usuário está bloqueado.")
                );
            }

            socket.data.usuario = {
                id: usuario.id,

                nome: [
                    usuario.nome,
                    usuario.sobrenome
                ].filter(Boolean).join(" "),

                foto: usuario.foto_perfil || null
            };

            socket.data.mensagensRecentes = [];

            return next();
        } catch (erro) {
            if (erro.name === "TokenExpiredError") {
                return next(
                    new Error("Sua sessão expirou.")
                );
            }

            console.error(
                "Erro ao autenticar no chat:",
                erro.message
            );

            return next(
                new Error("Não foi possível autenticar no chat.")
            );
        }
    });

    // ==========================================
    // CONEXÕES DO CHAT
    // ==========================================
    io.on("connection", (socket) => {
        const usuario = socket.data.usuario;

        socket.join(SALA_GLOBAL);

        const quantidadeConexoes =
            conexoesPorUsuario.get(usuario.id) || 0;

        conexoesPorUsuario.set(
            usuario.id,
            quantidadeConexoes + 1
        );

        console.log(
            `💬 ${usuario.nome} entrou no chat global.`
        );

        enviarTotalOnline();

        // ======================================
        // RECEBER E DISTRIBUIR MENSAGENS
        // ======================================
        socket.on(
            "chat:mensagem",
            (dados, responder = () => {}) => {
                const agora = Date.now();

                socket.data.mensagensRecentes =
                    socket.data.mensagensRecentes.filter(
                        (momento) =>
                            agora - momento < INTERVALO_LIMITE
                    );

                if (
                    socket.data.mensagensRecentes.length >=
                    LIMITE_MENSAGENS
                ) {
                    return responder({
                        sucesso: false,
                        erro: "Você está enviando mensagens rápido demais."
                    });
                }

                const texto =
                    typeof dados?.texto === "string"
                        ? dados.texto.trim()
                        : "";

                if (!texto) {
                    return responder({
                        sucesso: false,
                        erro: "A mensagem não pode estar vazia."
                    });
                }

                if (texto.length > TAMANHO_MAXIMO) {
                    return responder({
                        sucesso: false,
                        erro: `A mensagem pode ter no máximo ${TAMANHO_MAXIMO} caracteres.`
                    });
                }

                socket.data.mensagensRecentes.push(agora);

                const mensagem = {
                    id: crypto.randomUUID(),
                    texto,
                    enviadaEm: new Date(agora).toISOString(),

                    usuario: {
                        id: usuario.id,
                        nome: usuario.nome,
                        foto: usuario.foto
                    }
                };

                // Envia para todos que estão na sala,
                // incluindo quem enviou.
                io.to(SALA_GLOBAL).emit(
                    "chat:mensagem",
                    mensagem
                );

                return responder({
                    sucesso: true,
                    id: mensagem.id
                });
            }
        );

        // ======================================
        // DESCONEXÃO
        // ======================================
        socket.on("disconnect", () => {
            const quantidade =
                (conexoesPorUsuario.get(usuario.id) || 1) - 1;

            if (quantidade <= 0) {
                conexoesPorUsuario.delete(usuario.id);
            } else {
                conexoesPorUsuario.set(
                    usuario.id,
                    quantidade
                );
            }

            console.log(
                `💬 ${usuario.nome} saiu do chat global.`
            );

            enviarTotalOnline();
        });
    });

    function enviarTotalOnline() {
        io.to(SALA_GLOBAL).emit("chat:presenca", {
            online: conexoesPorUsuario.size
        });
    }
};