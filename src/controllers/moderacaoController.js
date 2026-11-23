"use strict";

const db = require("../config/db");

const MOTIVOS_PERMITIDOS = new Set([
    "fraude",
    "conteudo_inadequado",
    "informacao_falsa",
    "duplicado",
    "outro"
]);

function inteiroPositivo(
    valor,
    padrao = null
) {
    const numero =
        Number.parseInt(valor, 10);

    return (
        Number.isInteger(numero) &&
        numero > 0
            ? numero
            : padrao
    );
}

function limitarTexto(
    valor,
    tamanho
) {
    return String(valor ?? "")
        .trim()
        .slice(0, tamanho);
}

function ipDaRequisicao(req) {
    const encaminhado =
        req.headers["x-forwarded-for"];

    const ip = Array.isArray(encaminhado)
        ? encaminhado[0]
        : String(
            encaminhado ||
            req.ip ||
            req.socket?.remoteAddress ||
            ""
        ).split(",")[0];

    return (
        limitarTexto(ip, 45) ||
        null
    );
}

async function obterResumo() {
    const [
        [pendentes],
        [auditoria]
    ] = await Promise.all([
        db.query(
            `
            SELECT COUNT(*) AS total
            FROM denuncias
            WHERE status = 'pendente'
            `
        ),

        db.query(
            `
            SELECT
                SUM(
                    acao = 'moderacao_manter'
                ) AS mantidos,

                SUM(
                    acao = 'moderacao_restringir'
                ) AS restringidos,

                SUM(
                    DATE(criado_em) = CURDATE()
                ) AS resolvidas_hoje

            FROM audit_log

            WHERE acao IN (
                'moderacao_manter',
                'moderacao_restringir'
            )
            `
        )
    ]);

    return {
        pendentes:
            Number(
                pendentes[0]?.total
            ) || 0,

        resolvidas_hoje:
            Number(
                auditoria[0]
                    ?.resolvidas_hoje
            ) || 0,

        mantidos:
            Number(
                auditoria[0]
                    ?.mantidos
            ) || 0,

        restringidos:
            Number(
                auditoria[0]
                    ?.restringidos
            ) || 0
    };
}

// ==========================================
// LISTAR DENÚNCIAS
// GET /api/moderacao/denuncias
// ==========================================
exports.listarDenuncias =
async (req, res) => {
    const pagina =
        inteiroPositivo(
            req.query.pagina,
            1
        );

    const limite = Math.min(
        inteiroPositivo(
            req.query.limite,
            9
        ),
        30
    );

    const offset =
        (pagina - 1) * limite;

    const busca =
        limitarTexto(
            req.query.busca,
            100
        );

    const motivoRecebido =
        limitarTexto(
            req.query.motivo,
            50
        );

    const motivo =
        MOTIVOS_PERMITIDOS.has(
            motivoRecebido
        )
            ? motivoRecebido
            : "";

    const direcao =
        req.query.ordem ===
        "mais_recentes"
            ? "DESC"
            : "ASC";

    const filtros = [
        "d.status = 'pendente'"
    ];

    const parametros = [];

    if (motivo) {
        filtros.push(
            "d.motivo = ?"
        );

        parametros.push(motivo);
    }

    if (busca) {
        filtros.push(
            `
            (
                CAST(d.id AS CHAR) LIKE ?
                OR CAST(v.id AS CHAR) LIKE ?
                OR m.nome LIKE ?
                OR mo.nome LIKE ?
                OR CONCAT_WS(
                    ' ',
                    m.nome,
                    mo.nome,
                    v.versao
                ) LIKE ?
            )
            `
        );

        const termo =
            `%${busca}%`;

        parametros.push(
            termo,
            termo,
            termo,
            termo,
            termo
        );
    }

    const where =
        filtros.join(" AND ");

    try {
        const [
            [contagem],
            [denuncias],
            resumo
        ] = await Promise.all([
            db.query(
                `
                SELECT
                    COUNT(*) AS total

                FROM denuncias d

                INNER JOIN veiculos v
                    ON v.id = d.veiculo_id

                LEFT JOIN marca m
                    ON m.id = v.marca_id

                LEFT JOIN modelo mo
                    ON mo.id = v.modelo_id

                WHERE ${where}
                `,
                parametros
            ),

            db.query(
                `
                SELECT
                    d.id AS denuncia_id,
                    d.veiculo_id,
                    d.motivo,
                    d.descricao,
                    d.status,
                    d.criado_em,

                    v.ano_fabricacao,
                    v.ano_modelo,
                    v.preco,
                    v.versao,
                    v.status_anuncio_id,

                    m.nome AS marca_nome,
                    mo.nome AS modelo_nome,

                    (
                        SELECT
                            fv.imagem

                        FROM fotos_veiculos fv

                        WHERE
                            fv.veiculo_id = v.id

                        ORDER BY
                            fv.principal DESC,
                            fv.ordem ASC,
                            fv.id ASC

                        LIMIT 1
                    ) AS imagem

                FROM denuncias d

                INNER JOIN veiculos v
                    ON v.id = d.veiculo_id

                LEFT JOIN marca m
                    ON m.id = v.marca_id

                LEFT JOIN modelo mo
                    ON mo.id = v.modelo_id

                WHERE ${where}

                ORDER BY
                    d.criado_em ${direcao},
                    d.id ${direcao}

                LIMIT ? OFFSET ?
                `,
                [
                    ...parametros,
                    limite,
                    offset
                ]
            ),

            obterResumo()
        ]);

        const total =
            Number(
                contagem[0]?.total
            ) || 0;

        const totalPaginas =
            Math.max(
                1,
                Math.ceil(
                    total / limite
                )
            );

        return res
            .status(200)
            .json({
                sucesso: true,
                denuncias,
                pagina,
                limite,
                total,
                totalPaginas,
                resumo
            });
    } catch (erro) {
        console.error(
            "❌ Erro ao listar denúncias:",
            erro.sqlMessage ||
            erro.message ||
            erro
        );

        return res
            .status(500)
            .json({
                sucesso: false,
                mensagem:
                    "Não foi possível carregar as denúncias."
            });
    }
};

