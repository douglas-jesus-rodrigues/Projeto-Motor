const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

const router = express.Router();

const db = require("../config/db");

const authUser = require(
    "../middlewares/authMiddleware"
);

// ==========================================
// CONFIGURAÇÃO DOS UPLOADS
// ==========================================
const UPLOAD_DIR = path.join(
    __dirname,
    "../../public/uploads"
);

const TAMANHO_MAXIMO =
    5 * 1024 * 1024;

const EXTENSOES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
};

fs.mkdirSync(
    UPLOAD_DIR,
    { recursive: true }
);

const storage = multer.diskStorage({
    destination: (
        req,
        file,
        callback
    ) => {
        callback(
            null,
            UPLOAD_DIR
        );
    },

    filename: (
        req,
        file,
        callback
    ) => {
        const extensao =
            EXTENSOES[file.mimetype];

        const nomeSeguro =
            `${crypto.randomUUID()}${extensao}`;

        callback(
            null,
            nomeSeguro
        );
    }
});

const upload = multer({
    storage,

    limits: {
        fileSize: TAMANHO_MAXIMO,
        files: 1
    },

    fileFilter: (
        req,
        file,
        callback
    ) => {
        if (EXTENSOES[file.mimetype]) {
            return callback(
                null,
                true
            );
        }

        return callback(
            new Error(
                "Envie uma imagem JPG, PNG ou WebP."
            )
        );
    }
});

