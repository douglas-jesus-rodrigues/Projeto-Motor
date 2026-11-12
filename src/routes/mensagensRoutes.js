"use strict";

const express = require("express");
const router = express.Router();
const db = require("../config/db");
const authUser = require("../middlewares/authMiddleware");

const {
    salaDoUsuario
} = require("../sockets/chatPrivado");

const LIMITE_MENSAGEM = 2000;
const LIMITE_RESULTADOS_BUSCA = 20;

// ==========================================================
// FUNÇÕES AUXILIARES
// ==========================================================

function inteiroPositivo(valor) {
    const numero = Number(valor);

    return Number.isInteger(numero) && numero > 0
        ? numero
        : null;
}

function prepararTexto(valor) {
    return String(valor || "").trim();
}

function prepararTermoBusca(valor) {
    return String(valor || "")
        .replace(/[%_\\]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
}

function resumoMensagem(texto) {
    return String(texto || "").slice(0, 255);
}

function emitirParaUsuarios(req, usuariosIds, evento, dados) {
    const io = req.app.get("io");

    if (!io) return;

    const idsUnicos = [
        ...new Set(
            usuariosIds
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )
    ];

    idsUnicos.forEach((usuarioId) => {
        io
            .to(salaDoUsuario(usuarioId))
            .emit(evento, dados);
    });
}

// ==========================================================
// GET /api/conversas
// LISTAR AS CONVERSAS DO USUÁRIO
// ==========================================================

router.get("/", authUser, async (req, res) => {
    const meuId = Number(req.usuario.id);

    try {
        const [conversas] = await db.query(
            `SELECT
                c.id,
                c.veiculo_id,
                c.status,
                c.criado_em,

                ultima.texto AS ultima_mensagem,
                ultima.criado_em AS ultimo_envio,
                ultima.remetente_id AS ultimo_remetente_id,

                IF(
                    c.participante_1_id = ?,
                    c.participante_2_id,
                    c.participante_1_id
                ) AS outro_usuario_id,

                CASE
                    WHEN u.tipo = 'empresa'
                    THEN COALESCE(
                        NULLIF(emp.nome_empresa, ''),
                        CONCAT_WS(' ', u.nome, u.sobrenome)
                    )
                    ELSE CONCAT_WS(' ', u.nome, u.sobrenome)
                END AS outro_usuario_nome,

                u.tipo AS outro_usuario_tipo,
                u.foto_perfil,
                u.foto_perfil AS outro_usuario_foto,

                v.preco AS veiculo_preco,
                mar.nome AS veiculo_marca,
                mo.nome AS veiculo_modelo

             FROM mensagens c

             JOIN usuarios u
               ON u.id = IF(
                    c.participante_1_id = ?,
                    c.participante_2_id,
                    c.participante_1_id
               )

             LEFT JOIN empresas emp
               ON emp.usuario_id = u.id

             LEFT JOIN mensagens_conversa ultima
               ON ultima.id = (
                    SELECT mc.id

                    FROM mensagens_conversa mc

                    LEFT JOIN mensagens_exclusoes me
                      ON me.mensagem_id = mc.id
                     AND me.usuario_id = ?

                    WHERE mc.conversa_id = c.id
                      AND mc.excluida_para_todos = 0
                      AND me.mensagem_id IS NULL
                      AND mc.criado_em >= NOW() - INTERVAL 10 DAY

                    ORDER BY
                        mc.criado_em DESC,
                        mc.id DESC

                    LIMIT 1
               )

             LEFT JOIN veiculos v
               ON v.id = c.veiculo_id

             LEFT JOIN marca mar
               ON mar.id = v.marca_id

             LEFT JOIN modelo mo
               ON mo.id = v.modelo_id

             WHERE (
                    c.participante_1_id = ?
                    OR c.participante_2_id = ?
             )

             AND c.status <> 'bloqueada'

             ORDER BY
                COALESCE(
                    ultima.criado_em,
                    c.ultimo_envio,
                    c.criado_em
                ) DESC,
                c.id DESC`,
            [
                meuId,
                meuId,
                meuId,
                meuId,
                meuId
            ]
        );

        return res.status(200).json({
            sucesso: true,
            conversas
        });
    } catch (erro) {
        console.error(
            "❌ Erro ao buscar conversas:",
            erro.sqlMessage || erro
        );

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao buscar conversas."
        });
    }
});