// ==========================================
// RESOLVER DENÚNCIA
// POST /api/moderacao/denuncias/:id/resolver
// ==========================================
exports.resolverDenuncia =
async (req, res) => {
    const denunciaId =
        inteiroPositivo(
            req.params.id
        );

    const acao =
        limitarTexto(
            req.body?.acao,
            20
        ).toLowerCase();

    const justificativa =
        limitarTexto(
            req.body?.justificativa,
            500
        );

    if (!denunciaId) {
        return res
            .status(400)
            .json({
                sucesso: false,
                mensagem:
                    "ID da denúncia inválido."
            });
    }

    if (
        ![
            "manter",
            "restringir"
        ].includes(acao)
    ) {
        return res
            .status(400)
            .json({
                sucesso: false,
                mensagem:
                    "Ação de moderação inválida."
            });
    }

    if (
        justificativa.length < 10
    ) {
        return res
            .status(400)
            .json({
                sucesso: false,
                mensagem:
                    "A justificativa deve possuir pelo menos 10 caracteres."
            });
    }

    let conexao;

    try {
        conexao =
            await db.getConnection();

        await conexao
            .beginTransaction();

        const [registros] =
            await conexao.query(
                `
                SELECT
                    d.id,
                    d.veiculo_id,
                    d.motivo,
                    d.status,
                    v.status_anuncio_id

                FROM denuncias d

                INNER JOIN veiculos v
                    ON v.id = d.veiculo_id

                WHERE d.id = ?

                LIMIT 1
                FOR UPDATE
                `,
                [denunciaId]
            );

        const denuncia =
            registros[0];

        if (!denuncia) {
            await conexao.rollback();

            return res
                .status(404)
                .json({
                    sucesso: false,
                    mensagem:
                        "Denúncia não encontrada."
                });
        }

        if (
            denuncia.status !==
            "pendente"
        ) {
            await conexao.rollback();

            return res
                .status(409)
                .json({
                    sucesso: false,
                    mensagem:
                        "Esta denúncia já foi analisada."
                });
        }

        const statusFinal =
            acao === "manter"
                ? "recusada"
                : "resolvida";

        if (
            acao === "restringir"
        ) {
            await conexao.query(
                `
                INSERT INTO status_anuncio (
                    id,
                    nome,
                    descricao
                )
                VALUES (
                    2,
                    'Restrito',
                    'Anúncio restringido pela moderação'
                )

                ON DUPLICATE KEY UPDATE
                    nome = VALUES(nome),
                    descricao = VALUES(descricao)
                `
            );

            await conexao.query(
                `
                UPDATE veiculos

                SET
                    status_anuncio_id = 2,
                    atualizado_em = NOW()

                WHERE id = ?
                `,
                [
                    denuncia.veiculo_id
                ]
            );
        }

        await conexao.query(
            `
            UPDATE denuncias

            SET status = ?

            WHERE id = ?
            `,
            [
                statusFinal,
                denunciaId
            ]
        );

        await conexao.query(
            `
            INSERT INTO audit_log (
                usuario_id,
                acao,
                tabela_afetada,
                registro_id,
                dados_antigos,
                dados_novos,
                ip_origem
            )
            VALUES (
                ?,
                ?,
                'denuncias',
                ?,
                ?,
                ?,
                ?
            )
            `,
            [
                req.admin?.id || null,

                `moderacao_${acao}`,

                denunciaId,

                JSON.stringify({
                    status:
                        denuncia.status,

                    status_anuncio_id:
                        denuncia
                            .status_anuncio_id
                }),

                JSON.stringify({
                    status:
                        statusFinal,

                    status_anuncio_id:
                        acao ===
                        "restringir"
                            ? 2
                            : denuncia
                                .status_anuncio_id,

                    veiculo_id:
                        denuncia.veiculo_id,

                    motivo:
                        denuncia.motivo,

                    justificativa
                }),

                ipDaRequisicao(req)
            ]
        );

        await conexao.commit();

        return res
            .status(200)
            .json({
                sucesso: true,

                mensagem:
                    acao === "restringir"
                        ? (
                            "Anúncio restringido com sucesso."
                        )
                        : (
                            "Denúncia encerrada e anúncio mantido."
                        ),

                denuncia: {
                    id:
                        denunciaId,

                    veiculo_id:
                        denuncia
                            .veiculo_id,

                    status:
                        statusFinal
                }
            });
    } catch (erro) {
        if (conexao) {
            try {
                await conexao.rollback();
            } catch (erroRollback) {
                console.error(
                    "❌ Erro no rollback da moderação:",
                    erroRollback.message
                );
            }
        }

        console.error(
            "❌ Erro ao resolver denúncia:",
            erro.sqlMessage ||
            erro.message ||
            erro
        );

        return res
            .status(500)
            .json({
                sucesso: false,
                mensagem:
                    "Não foi possível registrar a decisão."
            });
    } finally {
        conexao?.release();
    }
};

