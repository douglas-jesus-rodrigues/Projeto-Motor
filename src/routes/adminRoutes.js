"use strict";

const express = require("express");
const bcrypt = require("bcrypt");

const router = express.Router();

const db = require("../config/db");
const authAdmin = require("../middlewares/authAdmin");

const INICIO_SERIE =
    "DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')";

const numero = (valor) => Number(valor) || 0;

// Evita ultrapassar o limite de conexões do Clever Cloud.
// Mesmo que Promise.all solicite várias consultas,
// elas serão executadas em sequência nessa rota.
let filaConsultas = Promise.resolve();

function consultar(sql, parametros = []) {
    const executar = async () => {
        const [resultado] = await db.query(
            sql,
            parametros
        );

        return resultado;
    };

    const consultaAtual = filaConsultas.then(
        executar,
        executar
    );

    filaConsultas = consultaAtual.then(
        () => undefined,
        () => undefined
    );

    return consultaAtual;
}

async function consultarUm(sql, parametros = []) {
    const linhas = await consultar(
        sql,
        parametros
    );

    return linhas[0] || {};
}

async function consultaOpcional(
    executor,
    padrao
) {
    try {
        return await executor();
    } catch (erro) {
        console.warn(
            "⚠️ Consulta opcional do painel:",
            erro.sqlMessage || erro.message
        );

        return padrao;
    }
}

function normalizarTipo(valor) {
    return String(valor || "")
        .trim()
        .toLowerCase();
}

function idDoAdmin(req) {
    return Number(
        req.usuario?.id ||
        req.usuario?.usuario_id ||
        req.session?.usuario?.id
    );
}

// ==========================================================
// CONTAGEM DAS CONVERSAS
// Compatível com a tabela mensagens atual.
// ==========================================================

async function contarConversas() {
    const consultas = [
        `
        SELECT COUNT(*) AS total
          FROM (
                SELECT
                    participante_menor_id,
                    participante_maior_id
                  FROM mensagens
                 GROUP BY
                    participante_menor_id,
                    participante_maior_id
          ) AS pares
        `,

        `
        SELECT COUNT(*) AS total
          FROM (
                SELECT
                    LEAST(
                        participante_1_id,
                        participante_2_id
                    ) AS menor,

                    GREATEST(
                        participante_1_id,
                        participante_2_id
                    ) AS maior

                  FROM mensagens

                 GROUP BY
                    menor,
                    maior
          ) AS pares
        `,

        `SELECT COUNT(*) AS total FROM conversas`,

        `SELECT COUNT(*) AS total FROM conversa`
    ];

    for (const sql of consultas) {
        try {
            const linha = await consultarUm(sql);

            return numero(linha.total);
        } catch {
            // Tenta a próxima estrutura disponível.
        }
    }

    return 0;
}

// ==========================================================
// ANÚNCIOS RECENTES
// ==========================================================

async function buscarAnunciosRecentes() {
    const consultas = [
        `
        SELECT
            v.id,
            v.preco,
            v.ano_fabricacao,
            v.ano_modelo,
            v.visualizacoes,
            v.criado_em,
            v.usuario_id,

            m.nome AS marca,
            mo.nome AS modelo,

            (
                SELECT f.imagem
                  FROM fotos_veiculos f
                 WHERE f.veiculo_id = v.id
                 ORDER BY
                    f.principal DESC,
                    f.id ASC
                 LIMIT 1
            ) AS imagem,

            CONCAT_WS(
                ' ',
                us.nome,
                us.sobrenome
            ) AS dono

          FROM veiculos v

          LEFT JOIN marca m
            ON m.id = v.marca_id

          LEFT JOIN modelo mo
            ON mo.id = v.modelo_id

          LEFT JOIN usuarios us
            ON us.id = v.usuario_id

         ORDER BY v.id DESC
         LIMIT 5
        `,

        `
        SELECT
            v.id,
            v.preco,
            v.ano_fabricacao,
            v.ano_modelo,
            v.visualizacoes,
            v.criado_em,
            v.usuario_id,

            m.nome AS marca,
            mo.nome AS modelo,

            NULL AS imagem,

            CONCAT_WS(
                ' ',
                us.nome,
                us.sobrenome
            ) AS dono

          FROM veiculos v

          LEFT JOIN marca m
            ON m.id = v.marca_id

          LEFT JOIN modelo mo
            ON mo.id = v.modelo_id

          LEFT JOIN usuarios us
            ON us.id = v.usuario_id

         ORDER BY v.id DESC
         LIMIT 5
        `
    ];

    for (const sql of consultas) {
        try {
            return await consultar(sql);
        } catch {
            // A segunda consulta funciona sem fotos.
        }
    }

    return [];
}