// ==========================================================
// GET /api/conversas/usuarios/buscar?termo=nome
// PESQUISAR PESSOAS E EMPRESAS
// ==========================================================

router.get("/usuarios/buscar", authUser, async (req, res) => {
    const meuId = Number(req.usuario.id);

    const termo = prepararTermoBusca(
        req.query.termo || req.query.q
    );

    if (termo.length < 2) {
        return res.status(400).json({
            sucesso: false,
            erro: "Digite pelo menos dois caracteres."
        });
    }

    const termoLike = `%${termo}%`;
    const termoInicial = `${termo}%`;

    try {
        const [usuarios] = await db.query(
            `SELECT
                u.id,

                CASE
                    WHEN u.tipo = 'empresa'
                    THEN COALESCE(
                        NULLIF(emp.nome_empresa, ''),
                        CONCAT_WS(' ', u.nome, u.sobrenome)
                    )
                    ELSE CONCAT_WS(' ', u.nome, u.sobrenome)
                END AS nome,

                CONCAT_WS(
                    ' ',
                    u.nome,
                    u.sobrenome
                ) AS nome_usuario,

                emp.nome_empresa,
                u.tipo,
                u.foto_perfil

             FROM usuarios u

             LEFT JOIN empresas emp
               ON emp.usuario_id = u.id

             WHERE u.id <> ?
               AND u.deleted_at IS NULL
               AND u.status = 'ativo'

               AND (
                    u.nome LIKE ?
                    OR u.sobrenome LIKE ?
                    OR CONCAT_WS(
                        ' ',
                        u.nome,
                        u.sobrenome
                    ) LIKE ?
                    OR emp.nome_empresa LIKE ?
               )

             ORDER BY
                CASE
                    WHEN u.nome LIKE ? THEN 0
                    WHEN u.sobrenome LIKE ? THEN 1
                    WHEN emp.nome_empresa LIKE ? THEN 2
                    ELSE 3
                END,

                CASE
                    WHEN u.tipo = 'empresa'
                    THEN COALESCE(
                        NULLIF(emp.nome_empresa, ''),
                        CONCAT_WS(' ', u.nome, u.sobrenome)
                    )
                    ELSE CONCAT_WS(' ', u.nome, u.sobrenome)
                END ASC

             LIMIT ${LIMITE_RESULTADOS_BUSCA}`,
            [
                meuId,
                termoLike,
                termoLike,
                termoLike,
                termoLike,
                termoInicial,
                termoInicial,
                termoInicial
            ]
        );

        return res.status(200).json({
            sucesso: true,
            total: usuarios.length,
            usuarios
        });
    } catch (erro) {
        console.error(
            "❌ Erro ao pesquisar contas:",
            erro.sqlMessage || erro
        );

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao pesquisar contas."
        });
    }
});

// ==========================================================
// POST /api/conversas/iniciar-direta
// CRIAR OU REUTILIZAR UMA CONVERSA SEM VEÍCULO
//
// Body:
// {
//     "destinatario_id": 15
// }
// ==========================================================