// ==========================================
// COMPATIBILIDADE COM A ROTA ANTIGA
// POST /api/moderacao/:id/:acao
// ==========================================
exports.gerenciarDenuncia =
async (req, res) => {
    const veiculoId =
        inteiroPositivo(
            req.params.id
        );

    const acaoAntiga =
        limitarTexto(
            req.params.acao,
            20
        ).toLowerCase();

    const acoesPermitidas = [
        "manter",
        "remover",
        "restringir"
    ];

    if (
        !veiculoId ||
        !acoesPermitidas.includes(
            acaoAntiga
        )
    ) {
        return res
            .status(400)
            .json({
                sucesso: false,
                mensagem:
                    "Parâmetros de moderação inválidos."
            });
    }

    try {
        const [registros] =
            await db.query(
                `
                SELECT id

                FROM denuncias

                WHERE
                    veiculo_id = ?
                    AND status = 'pendente'

                ORDER BY
                    criado_em ASC,
                    id ASC

                LIMIT 1
                `,
                [veiculoId]
            );

        if (!registros.length) {
            return res
                .status(404)
                .json({
                    sucesso: false,
                    mensagem:
                        "Nenhuma denúncia pendente encontrada para este veículo."
                });
        }

        req.params.id =
            String(registros[0].id);

        req.body = {
            ...(req.body || {}),

            acao:
                acaoAntiga ===
                "manter"
                    ? "manter"
                    : "restringir",

            justificativa:
                limitarTexto(
                    req.body
                        ?.justificativa,
                    500
                ) ||
                (
                    "Decisão registrada pelo endpoint " +
                    "administrativo anterior."
                )
        };

        return exports
            .resolverDenuncia(
                req,
                res
            );
    } catch (erro) {
        console.error(
            "❌ Erro no endpoint antigo de moderação:",
            erro.sqlMessage ||
            erro.message ||
            erro
        );

        return res
            .status(500)
            .json({
                sucesso: false,
                mensagem:
                    "Não foi possível processar a moderação."
            });
    }
};