// ==========================================================
// GET /api/admin/resumo
// ==========================================================

router.get(
    "/resumo",
    authAdmin,
    async (req, res) => {
        try {
            const [
                usuarios,
                anuncios,
                empresasPendentes,
                denunciasPendentes,
                totalConversas,
                serieUsuarios,
                serieAnuncios,
                usuariosRecentes,
                anunciosRecentes
            ] = await Promise.all([
                consultarUm(`
                    SELECT
                        COUNT(*) AS total,

                        COALESCE(
                            SUM(tipo = 'individual'),
                            0
                        ) AS individual,

                        COALESCE(
                            SUM(tipo = 'empresa'),
                            0
                        ) AS empresa,

                        COALESCE(
                            SUM(tipo = 'admin'),
                            0
                        ) AS admin,

                        COALESCE(
                            SUM(status = 'ativo'),
                            0
                        ) AS ativos,

                        COALESCE(
                            SUM(status = 'bloqueado'),
                            0
                        ) AS bloqueados,

                        COALESCE(
                            SUM(
                                status IN (
                                    'inativo',
                                    'inactive_warning',
                                    'inactive_expired'
                                )
                            ),
                            0
                        ) AS inativos,

                        COALESCE(
                            SUM(
                                criado_em >=
                                DATE_SUB(
                                    NOW(),
                                    INTERVAL 30 DAY
                                )
                            ),
                            0
                        ) AS novos_30d

                      FROM usuarios

                     WHERE deleted_at IS NULL
                `),

                consultarUm(`
                    SELECT
                        COUNT(*) AS total,

                        COALESCE(
                            SUM(status_anuncio_id = 1),
                            0
                        ) AS ativos,

                        COALESCE(
                            SUM(visualizacoes),
                            0
                        ) AS visualizacoes,

                        COALESCE(
                            SUM(
                                criado_em >=
                                DATE_SUB(
                                    NOW(),
                                    INTERVAL 30 DAY
                                )
                            ),
                            0
                        ) AS novos_30d,

                        COALESCE(
                            SUM(
                                NOT EXISTS (
                                    SELECT 1
                                      FROM fotos_veiculos f
                                     WHERE
                                        f.veiculo_id =
                                        veiculos.id
                                )
                            ),
                            0
                        ) AS sem_foto

                      FROM veiculos
                `),

                consultaOpcional(
                    async () => {
                        const linha =
                            await consultarUm(`
                                SELECT
                                    COUNT(*) AS total
                                  FROM empresas
                                 WHERE
                                    status_verificacao =
                                    'pendente'
                            `);

                        return numero(linha.total);
                    },
                    0
                ),

                consultaOpcional(
                    async () => {
                        const linha =
                            await consultarUm(`
                                SELECT
                                    COUNT(*) AS total
                                  FROM denuncias
                                 WHERE status = 'pendente'
                            `);

                        return numero(linha.total);
                    },
                    0
                ),

                contarConversas(),

                consultar(`
                    SELECT
                        DATE_FORMAT(
                            criado_em,
                            '%Y-%m'
                        ) AS mes,

                        COUNT(*) AS total

                      FROM usuarios

                     WHERE deleted_at IS NULL
                       AND criado_em >= ${INICIO_SERIE}

                     GROUP BY
                        DATE_FORMAT(
                            criado_em,
                            '%Y-%m'
                        )

                     ORDER BY mes
                `),

                consultar(`
                    SELECT
                        DATE_FORMAT(
                            criado_em,
                            '%Y-%m'
                        ) AS mes,

                        COUNT(*) AS total

                      FROM veiculos

                     WHERE criado_em >= ${INICIO_SERIE}

                     GROUP BY
                        DATE_FORMAT(
                            criado_em,
                            '%Y-%m'
                        )

                     ORDER BY mes
                `),

                consultar(`
                    SELECT
                        id,
                        nome,
                        sobrenome,
                        email,
                        tipo,
                        status,
                        foto_perfil,
                        criado_em

                      FROM usuarios

                     WHERE deleted_at IS NULL

                     ORDER BY id DESC
                     LIMIT 5
                `),

                buscarAnunciosRecentes()
            ]);

            const usuariosPorMes =
                Object.fromEntries(
                    serieUsuarios.map(
                        (item) => [
                            item.mes,
                            numero(item.total)
                        ]
                    )
                );

            const anunciosPorMes =
                Object.fromEntries(
                    serieAnuncios.map(
                        (item) => [
                            item.mes,
                            numero(item.total)
                        ]
                    )
                );

            const serie = [];

            for (
                let indice = 5;
                indice >= 0;
                indice -= 1
            ) {
                const data = new Date();

                data.setDate(1);

                data.setMonth(
                    data.getMonth() - indice
                );

                const mes =
                    `${data.getFullYear()}-` +
                    `${String(
                        data.getMonth() + 1
                    ).padStart(2, "0")}`;

                serie.push({
                    mes,
                    usuarios:
                        usuariosPorMes[mes] || 0,
                    anuncios:
                        anunciosPorMes[mes] || 0
                });
            }

            res.set(
                "Cache-Control",
                "no-store, no-cache, must-revalidate"
            );

            return res.status(200).json({
                sucesso: true,

                gerado_em:
                    new Date().toISOString(),

                usuarios: {
                    total:
                        numero(usuarios.total),

                    individual:
                        numero(usuarios.individual),

                    empresa:
                        numero(usuarios.empresa),

                    admin:
                        numero(usuarios.admin),

                    ativos:
                        numero(usuarios.ativos),

                    bloqueados:
                        numero(usuarios.bloqueados),

                    inativos:
                        numero(usuarios.inativos),

                    novos_30d:
                        numero(usuarios.novos_30d)
                },

                anuncios: {
                    total:
                        numero(anuncios.total),

                    ativos:
                        numero(anuncios.ativos),

                    visualizacoes:
                        numero(
                            anuncios.visualizacoes
                        ),

                    novos_30d:
                        numero(anuncios.novos_30d),

                    sem_foto:
                        numero(anuncios.sem_foto)
                },

                pendencias: {
                    empresas_pendentes:
                        empresasPendentes,

                    denuncias_pendentes:
                        denunciasPendentes
                },

                conversas: {
                    total: totalConversas
                },

                serie,

                recentes: {
                    usuarios: usuariosRecentes,
                    anuncios: anunciosRecentes
                }
            });
        } catch (erro) {
            console.error(
                "❌ Erro em GET /api/admin/resumo:",
                erro.sqlMessage || erro
            );

            return res.status(500).json({
                sucesso: false,
                mensagem:
                    "Erro ao montar o resumo administrativo."
            });
        }
    }
);