router.post("/iniciar-direta", authUser, async (req, res) => {
    const meuId = Number(req.usuario.id);

    const destinatarioId = inteiroPositivo(
        req.body.destinatario_id
    );

    if (!destinatarioId) {
        return res.status(400).json({
            sucesso: false,
            erro: "Conta destinatária inválida."
        });
    }

    if (destinatarioId === meuId) {
        return res.status(400).json({
            sucesso: false,
            erro: "Você não pode conversar com a própria conta."
        });
    }

    let conexao;

    try {
        conexao = await db.getConnection();
        await conexao.beginTransaction();

        const [destinatarios] = await conexao.query(
            `SELECT
                u.id,
                u.nome,
                u.sobrenome,
                u.tipo,
                u.foto_perfil,
                emp.nome_empresa

             FROM usuarios u

             LEFT JOIN empresas emp
               ON emp.usuario_id = u.id

             WHERE u.id = ?
               AND u.deleted_at IS NULL
               AND u.status = 'ativo'

             LIMIT 1

             FOR UPDATE`,
            [destinatarioId]
        );

        if (destinatarios.length === 0) {
            await conexao.rollback();

            return res.status(404).json({
                sucesso: false,
                erro: "Conta não encontrada ou indisponível."
            });
        }

        const [existentes] = await conexao.query(
            `SELECT id

             FROM mensagens

             WHERE participante_menor_id = LEAST(?, ?)
               AND participante_maior_id = GREATEST(?, ?)
               AND veiculo_chave = 0

             LIMIT 1

             FOR UPDATE`,
            [
                meuId,
                destinatarioId,
                meuId,
                destinatarioId
            ]
        );

        let conversaId;
        let conversaCriada = false;

        if (existentes.length > 0) {
            conversaId = Number(existentes[0].id);

            await conexao.query(
                `UPDATE mensagens

                 SET status = 'aberta',
                     excluido_para_todos = 0,
                     excluido_para_usuario_id = NULL

                 WHERE id = ?`,
                [conversaId]
            );
        } else {
            const [novaConversa] = await conexao.query(
                `INSERT INTO mensagens (
                    participante_1_id,
                    participante_2_id,
                    veiculo_id,
                    ultima_mensagem,
                    total_mensagens,
                    status,
                    criado_em,
                    ultimo_envio,
                    excluido_para_todos,
                    excluido_para_usuario_id
                 )
                 VALUES (
                    ?,
                    ?,
                    NULL,
                    NULL,
                    0,
                    'aberta',
                    NOW(),
                    NULL,
                    0,
                    NULL
                 )`,
                [
                    meuId,
                    destinatarioId
                ]
            );

            conversaId = Number(
                novaConversa.insertId
            );

            conversaCriada = true;
        }

        await conexao.commit();

        const destinatario = destinatarios[0];

        const nomeDestinatario =
            destinatario.tipo === "empresa"
                ? (
                    destinatario.nome_empresa ||
                    [
                        destinatario.nome,
                        destinatario.sobrenome
                    ]
                        .filter(Boolean)
                        .join(" ")
                )
                : [
                    destinatario.nome,
                    destinatario.sobrenome
                ]
                    .filter(Boolean)
                    .join(" ");

        emitirParaUsuarios(
            req,
            [
                meuId,
                destinatarioId
            ],
            "privado:conversa_atualizada",
            {
                conversa_id: conversaId,
                criado_por: meuId
            }
        );

        return res
            .status(conversaCriada ? 201 : 200)
            .json({
                sucesso: true,
                conversa_id: conversaId,
                conversa_criada: conversaCriada,

                destinatario: {
                    id: destinatarioId,
                    nome:
                        nomeDestinatario ||
                        "Usuário",
                    tipo:
                        destinatario.tipo,
                    foto_perfil:
                        destinatario.foto_perfil
                },

                mensagem: conversaCriada
                    ? "Conversa iniciada com sucesso."
                    : "Conversa existente aberta."
            });
    } catch (erro) {
        if (conexao) {
            try {
                await conexao.rollback();
            } catch (erroRollback) {
                console.error(
                    "❌ Erro ao desfazer transação:",
                    erroRollback.message
                );
            }
        }

        console.error(
            "❌ Erro ao iniciar conversa direta:",
            erro.sqlMessage || erro
        );

        if (
            erro.code === "ER_DUP_ENTRY" ||
            erro.errno === 1062
        ) {
            try {
                const [existentes] = await db.query(
                    `SELECT id

                     FROM mensagens

                     WHERE participante_menor_id = LEAST(?, ?)
                       AND participante_maior_id = GREATEST(?, ?)
                       AND veiculo_chave = 0

                     LIMIT 1`,
                    [
                        meuId,
                        destinatarioId,
                        meuId,
                        destinatarioId
                    ]
                );

                if (existentes.length > 0) {
                    return res.status(200).json({
                        sucesso: true,
                        conversa_id: Number(
                            existentes[0].id
                        ),
                        conversa_criada: false,
                        mensagem:
                            "Conversa existente aberta."
                    });
                }
            } catch (erroBusca) {
                console.error(
                    "❌ Erro ao recuperar conversa duplicada:",
                    erroBusca.sqlMessage ||
                    erroBusca
                );
            }
        }

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao iniciar a conversa."
        });
    } finally {
        if (conexao) {
            conexao.release();
        }
    }
});

