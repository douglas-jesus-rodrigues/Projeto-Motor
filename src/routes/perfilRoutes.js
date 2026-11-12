const express = require("express");

const router = express.Router();

const db = require("../config/db");

const authUser = require(
    "../middlewares/authMiddleware"
);

// ==========================================
// GET /api/perfil/meu-perfil
// ==========================================
//
// Retorna somente o perfil do usuário
// identificado pelo JWT.
//
// O ID não é mais recebido pela URL.
// ==========================================
router.get(
    "/meu-perfil",
    authUser,
    async (req, res) => {
        const usuarioId = Number(
            req.usuario?.id
        );

        if (
            !Number.isInteger(
                usuarioId
            ) ||
            usuarioId <= 0
        ) {
            return res
                .status(401)
                .json({
                    sucesso: false,

                    mensagem:
                        "Usuário não autenticado."
                });
        }

        try {
            // Seleciona somente os campos
            // que podem ser enviados ao usuário.
            const [usuarios] =
                await db.query(
                    `
                        SELECT
                            id,
                            nome,
                            sobrenome,
                            email,
                            telefone,
                            cpf,
                            tipo,
                            foto_perfil,
                            status,
                            email_verificado,
                            ultimo_login,
                            criado_em,
                            atualizado_em,
                            cargo
                        FROM usuarios
                        WHERE id = ?
                          AND deleted_at IS NULL
                        LIMIT 1
                    `,
                    [usuarioId]
                );

            const usuario =
                usuarios[0];

            if (!usuario) {
                return res
                    .status(404)
                    .json({
                        sucesso: false,

                        mensagem:
                            "Usuário não encontrado."
                    });
            }

            // Compatibilidade com partes do frontend
            // que utilizam o nome fotoUrl.
            usuario.fotoUrl =
                usuario.foto_perfil ||
                null;

            // Valor padrão.
            usuario.endereco = null;

            // ==================================
            // DADOS DA EMPRESA
            // ==================================
            if (
                String(
                    usuario.tipo
                ).toLowerCase() ===
                "empresa"
            ) {
                try {
                    const [empresas] =
                        await db.query(
                            `
                                SELECT
                                    cnpj,
                                    nome_empresa,
                                    razao_social,
                                    inscricao_estadual,
                                    site,
                                    status_verificacao,
                                    motivo_recusa
                                FROM empresas
                                WHERE usuario_id = ?
                                LIMIT 1
                            `,
                            [usuarioId]
                        );

                    if (empresas[0]) {
                        Object.assign(
                            usuario,
                            empresas[0]
                        );
                    }
                } catch (erroEmpresa) {
                    console.error(
                        "[perfil] Erro ao carregar empresa:",
                        erroEmpresa.code ||
                        erroEmpresa.message
                    );
                }
            }

            // ==================================
            // ENDEREÇO
            // ==================================
            try {
                const [enderecos] =
                    await db.query(
                        `
                            SELECT
                                cep,
                                estado,
                                cidade,
                                bairro,
                                rua,
                                numero,
                                complemento
                            FROM enderecos
                            WHERE usuario_id = ?
                            ORDER BY id DESC
                            LIMIT 1
                        `,
                        [usuarioId]
                    );

                if (enderecos[0]) {
                    usuario.endereco = {
                        cep:
                            enderecos[0]
                                .cep ||
                            null,

                        estado:
                            enderecos[0]
                                .estado ||
                            null,

                        cidade:
                            enderecos[0]
                                .cidade ||
                            null,

                        bairro:
                            enderecos[0]
                                .bairro ||
                            null,

                        rua:
                            enderecos[0]
                                .rua ||
                            null,

                        numero:
                            enderecos[0]
                                .numero ||
                            null,

                        complemento:
                            enderecos[0]
                                .complemento ||
                            null
                    };
                }
            } catch (erroEndereco) {
                console.error(
                    "[perfil] Erro ao carregar endereço:",
                    erroEndereco.code ||
                    erroEndereco.message
                );

                usuario.endereco = null;
            }

            return res
                .status(200)
                .json({
                    sucesso: true,
                    usuario
                });
        } catch (erro) {
            console.error(
                "[perfil] Erro ao carregar perfil:",
                erro.code ||
                erro.message
            );

            return res
                .status(500)
                .json({
                    sucesso: false,

                    mensagem:
                        "Erro ao buscar os dados do perfil."
                });
        }
    }
);

module.exports = router;