// ==========================================================
// GET /api/admin/usuarios
// ==========================================================

router.get(
    "/usuarios",
    authAdmin,
    async (req, res) => {
        try {
            const usuarios = await consultar(`
                SELECT
                    id,
                    nome,
                    sobrenome,
                    email,
                    cpf,
                    tipo,
                    status,
                    foto_perfil,
                    criado_em

                  FROM usuarios

                 WHERE deleted_at IS NULL

                 ORDER BY id DESC
            `);

            return res.status(200).json({
                sucesso: true,
                usuarios
            });
        } catch (erro) {
            console.error(
                "❌ Erro ao listar usuários:",
                erro.sqlMessage || erro
            );

            return res.status(500).json({
                sucesso: false,
                erro:
                    "Erro ao buscar usuários."
            });
        }
    }
);

// ==========================================================
// PUT /api/admin/usuarios/:id/tipo
// ==========================================================

router.put(
    "/usuarios/:id/tipo",
    authAdmin,
    async (req, res) => {
        const usuarioId =
            Number(req.params.id);

        const tipo =
            normalizarTipo(req.body?.tipo);

        const senhaAdmin =
            String(
                req.body?.senhaAdmin || ""
            );

        const adminId = idDoAdmin(req);

        if (
            !Number.isInteger(usuarioId) ||
            usuarioId <= 0
        ) {
            return res.status(400).json({
                sucesso: false,
                erro:
                    "ID de usuário inválido."
            });
        }

        if (
            ![
                "admin",
                "empresa",
                "individual"
            ].includes(tipo)
        ) {
            return res.status(400).json({
                sucesso: false,
                erro:
                    "Tipo de acesso inválido."
            });
        }

        if (!senhaAdmin) {
            return res.status(400).json({
                sucesso: false,
                erro:
                    "Informe sua senha de administrador."
            });
        }

        if (!adminId) {
            return res.status(401).json({
                sucesso: false,
                erro:
                    "Sessão administrativa inválida."
            });
        }

        if (
            usuarioId === adminId &&
            tipo !== "admin"
        ) {
            return res.status(400).json({
                sucesso: false,
                erro:
                    "Você não pode remover seu próprio acesso administrativo."
            });
        }

        try {
            const admin =
                await consultarUm(
                    `
                    SELECT senha
                      FROM usuarios
                     WHERE id = ?
                       AND deleted_at IS NULL
                     LIMIT 1
                    `,
                    [adminId]
                );

            if (!admin.senha) {
                return res.status(404).json({
                    sucesso: false,
                    erro:
                        "Administrador não encontrado."
                });
            }

            const senhaCorreta =
                await bcrypt.compare(
                    senhaAdmin,
                    admin.senha
                );

            if (!senhaCorreta) {
                return res.status(401).json({
                    sucesso: false,
                    erro:
                        "Senha de administrador incorreta."
                });
            }

            const [resultado] =
                await db.query(
                    `
                    UPDATE usuarios
                       SET tipo = ?
                     WHERE id = ?
                       AND deleted_at IS NULL
                    `,
                    [tipo, usuarioId]
                );

            if (!resultado.affectedRows) {
                return res.status(404).json({
                    sucesso: false,
                    erro:
                        "Usuário não encontrado."
                });
            }

            return res.status(200).json({
                sucesso: true,
                mensagem:
                    "Tipo de acesso atualizado com sucesso."
            });
        } catch (erro) {
            console.error(
                "❌ Erro ao alterar tipo:",
                erro.sqlMessage || erro
            );

            return res.status(500).json({
                sucesso: false,
                erro:
                    "Erro interno ao atualizar o usuário."
            });
        }
    }
);