// ==========================================================
// GET /api/conversas/:id/mensagens
// CARREGAR HISTÓRICO DOS ÚLTIMOS 10 DIAS
// ==========================================================

router.get("/:id/mensagens", authUser, async (req, res) => {
    const conversaId = inteiroPositivo(
        req.params.id
    );

    const meuId = Number(req.usuario.id);

    if (!conversaId) {
        return res.status(400).json({
            sucesso: false,
            erro: "ID da conversa inválido."
        });
    }

    try {
        const [participacao] = await db.query(
            `SELECT id

             FROM mensagens

             WHERE id = ?

             AND (
                    participante_1_id = ?
                    OR participante_2_id = ?
             )

             LIMIT 1`,
            [
                conversaId,
                meuId,
                meuId
            ]
        );

        if (participacao.length === 0) {
            return res.status(404).json({
                sucesso: false,
                erro:
                    "Conversa não encontrada ou sem permissão."
            });
        }

        const [mensagens] = await db.query(
            `SELECT
                    mc.id,
                    mc.conversa_id,
                    mc.texto,
                    mc.criado_em,
                    mc.lida_em,
                    mc.remetente_id,

                (
                    mc.remetente_id = ?
                ) AS enviada_por_mim

             FROM mensagens_conversa mc

             LEFT JOIN mensagens_exclusoes me
               ON me.mensagem_id = mc.id
              AND me.usuario_id = ?

             WHERE mc.conversa_id = ?
               AND mc.excluida_para_todos = 0
               AND me.mensagem_id IS NULL
               AND mc.criado_em >=
                   NOW() - INTERVAL 10 DAY

             ORDER BY
                mc.criado_em ASC,
                mc.id ASC`,
            [
                meuId,
                meuId,
                conversaId
            ]
        );

        return res.status(200).json({
            sucesso: true,
            mensagens
        });
    } catch (erro) {
        console.error(
            "❌ Erro ao buscar mensagens:",
            erro.sqlMessage || erro
        );

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao carregar mensagens."
        });
    }
});


// ==========================================
// GET /api/conversas/nao-lidas/resumo
// RETORNAR CONTADORES DE MENSAGENS NÃO LIDAS
// ==========================================

router.get(
    "/nao-lidas/resumo",
    authUser,
    async (req, res) => {
        const meuId = Number(
            req.usuario.id
        );

        try {
            const [resultados] =
                await db.query(
                    `SELECT
                        c.id AS conversa_id,
                        COUNT(mc.id) AS total_nao_lidas

                     FROM mensagens c

                     JOIN mensagens_conversa mc
                       ON mc.conversa_id = c.id

                     LEFT JOIN mensagens_exclusoes me
                       ON me.mensagem_id = mc.id
                      AND me.usuario_id = ?

                     WHERE (
                            c.participante_1_id = ?
                            OR c.participante_2_id = ?
                     )

                     AND mc.remetente_id <> ?
                     AND mc.lida_em IS NULL
                     AND mc.excluida_para_todos = 0
                     AND me.mensagem_id IS NULL
                     AND mc.criado_em >=
                         NOW() - INTERVAL 10 DAY

                     GROUP BY c.id

                     ORDER BY c.id DESC`,
                    [
                        meuId,
                        meuId,
                        meuId,
                        meuId
                    ]
                );

            const conversas =
                resultados.map(
                    (item) => ({
                        conversa_id:
                            Number(
                                item.conversa_id
                            ),

                        total_nao_lidas:
                            Number(
                                item.total_nao_lidas
                            )
                    })
                );

            const totalGeral =
                conversas.reduce(
                    (
                        acumulado,
                        conversa
                    ) =>
                        acumulado +
                        conversa.total_nao_lidas,
                    0
                );

            return res
                .status(200)
                .json({
                    sucesso: true,
                    total_nao_lidas:
                        totalGeral,
                    conversas
                });
        } catch (erro) {
            console.error(
                "❌ Erro ao contar mensagens não lidas:",
                erro.sqlMessage ||
                erro
            );

            return res
                .status(500)
                .json({
                    sucesso: false,
                    erro:
                        "Erro ao contar mensagens não lidas."
                });
        }
    }
);