function uploadImagem(
    req,
    res,
    next
) {
    upload.single("imagem")(
        req,
        res,
        (erro) => {
            if (!erro) {
                return next();
            }

            const mensagem =
                erro instanceof multer.MulterError
                && erro.code === "LIMIT_FILE_SIZE"
                    ? "A imagem deve ter no máximo 5 MB."
                    : erro.message
                        || "Não foi possível processar a imagem.";

            return res
                .status(400)
                .json({
                    sucesso: false,
                    mensagem
                });
        }
    );
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================
async function apagarImagem(nome) {
    if (
        typeof nome !== "string"
        || !nome
    ) {
        return;
    }

    const nomeSeguro =
        path.basename(nome);

    if (nomeSeguro !== nome) {
        return;
    }

    try {
        await fs.promises.unlink(
            path.join(
                UPLOAD_DIR,
                nomeSeguro
            )
        );
    } catch (erro) {
        if (erro.code !== "ENOENT") {
            console.error(
                "❌ Erro ao apagar imagem:",
                erro.code || erro.message
            );
        }
    }
}

function usuarioAutenticadoId(req) {
    const id = Number(
        req.usuario?.id
    );

    return (
        Number.isInteger(id)
        && id > 0
    )
        ? id
        : null;
}

function arredondarPreco(
    valor,
    casas = 100
) {
    return Math.round(
        valor / casas
    ) * casas;
}

async function resolverMarcaModelo(
    marca,
    modelo
) {
    let marcaId;

    const [marcas] =
        await db.query(
            `
                SELECT id
                FROM marca
                WHERE LOWER(nome) = LOWER(?)
                LIMIT 1
            `,
            [marca]
        );

    if (marcas.length) {
        marcaId = marcas[0].id;
    } else {
        const [resultadoMarca] =
            await db.query(
                `
                    INSERT INTO marca (nome)
                    VALUES (?)
                `,
                [marca]
            );

        marcaId =
            resultadoMarca.insertId;
    }

    let modeloId;

    const [modelos] =
        await db.query(
            `
                SELECT id
                FROM modelo
                WHERE marca_id = ?
                  AND LOWER(nome) = LOWER(?)
                LIMIT 1
            `,
            [
                marcaId,
                modelo
            ]
        );

    if (modelos.length) {
        modeloId =
            modelos[0].id;
    } else {
        const [resultadoModelo] =
            await db.query(
                `
                    INSERT INTO modelo
                    (
                        marca_id,
                        nome
                    )
                    VALUES (?, ?)
                `,
                [
                    marcaId,
                    modelo
                ]
            );

        modeloId =
            resultadoModelo.insertId;
    }

    return {
        marcaId,
        modeloId
    };
}

async function resolverAuxiliar(
    tabela,
    valor,
    padrao
) {
    if (
        valor === undefined
        || valor === null
        || valor === ""
    ) {
        return padrao;
    }

    if (
        !Number.isNaN(
            Number(valor)
        )
    ) {
        return Number(valor);
    }

    const tabelasPermitidas =
        new Set([
            "tipo_combustivel",
            "tipo_transmissao"
        ]);

    if (
        !tabelasPermitidas.has(
            tabela
        )
    ) {
        throw new Error(
            "Tabela auxiliar inválida."
        );
    }

    const [linhas] =
        await db.query(
            `
                SELECT id
                FROM ${tabela}
                WHERE LOWER(nome) = LOWER(?)
                LIMIT 1
            `,
            [
                String(valor).trim()
            ]
        );

    return linhas.length
        ? linhas[0].id
        : padrao;
}

// ==========================================
// AUTORIZAÇÃO DO PROPRIETÁRIO OU ADMIN
// ==========================================
async function autorizarGerenciamento(
    req,
    res,
    next
) {
    const usuarioId =
        usuarioAutenticadoId(req);

    const veiculoId =
        Number(req.params.id);

    if (!usuarioId) {
        return res
            .status(401)
            .json({
                sucesso: false,
                mensagem:
                    "Usuário não autenticado."
            });
    }

    if (
        !Number.isInteger(veiculoId)
        || veiculoId <= 0
    ) {
        return res
            .status(400)
            .json({
                sucesso: false,
                mensagem:
                    "ID do veículo inválido."
            });
    }

    try {
        const [[veiculo]] =
            await db.query(
                `
                    SELECT
                        id,
                        usuario_id
                    FROM veiculos
                    WHERE id = ?
                    LIMIT 1
                `,
                [veiculoId]
            );

        if (!veiculo) {
            return res
                .status(404)
                .json({
                    sucesso: false,
                    mensagem:
                        "Veículo não encontrado."
                });
        }

        const [[usuario]] =
            await db.query(
                `
                    SELECT tipo
                    FROM usuarios
                    WHERE id = ?
                      AND deleted_at IS NULL
                    LIMIT 1
                `,
                [usuarioId]
            );

        const permitido =
            Number(
                veiculo.usuario_id
            ) === usuarioId
            || usuario?.tipo === "admin";

        if (!permitido) {
            return res
                .status(403)
                .json({
                    sucesso: false,
                    mensagem:
                        "Você não tem permissão para gerenciar este anúncio."
                });
        }

        req.veiculoAutorizado =
            veiculo;

        return next();
    } catch (erro) {
        console.error(
            "❌ Erro ao autorizar anúncio:",
            erro.sqlMessage
            || erro.message
        );

        return res
            .status(500)
            .json({
                sucesso: false,
                mensagem:
                    "Erro interno ao validar o anúncio."
            });
    }
}

// ==========================================
// POST /api/veiculos
// CADASTRAR VEÍCULO
// ==========================================
router.post(
    "/",
    authUser,
    uploadImagem,
    async (req, res) => {
        const usuarioId =
            usuarioAutenticadoId(req);

        const descartarUpload =
            async () => {
                if (req.file) {
                    await apagarImagem(
                        req.file.filename
                    );
                }
            };

        if (!usuarioId) {
            await descartarUpload();

            return res
                .status(401)
                .json({
                    sucesso: false,
                    mensagem:
                        "Usuário não autenticado."
                });
        }

        try {
            const {
                marca,
                modelo,
                versao,
                ano_fabricacao,
                ano_modelo,
                preco,
                quilometragem,
                combustivel,
                cambio,
                cor,
                portas,
                carroceria,
                descricao
            } = req.body;

            if (
                !marca?.trim()
                || !modelo?.trim()
                || !ano_fabricacao
                || !ano_modelo
                || !preco
            ) {
                await descartarUpload();

                return res
                    .status(400)
                    .json({
                        sucesso: false,
                        mensagem:
                            "Preencha marca, modelo, anos e preço."
                    });
            }

            const precoNumerico =
                Number(preco);

            const anoFabricacao =
                Number(ano_fabricacao);

            const anoModelo =
                Number(ano_modelo);

            if (
                !Number.isFinite(
                    precoNumerico
                )
                || precoNumerico <= 0
            ) {
                await descartarUpload();

                return res
                    .status(400)
                    .json({
                        sucesso: false,
                        mensagem:
                            "O preço informado é inválido."
                    });
            }

            if (
                !Number.isInteger(
                    anoFabricacao
                )
                || !Number.isInteger(
                    anoModelo
                )
            ) {
                await descartarUpload();

                return res
                    .status(400)
                    .json({
                        sucesso: false,
                        mensagem:
                            "Os anos informados são inválidos."
                    });
            }

            const precoFinal =
                arredondarPreco(
                    precoNumerico,
                    100
                );

            const {
                marcaId,
                modeloId
            } = await resolverMarcaModelo(
                marca.trim(),
                modelo.trim()
            );

            const combustivelId =
                await resolverAuxiliar(
                    "tipo_combustivel",
                    combustivel,
                    3
                );

            const transmissaoId =
                await resolverAuxiliar(
                    "tipo_transmissao",
                    cambio,
                    1
                );

            const [resultado] =
                await db.query(
                    `
                        INSERT INTO veiculos
                        (
                            usuario_id,
                            marca_id,
                            modelo_id,
                            versao,
                            ano_fabricacao,
                            ano_modelo,
                            preco,
                            quilometragem,
                            tipo_combustivel_id,
                            tipo_transmissao_id,
                            cor,
                            portas,
                            carroceria,
                            descricao,
                            status_anuncio_id
                        )
                        VALUES (
                            ?, ?, ?, ?, ?, ?,
                            ?, ?, ?, ?, ?, ?,
                            ?, ?, 1
                        )
                    `,
                    [
                        usuarioId,
                        marcaId,
                        modeloId,
                        versao?.trim() || null,
                        anoFabricacao,
                        anoModelo,
                        precoFinal,

                        quilometragem
                            ? Number(
                                quilometragem
                            )
                            : 0,

                        combustivelId,
                        transmissaoId,
                        cor?.trim() || null,

                        portas
                            ? Number(portas)
                            : null,

                        carroceria?.trim()
                            || null,

                        descricao?.trim()
                            || null
                    ]
                );

            if (req.file) {
                await db.query(
                    `
                        INSERT INTO fotos_veiculos
                        (
                            veiculo_id,
                            imagem,
                            nome_original,
                            mime_type,
                            tamanho_bytes,
                            principal
                        )
                        VALUES (
                            ?, ?, ?, ?, ?, 1
                        )
                    `,
                    [
                        resultado.insertId,
                        req.file.filename,
                        req.file.originalname,
                        req.file.mimetype,
                        req.file.size
                    ]
                );
            }

            return res
                .status(201)
                .json({
                    sucesso: true,
                    mensagem:
                        "Veículo publicado com sucesso!",
                    veiculoId:
                        resultado.insertId,
                    precoFinal
                });
        } catch (erro) {
            await descartarUpload();

            console.error(
                "❌ Erro ao cadastrar veículo:",
                erro.sqlMessage
                || erro.message
            );

            return res
                .status(500)
                .json({
                    sucesso: false,
                    mensagem:
                        "Erro interno ao cadastrar veículo."
                });
        }
    }
);

// ==========================================
// GET /api/veiculos
// LISTAGEM PÚBLICA DO CATÁLOGO
// ==========================================
router.get(
    "/",
    async (req, res) => {
        try {
            const pagina = Math.max(
                1,
                Number.parseInt(
                    req.query.pagina,
                    10
                ) || 1
            );

            const limite = Math.min(
                50,
                Math.max(
                    1,
                    Number.parseInt(
                        req.query.limite,
                        10
                    ) || 15
                )
            );

            const offset =
                (pagina - 1) * limite;

            const [[{ total }]] =
                await db.query(
                    `
                        SELECT COUNT(*) AS total
                        FROM veiculos
                    `
                );

            const totalPaginas =
                Math.ceil(
                    Number(total) / limite
                );

            const [veiculos] =
                await db.query(
                    `
                        SELECT
                            v.*,
                            m.nome AS marca_nome,
                            mo.nome AS modelo_nome,
                            f.imagem AS imagem
                        FROM veiculos v
                        LEFT JOIN marca m
                            ON m.id = v.marca_id
                        LEFT JOIN modelo mo
                            ON mo.id = v.modelo_id
                        LEFT JOIN fotos_veiculos f
                            ON f.veiculo_id = v.id
                           AND f.principal = 1
                        ORDER BY v.id DESC
                        LIMIT ? OFFSET ?
                    `,
                    [
                        limite,
                        offset
                    ]
                );

            return res
                .status(200)
                .json({
                    sucesso: true,
                    veiculos,
                    total_paginas:
                        totalPaginas,
                    pagina_atual:
                        pagina
                });
        } catch (erro) {
            console.error(
                "❌ Erro ao listar veículos:",
                erro.sqlMessage
                || erro.message
            );

            return res
                .status(500)
                .json({
                    sucesso: false,
                    mensagem:
                        "Erro ao buscar veículos."
                });
        }
    }
);

// ==========================================
// GET /api/veiculos/usuario/:usuarioId
// ANÚNCIOS DE UMA CONTA
// ==========================================
router.get(
    "/usuario/:usuarioId",
    async (req, res) => {
        const usuarioId =
            Number(
                req.params.usuarioId
            );

        if (
            !Number.isInteger(usuarioId)
            || usuarioId <= 0
        ) {
            return res
                .status(400)
                .json({
                    sucesso: false,
                    mensagem:
                        "ID de usuário inválido."
                });
        }

        try {
            const [veiculos] =
                await db.query(
                    `
                        SELECT
                            v.*,
                            m.nome AS marca,
                            mo.nome AS modelo,
                            s.nome AS status_anuncio,
                            f.imagem AS imagem,

                            (
                                SELECT COUNT(*)
                                FROM visualizacoes_anuncios va
                                WHERE va.veiculo_id = v.id
                            ) AS total_visualizacoes

                        FROM veiculos v

                        LEFT JOIN marca m
                            ON m.id = v.marca_id

                        LEFT JOIN modelo mo
                            ON mo.id = v.modelo_id

                        LEFT JOIN status_anuncio s
                            ON s.id = v.status_anuncio_id

                        LEFT JOIN fotos_veiculos f
                            ON f.veiculo_id = v.id
                           AND f.principal = 1

                        WHERE v.usuario_id = ?

                        ORDER BY v.id DESC
                    `,
                    [usuarioId]
                );

            return res
                .status(200)
                .json({
                    sucesso: true,
                    veiculos
                });
        } catch (erro) {
            console.error(
                "❌ Erro ao buscar veículos do usuário:",
                erro.sqlMessage
                || erro.message
            );

            return res
                .status(500)
                .json({
                    sucesso: false,
                    mensagem:
                        "Erro ao buscar anúncios do usuário."
                });
        }
    }
);

// ==========================================
// POST /api/veiculos/:id/visualizar
// REGISTRAR VISUALIZAÇÃO
// ==========================================
router.post(
    "/:id/visualizar",
    authUser,
    async (req, res) => {
        const veiculoId =
            Number(req.params.id);

        const usuarioId =
            usuarioAutenticadoId(req);

        if (
            !Number.isInteger(veiculoId)
            || veiculoId <= 0
        ) {
            return res
                .status(400)
                .json({
                    sucesso: false,
                    mensagem:
                        "ID do veículo inválido."
                });
        }

        if (!usuarioId) {
            return res
                .status(401)
                .json({
                    sucesso: false,
                    mensagem:
                        "Usuário não autenticado."
                });
        }

        try {
            const [[usuario]] =
                await db.query(
                    `
                        SELECT tipo
                        FROM usuarios
                        WHERE id = ?
                          AND deleted_at IS NULL
                        LIMIT 1
                    `,
                    [usuarioId]
                );

            if (
                usuario?.tipo === "admin"
            ) {
                return res
                    .status(200)
                    .json({
                        sucesso: true,
                        ignorado: true,
                        mensagem:
                            "Visualização de administrador ignorada."
                    });
            }

            const [[veiculo]] =
                await db.query(
                    `
                        SELECT usuario_id
                        FROM veiculos
                        WHERE id = ?
                        LIMIT 1
                    `,
                    [veiculoId]
                );

            if (!veiculo) {
                return res
                    .status(404)
                    .json({
                        sucesso: false,
                        mensagem:
                            "Veículo não encontrado."
                    });
            }

            if (
                Number(
                    veiculo.usuario_id
                ) === usuarioId
            ) {
                return res
                    .status(200)
                    .json({
                        sucesso: true,
                        ignorado: true,
                        mensagem:
                            "Visualização do proprietário ignorada."
                    });
            }

            await db.query(
                `
                    INSERT IGNORE INTO visualizacoes_anuncios
                    (
                        veiculo_id,
                        usuario_id
                    )
                    VALUES (?, ?)
                `,
                [
                    veiculoId,
                    usuarioId
                ]
            );

            return res
                .status(200)
                .json({
                    sucesso: true,
                    mensagem:
                        "Visualização registrada com sucesso."
                });
        } catch (erro) {
            console.error(
                "❌ Erro ao registrar visualização:",
                erro.sqlMessage
                || erro.message
            );

            return res
                .status(500)
                .json({
                    sucesso: false,
                    mensagem:
                        "Erro interno ao registrar visualização."
                });
        }
    }
);

// ==========================================
// GET /api/veiculos/:id
// BUSCAR UM VEÍCULO
// ==========================================
router.get(
    "/:id",
    async (req, res) => {
        const veiculoId =
            Number(req.params.id);

        if (
            !Number.isInteger(veiculoId)
            || veiculoId <= 0
        ) {
            return res
                .status(400)
                .json({
                    sucesso: false,
                    mensagem:
                        "ID do veículo inválido."
                });
        }

        try {
            const [veiculos] =
                await db.query(
                    `
                        SELECT
                            v.*,
                            m.nome AS marca,
                            mo.nome AS modelo,
                            f.imagem AS imagem
                        FROM veiculos v

                        LEFT JOIN marca m
                            ON m.id = v.marca_id

                        LEFT JOIN modelo mo
                            ON mo.id = v.modelo_id

                        LEFT JOIN fotos_veiculos f
                            ON f.veiculo_id = v.id
                           AND f.principal = 1

                        WHERE v.id = ?
                        LIMIT 1
                    `,
                    [veiculoId]
                );

            if (!veiculos.length) {
                return res
                    .status(404)
                    .json({
                        sucesso: false,
                        mensagem:
                            "Veículo não encontrado."
                    });
            }

            return res
                .status(200)
                .json({
                    sucesso: true,
                    veiculo:
                        veiculos[0]
                });
        } catch (erro) {
            console.error(
                "❌ Erro ao buscar veículo:",
                erro.sqlMessage
                || erro.message
            );

            return res
                .status(500)
                .json({
                    sucesso: false,
                    mensagem:
                        "Erro ao buscar o veículo."
                });
        }
    }
);

// ==========================================
// PUT /api/veiculos/:id
// ATUALIZAR VEÍCULO
// ==========================================
router.put(
    "/:id",
    authUser,
    autorizarGerenciamento,
    uploadImagem,
    async (req, res) => {
        const veiculoId =
            Number(req.params.id);

        const descartarUpload =
            async () => {
                if (req.file) {
                    await apagarImagem(
                        req.file.filename
                    );
                }
            };

        try {
            const [[atual]] =
                await db.query(
                    `
                        SELECT *
                        FROM veiculos
                        WHERE id = ?
                        LIMIT 1
                    `,
                    [veiculoId]
                );

            if (!atual) {
                await descartarUpload();

                return res
                    .status(404)
                    .json({
                        sucesso: false,
                        mensagem:
                            "Veículo não encontrado."
                    });
            }

            const corpo = req.body;

            const enviado =
                (campo) => {
                    return corpo[campo]
                        !== undefined;
                };

            const texto =
                (
                    campo,
                    valorAntigo
                ) => {
                    return enviado(campo)
                        ? (
                            String(
                                corpo[campo]
                            ).trim()
                            || null
                        )
                        : valorAntigo;
                };

            const inteiro =
                (
                    campo,
                    valorAntigo
                ) => {
                    if (!enviado(campo)) {
                        return valorAntigo;
                    }

                    if (
                        String(
                            corpo[campo]
                        ).trim() === ""
                    ) {
                        return null;
                    }

                    const numero =
                        Number(
                            corpo[campo]
                        );

                    return Number.isInteger(
                        numero
                    )
                        ? numero
                        : valorAntigo;
                };

            let marcaId =
                atual.marca_id;

            let modeloId =
                atual.modelo_id;

            if (
                enviado("marca")
                && enviado("modelo")
                && String(
                    corpo.marca
                ).trim()
                && String(
                    corpo.modelo
                ).trim()
            ) {
                ({
                    marcaId,
                    modeloId
                } = await resolverMarcaModelo(
                    String(
                        corpo.marca
                    ).trim(),

                    String(
                        corpo.modelo
                    ).trim()
                ));
            }

            let preco =
                atual.preco;

            if (
                enviado("preco")
                && String(
                    corpo.preco
                ).trim()
            ) {
                const numero = Number(
                    String(corpo.preco)
                        .replace("R$", "")
                        .trim()
                        .replace(/\./g, "")
                        .replace(",", ".")
                );

                if (
                    !Number.isFinite(numero)
                    || numero <= 0
                ) {
                    await descartarUpload();

                    return res
                        .status(400)
                        .json({
                            sucesso: false,
                            mensagem:
                                "O preço informado é inválido."
                        });
                }

                preco =
                    arredondarPreco(
                        numero,
                        100
                    );
            }

            const combustivelId =
                enviado("combustivel")
                    ? await resolverAuxiliar(
                        "tipo_combustivel",
                        corpo.combustivel,
                        atual.tipo_combustivel_id
                    )
                    : atual.tipo_combustivel_id;

            const transmissaoId =
                enviado("cambio")
                    ? await resolverAuxiliar(
                        "tipo_transmissao",
                        corpo.cambio,
                        atual.tipo_transmissao_id
                    )
                    : atual.tipo_transmissao_id;

            await db.query(
                `
                    UPDATE veiculos
                    SET
                        marca_id = ?,
                        modelo_id = ?,
                        versao = ?,
                        ano_fabricacao = ?,
                        ano_modelo = ?,
                        preco = ?,
                        quilometragem = ?,
                        tipo_combustivel_id = ?,
                        tipo_transmissao_id = ?,
                        cor = ?,
                        portas = ?,
                        carroceria = ?,
                        descricao = ?
                    WHERE id = ?
                `,
                [
                    marcaId,
                    modeloId,

                    texto(
                        "versao",
                        atual.versao
                    ),

                    inteiro(
                        "ano_fabricacao",
                        atual.ano_fabricacao
                    ),

                    inteiro(
                        "ano_modelo",
                        atual.ano_modelo
                    ),

                    preco,

                    inteiro(
                        "quilometragem",
                        atual.quilometragem
                    ) ?? 0,

                    combustivelId,
                    transmissaoId,

                    texto(
                        "cor",
                        atual.cor
                    ),

                    inteiro(
                        "portas",
                        atual.portas
                    ),

                    texto(
                        "carroceria",
                        atual.carroceria
                    ),

                    texto(
                        "descricao",
                        atual.descricao
                    ),

                    veiculoId
                ]
            );

            let imagem = null;

            if (req.file) {
                const [fotos] =
                    await db.query(
                        `
                            SELECT
                                id,
                                imagem
                            FROM fotos_veiculos
                            WHERE veiculo_id = ?
                              AND principal = 1
                            ORDER BY id
                            LIMIT 1
                        `,
                        [veiculoId]
                    );

                if (fotos[0]) {
                    await db.query(
                        `
                            UPDATE fotos_veiculos
                            SET
                                imagem = ?,
                                nome_original = ?,
                                mime_type = ?,
                                tamanho_bytes = ?
                            WHERE id = ?
                        `,
                        [
                            req.file.filename,
                            req.file.originalname,
                            req.file.mimetype,
                            req.file.size,
                            fotos[0].id
                        ]
                    );

                    await apagarImagem(
                        fotos[0].imagem
                    );
                } else {
                    await db.query(
                        `
                            INSERT INTO fotos_veiculos
                            (
                                veiculo_id,
                                imagem,
                                nome_original,
                                mime_type,
                                tamanho_bytes,
                                principal
                            )
                            VALUES (
                                ?, ?, ?, ?, ?, 1
                            )
                        `,
                        [
                            veiculoId,
                            req.file.filename,
                            req.file.originalname,
                            req.file.mimetype,
                            req.file.size
                        ]
                    );
                }

                imagem =
                    req.file.filename;
            }

            return res
                .status(200)
                .json({
                    sucesso: true,
                    mensagem:
                        "Anúncio atualizado com sucesso!",
                    imagem
                });
        } catch (erro) {
            await descartarUpload();

            console.error(
                "❌ Erro ao atualizar veículo:",
                erro.sqlMessage
                || erro.message
            );

            return res
                .status(500)
                .json({
                    sucesso: false,
                    mensagem:
                        "Erro interno ao atualizar o anúncio."
                });
        }
    }
);

// ==========================================
// DELETE /api/veiculos/:id
// EXCLUIR VEÍCULO
// ==========================================
router.delete(
    "/:id",
    authUser,
    autorizarGerenciamento,
    async (req, res) => {
        const veiculoId =
            Number(req.params.id);

        try {
            const [fotos] =
                await db.query(
                    `
                        SELECT imagem
                        FROM fotos_veiculos
                        WHERE veiculo_id = ?
                    `,
                    [veiculoId]
                );

            await db.query(
                `
                    DELETE FROM fotos_veiculos
                    WHERE veiculo_id = ?
                `,
                [veiculoId]
            );

            await db.query(
                `
                    DELETE FROM visualizacoes_anuncios
                    WHERE veiculo_id = ?
                `,
                [veiculoId]
            );

            const [resultado] =
                await db.query(
                    `
                        DELETE FROM veiculos
                        WHERE id = ?
                    `,
                    [veiculoId]
                );

            if (
                !resultado.affectedRows
            ) {
                return res
                    .status(404)
                    .json({
                        sucesso: false,
                        mensagem:
                            "Veículo não encontrado."
                    });
            }

            await Promise.all(
                fotos.map((foto) => {
                    return apagarImagem(
                        foto.imagem
                    );
                })
            );

            return res
                .status(200)
                .json({
                    sucesso: true,
                    mensagem:
                        "Anúncio excluído com sucesso!"
                });
        } catch (erro) {
            console.error(
                "❌ Erro ao excluir veículo:",
                erro.sqlMessage
                || erro.message
            );

            return res
                .status(500)
                .json({
                    sucesso: false,
                    mensagem:
                        "Erro interno ao excluir o anúncio."
                });
        }
    }
);

module.exports = router;