// ==========================================================
// DELETE /api/admin/usuarios/:id
// Exclusão lógica para não quebrar veículos e mensagens.
// ==========================================================

router.delete(
    "/usuarios/:id",
    authAdmin,
    async (req, res) => {
        const usuarioId =
            Number(req.params.id);

        const senhaAdmin =
            String(
                req.body?.senhaAdmin || ""
            );

        const adminId = idDoAdmin(req);

        if (
            !Number.isInteger(usuarioId) ||
            usuarioId <= 0
        ) {
            return res.status(400).json({
                sucesso: false,
                erro:
                    "ID de usuário inválido."
            });
        }

        if (!senhaAdmin) {
            return res.status(400).json({
                sucesso: false,
                erro:
                    "Informe sua senha de administrador."
            });
        }

        if (!adminId) {
            return res.status(401).json({
                sucesso: false,
                erro:
                    "Sessão administrativa inválida."
            });
        }

        if (usuarioId === adminId) {
            return res.status(400).json({
                sucesso: false,
                erro:
                    "Você não pode excluir sua própria conta administrativa."
            });
        }

        try {
            const admin =
                await consultarUm(
                    `
                    SELECT senha
                      FROM usuarios
                     WHERE id = ?
                       AND deleted_at IS NULL
                     LIMIT 1
                    `,
                    [adminId]
                );

            if (!admin.senha) {
                return res.status(404).json({
                    sucesso: false,
                    erro:
                        "Administrador não encontrado."
                });
            }

            const senhaCorreta =
                await bcrypt.compare(
                    senhaAdmin,
                    admin.senha
                );

            if (!senhaCorreta) {
                return res.status(401).json({
                    sucesso: false,
                    erro:
                        "Senha de administrador incorreta."
                });
            }

            const [resultado] =
                await db.query(
                    `
                    UPDATE usuarios
                       SET deleted_at = NOW()
                     WHERE id = ?
                       AND deleted_at IS NULL
                    `,
                    [usuarioId]
                );

            if (!resultado.affectedRows) {
                return res.status(404).json({
                    sucesso: false,
                    erro:
                        "Usuário não encontrado."
                });
            }

            return res.status(200).json({
                sucesso: true,
                mensagem:
                    "Usuário removido com sucesso."
            });
        } catch (erro) {
            console.error(
                "❌ Erro ao remover usuário:",
                erro.sqlMessage || erro
            );

            return res.status(500).json({
                sucesso: false,
                erro:
                    "Erro interno ao remover o usuário."
            });
        }
    }
);

module.exports = router;