// ==========================================
// POST /api/conversas/:id/ler
// MARCAR MENSAGENS RECEBIDAS COMO LIDAS
// ==========================================

router.post(
    "/:id/ler",
    authUser,
    async (req, res) => {
        const conversaId =
            inteiroPositivo(
                req.params.id
            );

        const meuId = Number(
            req.usuario.id
        );

        if (!conversaId) {
            return res
                .status(400)
                .json({
                    sucesso: false,
                    erro:
                        "ID da conversa inválido."
                });
        }

        try {
            const [participantes] =
                await db.query(
                    `SELECT
                        participante_1_id,
                        participante_2_id

                     FROM mensagens

                     WHERE id = ?

                     AND (
                            participante_1_id = ?
                            OR participante_2_id = ?
                     )

                     LIMIT 1`,
                    [
                        conversaId,
                        meuId,
                        meuId
                    ]
                );

            if (
                participantes.length ===
                0
            ) {
                return res
                    .status(404)
                    .json({
                        sucesso: false,
                        erro:
                            "Conversa não encontrada ou sem permissão."
                    });
            }

            const [resultado] =
                await db.query(
                    `UPDATE mensagens_conversa mc

                     SET mc.lida_em = NOW()

                     WHERE mc.conversa_id = ?
                       AND mc.remetente_id <> ?
                       AND mc.lida_em IS NULL
                       AND mc.excluida_para_todos = 0`,
                    [
                        conversaId,
                        meuId
                    ]
                );

            const participante1Id =
                Number(
                    participantes[0]
                        .participante_1_id
                );

            const participante2Id =
                Number(
                    participantes[0]
                        .participante_2_id
                );

            if (
                resultado.affectedRows >
                0
            ) {
                emitirParaUsuarios(
                    req,

                    [
                        participante1Id,
                        participante2Id
                    ],

                    "privado:mensagens_lidas",

                    {
                        conversa_id:
                            conversaId,

                        usuario_id:
                            meuId,

                        quantidade:
                            Number(
                                resultado
                                    .affectedRows
                            )
                    }
                );
            }

            return res
                .status(200)
                .json({
                    sucesso: true,

                    mensagens_marcadas:
                        Number(
                            resultado
                                .affectedRows
                        )
                });
        } catch (erro) {
            console.error(
                "❌ Erro ao marcar mensagens como lidas:",
                erro.sqlMessage ||
                erro
            );

            return res
                .status(500)
                .json({
                    sucesso: false,
                    erro:
                        "Erro ao marcar mensagens como lidas."
                });
        }
    }
);

// ==========================================================
// POST /api/conversas/iniciar
// CRIAR CONVERSA PELO VEÍCULO E ENVIAR MENSAGEM
// ==========================================================

router.post("/iniciar", authUser, async (req, res) => {
    const meuId = Number(req.usuario.id);

    const veiculoId = inteiroPositivo(
        req.body.veiculo_id
    );

    const texto = prepararTexto(
        req.body.texto
    );

    if (!veiculoId) {
        return res.status(400).json({
            sucesso: false,
            erro: "ID do veículo inválido."
        });
    }

    if (!texto) {
        return res.status(400).json({
            sucesso: false,
            erro: "A mensagem não pode estar vazia."
        });
    }

    if (texto.length > LIMITE_MENSAGEM) {
        return res.status(400).json({
            sucesso: false,
            erro:
                `A mensagem pode ter no máximo ${LIMITE_MENSAGEM} caracteres.`
        });
    }

    let conexao;

    try {
        conexao = await db.getConnection();
        await conexao.beginTransaction();

        const [veiculos] = await conexao.query(
            `SELECT
                id,
                usuario_id

             FROM veiculos

             WHERE id = ?

             LIMIT 1

             FOR UPDATE`,
            [veiculoId]
        );

        if (veiculos.length === 0) {
            await conexao.rollback();

            return res.status(404).json({
                sucesso: false,
                erro: "Veículo não encontrado."
            });
        }

        const anuncianteId = Number(
            veiculos[0].usuario_id
        );

        if (anuncianteId === meuId) {
            await conexao.rollback();

            return res.status(400).json({
                sucesso: false,
                erro:
                    "Você não pode enviar uma mensagem para o próprio anúncio."
            });
        }

        const [existentes] = await conexao.query(
            `SELECT id

             FROM mensagens

             WHERE participante_menor_id = LEAST(?, ?)
               AND participante_maior_id = GREATEST(?, ?)
               AND veiculo_chave = ?

             LIMIT 1

             FOR UPDATE`,
            [
                meuId,
                anuncianteId,
                meuId,
                anuncianteId,
                veiculoId
            ]
        );

        let conversaId;
        let statusHttp;

        if (existentes.length > 0) {
            conversaId = Number(
                existentes[0].id
            );

            statusHttp = 200;
        } else {
            const [novaConversa] = await conexao.query(
                `INSERT INTO mensagens (
                    participante_1_id,
                    participante_2_id,
                    veiculo_id,
                    ultima_mensagem,
                    total_mensagens,
                    status,
                    criado_em,
                    ultimo_envio
                 )
                 VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    0,
                    'aberta',
                    NOW(),
                    NOW()
                 )`,
                [
                    meuId,
                    anuncianteId,
                    veiculoId,
                    resumoMensagem(texto)
                ]
            );

            conversaId = Number(
                novaConversa.insertId
            );

            statusHttp = 201;
        }

        const [novaMensagem] = await conexao.query(
            `INSERT INTO mensagens_conversa (
                conversa_id,
                remetente_id,
                texto,
                criado_em
             )
             VALUES (
                ?,
                ?,
                ?,
                NOW()
             )`,
            [
                conversaId,
                meuId,
                texto
            ]
        );

        const [mensagensCriadas] = await conexao.query(
            `SELECT
                id,
                conversa_id,
                remetente_id,
                texto,
                criado_em

             FROM mensagens_conversa

             WHERE id = ?

             LIMIT 1`,
            [
                novaMensagem.insertId
            ]
        );

        const mensagemCriada =
            mensagensCriadas[0];

        await conexao.query(
            `UPDATE mensagens

             SET ultima_mensagem = ?,
                 total_mensagens =
                    total_mensagens + 1,
                 status = 'aberta',
                 ultimo_envio = NOW(),
                 excluido_para_todos = 0,
                 excluido_para_usuario_id = NULL

             WHERE id = ?`,
            [
                resumoMensagem(texto),
                conversaId
            ]
        );

        await conexao.commit();

        emitirParaUsuarios(
            req,
            [
                meuId,
                anuncianteId
            ],
            "privado:mensagem",
            {
                conversa_id:
                    conversaId,

                mensagem:
                    mensagemCriada
            }
        );

        return res.status(statusHttp).json({
            sucesso: true,
            conversa_id: conversaId,

            mensagem_id: Number(
                novaMensagem.insertId
            ),

            destinatario_id:
                anuncianteId,

            mensagem_enviada:
                true,

            mensagem:
                "Mensagem enviada ao anunciante com sucesso!"
        });
    } catch (erro) {
        if (conexao) {
            try {
                await conexao.rollback();
            } catch (erroRollback) {
                console.error(
                    "❌ Erro ao desfazer transação:",
                    erroRollback.message
                );
            }
        }

        console.error(
            "❌ Erro ao iniciar conversa:",
            erro.sqlMessage || erro
        );

        return res.status(500).json({
            sucesso: false,
            erro:
                "Erro ao enviar a mensagem ao anunciante."
        });
    } finally {
        if (conexao) {
            conexao.release();
        }
    }
});

// ==========================================================
// POST /api/conversas/:id/mensagem
// ENVIAR MENSAGEM EM CONVERSA EXISTENTE
// ==========================================================

router.post("/:id/mensagem", authUser, async (req, res) => {
    const conversaId = inteiroPositivo(
        req.params.id
    );

    const meuId = Number(req.usuario.id);

    const texto = prepararTexto(
        req.body.texto
    );

    if (!conversaId) {
        return res.status(400).json({
            sucesso: false,
            erro: "ID da conversa inválido."
        });
    }

    if (!texto) {
        return res.status(400).json({
            sucesso: false,
            erro: "A mensagem não pode estar vazia."
        });
    }

    if (texto.length > LIMITE_MENSAGEM) {
        return res.status(400).json({
            sucesso: false,
            erro:
                `A mensagem pode ter no máximo ${LIMITE_MENSAGEM} caracteres.`
        });
    }

    let conexao;

    try {
        conexao = await db.getConnection();
        await conexao.beginTransaction();

        const [conversas] = await conexao.query(
            `SELECT
                id,
                status,
                participante_1_id,
                participante_2_id

             FROM mensagens

             WHERE id = ?

             AND (
                    participante_1_id = ?
                    OR participante_2_id = ?
             )

             LIMIT 1

             FOR UPDATE`,
            [
                conversaId,
                meuId,
                meuId
            ]
        );

        if (conversas.length === 0) {
            await conexao.rollback();

            return res.status(404).json({
                sucesso: false,
                erro:
                    "Conversa não encontrada ou sem permissão."
            });
        }

        if (conversas[0].status === "bloqueada") {
            await conexao.rollback();

            return res.status(403).json({
                sucesso: false,
                erro: "Esta conversa está bloqueada."
            });
        }

        const participante1Id = Number(
            conversas[0].participante_1_id
        );

        const participante2Id = Number(
            conversas[0].participante_2_id
        );

        const [novaMensagem] = await conexao.query(
            `INSERT INTO mensagens_conversa (
                conversa_id,
                remetente_id,
                texto,
                criado_em
             )
             VALUES (
                ?,
                ?,
                ?,
                NOW()
             )`,
            [
                conversaId,
                meuId,
                texto
            ]
        );

        const [mensagensCriadas] = await conexao.query(
            `SELECT
                id,
                conversa_id,
                remetente_id,
                texto,
                criado_em

             FROM mensagens_conversa

             WHERE id = ?

             LIMIT 1`,
            [
                novaMensagem.insertId
            ]
        );

        const mensagemCriada =
            mensagensCriadas[0];

        await conexao.query(
            `UPDATE mensagens

             SET ultima_mensagem = ?,
                 total_mensagens =
                    total_mensagens + 1,
                 status = 'aberta',
                 ultimo_envio = NOW(),
                 excluido_para_todos = 0,
                 excluido_para_usuario_id = NULL

             WHERE id = ?`,
            [
                resumoMensagem(texto),
                conversaId
            ]
        );

        await conexao.commit();

        emitirParaUsuarios(
            req,
            [
                participante1Id,
                participante2Id
            ],
            "privado:mensagem",
            {
                conversa_id:
                    conversaId,

                mensagem:
                    mensagemCriada
            }
        );

        return res.status(201).json({
            sucesso: true,
            mensagem:
                "Mensagem enviada com sucesso!",

            dados: {
                ...mensagemCriada,
                enviada_por_mim: true
            }
        });
    } catch (erro) {
        if (conexao) {
            try {
                await conexao.rollback();
            } catch (erroRollback) {
                console.error(
                    "❌ Erro ao desfazer transação:",
                    erroRollback.message
                );
            }
        }

        console.error(
            "❌ Erro ao enviar mensagem:",
            erro.sqlMessage || erro
        );

        return res.status(500).json({
            sucesso: false,
            erro:
                "Erro interno ao enviar a mensagem."
        });
    } finally {
        if (conexao) {
            conexao.release();
        }
    }
});

// ==========================================================
// DELETE /api/conversas/mensagem/:id
// APAGAR PARA MIM OU PARA TODOS
// ==========================================================

router.delete("/mensagem/:id", authUser, async (req, res) => {
    const mensagemId = inteiroPositivo(
        req.params.id
    );

    const meuId = Number(req.usuario.id);

    const tipo =
        req.body.tipo === "para_todos"
            ? "para_todos"
            : "para_mim";

    if (!mensagemId) {
        return res.status(400).json({
            sucesso: false,
            erro: "ID da mensagem inválido."
        });
    }

    let conexao;

    try {
        conexao = await db.getConnection();
        await conexao.beginTransaction();

        const [mensagens] = await conexao.query(
            `SELECT
                mc.id,
                mc.conversa_id,
                mc.remetente_id,
                mc.excluida_para_todos,
                c.participante_1_id,
                c.participante_2_id

             FROM mensagens_conversa mc

             JOIN mensagens c
               ON c.id = mc.conversa_id

             WHERE mc.id = ?

             AND (
                    c.participante_1_id = ?
                    OR c.participante_2_id = ?
             )

             LIMIT 1

             FOR UPDATE`,
            [
                mensagemId,
                meuId,
                meuId
            ]
        );

        if (mensagens.length === 0) {
            await conexao.rollback();

            return res.status(404).json({
                sucesso: false,
                erro:
                    "Mensagem não encontrada ou sem permissão."
            });
        }

        const mensagem = mensagens[0];

        if (tipo === "para_todos") {
            if (
                Number(mensagem.remetente_id) !==
                meuId
            ) {
                await conexao.rollback();

                return res.status(403).json({
                    sucesso: false,
                    erro:
                        "Somente quem enviou pode apagar para todos."
                });
            }

            await conexao.query(
                `UPDATE mensagens_conversa

                 SET excluida_para_todos = 1,
                     excluida_para_todos_em = NOW()

                 WHERE id = ?`,
                [mensagemId]
            );

            const [ultimas] = await conexao.query(
                `SELECT
                    texto,
                    criado_em

                 FROM mensagens_conversa

                 WHERE conversa_id = ?
                   AND excluida_para_todos = 0

                 ORDER BY
                    criado_em DESC,
                    id DESC

                 LIMIT 1`,
                [
                    mensagem.conversa_id
                ]
            );

            const ultima =
                ultimas[0] || null;

            await conexao.query(
                `UPDATE mensagens

                 SET ultima_mensagem = ?,
                     ultimo_envio = ?,

                     total_mensagens = (
                        SELECT COUNT(*)

                        FROM mensagens_conversa

                        WHERE conversa_id = ?
                          AND excluida_para_todos = 0
                     )

                 WHERE id = ?`,
                [
                    ultima
                        ? resumoMensagem(
                            ultima.texto
                        )
                        : null,

                    ultima
                        ? ultima.criado_em
                        : null,

                    mensagem.conversa_id,
                    mensagem.conversa_id
                ]
            );
        } else {
            await conexao.query(
                `INSERT IGNORE INTO mensagens_exclusoes (
                    mensagem_id,
                    usuario_id,
                    excluida_em
                 )
                 VALUES (
                    ?,
                    ?,
                    NOW()
                 )`,
                [
                    mensagemId,
                    meuId
                ]
            );
        }

        await conexao.commit();

        const participantes = [
            Number(
                mensagem.participante_1_id
            ),

            Number(
                mensagem.participante_2_id
            )
        ];

        emitirParaUsuarios(
            req,

            tipo === "para_todos"
                ? participantes
                : [meuId],

            "privado:mensagem_excluida",

            {
                conversa_id: Number(
                    mensagem.conversa_id
                ),

                mensagem_id:
                    mensagemId,

                tipo,

                usuario_id:
                    meuId
            }
        );

        return res.status(200).json({
            sucesso: true,

            mensagem:
                tipo === "para_todos"
                    ? "Mensagem removida para todos."
                    : "Mensagem removida para você."
        });
    } catch (erro) {
        if (conexao) {
            try {
                await conexao.rollback();
            } catch (erroRollback) {
                console.error(
                    "❌ Erro ao desfazer transação:",
                    erroRollback.message
                );
            }
        }

        console.error(
            "❌ Erro ao apagar mensagem:",
            erro.sqlMessage || erro
        );

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao apagar a mensagem."
        });
    } finally {
        if (conexao) {
            conexao.release();
        }
    }
});

module.exports = router;