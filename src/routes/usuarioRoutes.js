"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const router = express.Router();

const usuarioController = require("../controllers/usuarioController");
const authAdmin = require("../middlewares/authAdmin");
const authUser = require("../middlewares/authMiddleware");
const db = require("../config/db");

const {
    enviarEmailRecuperacao
} = require("../config/emailService");

const {
    enviarImagem,
    removerImagem
} = require("../services/cloudinaryService");

const TIPOS_VALIDOS = [
    "individual",
    "empresa",
    "admin"
];

const RESPOSTA_RECUPERACAO =
    "Se o e-mail estiver cadastrado, as instruções serão enviadas.";

const PASTA_UPLOADS = path.join(
    __dirname,
    "../../public/uploads"
);

const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024;
const JANELA_RECUPERACAO_MS = 15 * 60 * 1000;
const MAX_RECUPERACOES_POR_IP = 5;

const tentativasRecuperacao = new Map();

// Mantém compatibilidade com fotos locais antigas.
fs.mkdirSync(PASTA_UPLOADS, {
    recursive: true
});

// ==========================================
// CONFIGURAÇÃO DO UPLOAD
// ==========================================

const EXTENSOES_POR_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
};

const upload = multer({
    // A imagem fica temporariamente na memória
    // até ser enviada para o Cloudinary.
    storage: multer.memoryStorage(),

    limits: {
        fileSize: TAMANHO_MAXIMO_FOTO,
        files: 1
    },

    fileFilter: (req, file, callback) => {
        const extensao = EXTENSOES_POR_MIME[file.mimetype];

        if (extensao) {
            return callback(null, true);
        }

        return callback(
            new Error("Envie uma imagem JPG, PNG ou WebP.")
        );
    }
});

function processarFotoPerfil(req, res, next) {
    upload.single("fotoPerfil")(
        req,
        res,
        (erro) => {
            if (!erro) {
                return next();
            }

            if (
                erro instanceof multer.MulterError
                && erro.code === "LIMIT_FILE_SIZE"
            ) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "A imagem pode ter no máximo 5 MB."
                });
            }

            return res.status(400).json({
                sucesso: false,
                erro:
                    erro.message
                    || "Não foi possível processar a imagem."
            });
        }
    );
}

// ==========================================
// COMPATIBILIDADE COM FOTOS LOCAIS ANTIGAS
// ==========================================

async function apagarArquivoLocal(caminho) {
    if (!caminho) return;

    try {
        await fs.promises.unlink(caminho);
    } catch (erro) {
        if (erro.code !== "ENOENT") {
            console.error(
                "[upload] Não foi possível remover o arquivo local:",
                erro.code || erro.message
            );
        }
    }
}

function obterCaminhoLocalDaFoto(fotoUrl) {
    if (
        typeof fotoUrl !== "string"
        || !fotoUrl.startsWith("/uploads/")
    ) {
        return null;
    }

    const nomeInformado =
        fotoUrl.slice("/uploads/".length);

    const nomeSeguro =
        path.basename(nomeInformado);

    if (
        !nomeSeguro
        || nomeSeguro !== nomeInformado
    ) {
        return null;
    }

    const pastaResolvida =
        path.resolve(PASTA_UPLOADS);

    const caminhoResolvido =
        path.resolve(
            PASTA_UPLOADS,
            nomeSeguro
        );

    if (
        !caminhoResolvido.startsWith(
            `${pastaResolvida}${path.sep}`
        )
    ) {
        return null;
    }

    return caminhoResolvido;
}

function fotoEstaNoCloudinary(fotoUrl) {
    return (
        typeof fotoUrl === "string"
        && fotoUrl.includes("res.cloudinary.com")
    );
}

async function removerFotoAnterior(fotoUrl) {
    if (!fotoUrl) return;

    if (fotoEstaNoCloudinary(fotoUrl)) {
        try {
            await removerImagem(fotoUrl);
        } catch (erro) {
            console.warn(
                "[upload] Não foi possível remover a imagem do Cloudinary:",
                erro.message
            );
        }

        return;
    }

    const caminhoLocal =
        obterCaminhoLocalDaFoto(fotoUrl);

    if (caminhoLocal) {
        await apagarArquivoLocal(caminhoLocal);
    }
}

// ==========================================
// SESSÃO E JWT DO LOGIN
// ==========================================

function extrairUsuario(corpo) {
    const usuario =
        corpo?.usuario
        || corpo?.user
        || corpo?.dados
        || corpo?.data;

    if (
        !usuario
        || typeof usuario !== "object"
    ) {
        return null;
    }

    return {
        id:
            usuario.id
            ?? usuario.id_usuario
            ?? usuario.usuario_id
            ?? null,

        email:
            usuario.email
            || null,

        tipo:
            usuario.tipo,

        cargo:
            usuario.cargo
    };
}

async function prepararSessao(req, res, corpo) {
    if (
        res.statusCode >= 400
        || !corpo
        || typeof corpo !== "object"
        || corpo.sucesso === false
    ) {
        return;
    }

    const usuario = extrairUsuario(corpo);

    if (!usuario) return;

    if (!usuario.id && usuario.email) {
        const [linhas] = await db.query(
            `
                SELECT
                    id,
                    tipo,
                    cargo
                FROM usuarios
                WHERE email = ?
                  AND deleted_at IS NULL
                LIMIT 1
            `,
            [usuario.email]
        );

        if (linhas.length) {
            Object.assign(
                usuario,
                linhas[0]
            );
        }
    }

    if (!usuario.id) return;

    if (req.session) {
        req.session.usuario = {
            id: usuario.id,
            tipo: usuario.tipo,
            cargo: usuario.cargo
        };

        await new Promise((resolve, reject) => {
            req.session.save((erro) => {
                if (erro) {
                    return reject(erro);
                }

                return resolve();
            });
        });
    }

    if (!corpo.token) {
        if (!process.env.JWT_SECRET) {
            throw new Error(
                "JWT_SECRET não foi configurado."
            );
        }

        corpo.token = jwt.sign(
            {
                id: usuario.id,
                tipo: usuario.tipo
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );
    }
}

function comSessao(handler) {
    return (req, res, next) => {
        const jsonOriginal =
            res.json.bind(res);

        res.json = (corpo) => {
            Promise.resolve(
                prepararSessao(
                    req,
                    res,
                    corpo
                )
            )
                .then(() => {
                    jsonOriginal(corpo);
                })
                .catch(next);

            return res;
        };

        return handler(
            req,
            res,
            next
        );
    };
}

// ==========================================
// LIMITE DA RECUPERAÇÃO DE SENHA
// ==========================================

function limitarRecuperacao(req, res, next) {
    const agora = Date.now();

    const chave =
        req.ip
        || req.socket.remoteAddress
        || "desconhecido";

    const registro =
        tentativasRecuperacao.get(chave);

    if (
        !registro
        || agora - registro.inicio
            >= JANELA_RECUPERACAO_MS
    ) {
        tentativasRecuperacao.set(
            chave,
            {
                inicio: agora,
                total: 1
            }
        );

        return next();
    }

    if (
        registro.total
        >= MAX_RECUPERACOES_POR_IP
    ) {
        return res.status(429).json({
            sucesso: false,
            erro:
                "Muitas tentativas. Aguarde alguns minutos e tente novamente."
        });
    }

    registro.total += 1;

    return next();
}

// ==========================================
// TOKEN E SENHA
// ==========================================

function hashToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

function senhaValida(senha) {
    return (
        typeof senha === "string"
        && senha.length >= 8
        && senha.length <= 72
    );
}

// ==========================================
// CADASTRO, LOGIN E VERIFICAÇÃO
// ==========================================

router.post(
    "/cadastro",
    usuarioController.cadastrarUsuario
);

router.post(
    "/login",
    comSessao(
        usuarioController.loginUsuario
    )
);

router.get(
    "/verificar-email/:token",
    usuarioController.verificarEmail
);

// ==========================================
// SOLICITAR RECUPERAÇÃO DE SENHA
// ==========================================

router.post(
    "/esqueci-senha",
    limitarRecuperacao,
    async (req, res) => {
        const email = String(
            req.body?.email || ""
        )
            .trim()
            .toLowerCase();

        if (!email) {
            return res.status(400).json({
                sucesso: false,
                erro: "O e-mail é obrigatório."
            });
        }

        try {
            const [usuarios] = await db.query(
                `
                    SELECT
                        id,
                        email
                    FROM usuarios
                    WHERE email = ?
                      AND deleted_at IS NULL
                    LIMIT 1
                `,
                [email]
            );

            if (usuarios.length > 0) {
                const usuario = usuarios[0];

                const tokenOriginal =
                    crypto
                        .randomBytes(32)
                        .toString("hex");

                const tokenHash =
                    hashToken(tokenOriginal);

                const expiracao =
                    new Date(
                        Date.now()
                        + 10 * 60 * 1000
                    );

                await db.query(
                    `
                        UPDATE usuarios
                        SET
                            token_recuperacao = ?,
                            token_expiracao = ?
                        WHERE id = ?
                    `,
                    [
                        tokenHash,
                        expiracao,
                        usuario.id
                    ]
                );

                try {
                    await enviarEmailRecuperacao(
                        usuario.email,
                        tokenOriginal
                    );
                } catch (erroEmail) {
                    await db.query(
                        `
                            UPDATE usuarios
                            SET
                                token_recuperacao = NULL,
                                token_expiracao = NULL
                            WHERE id = ?
                              AND token_recuperacao = ?
                        `,
                        [
                            usuario.id,
                            tokenHash
                        ]
                    );

                    console.error(
                        "[recuperação] Falha no envio do e-mail:",
                        erroEmail.message
                    );
                }
            }

            return res.status(200).json({
                sucesso: true,
                mensagem: RESPOSTA_RECUPERACAO
            });
        } catch (erro) {
            console.error(
                "[recuperação] Erro interno:",
                erro.code || erro.message
            );

            return res.status(500).json({
                sucesso: false,
                erro:
                    "Erro interno ao processar a recuperação de senha."
            });
        }
    }
);

// ==========================================
// REDEFINIR SENHA
// ==========================================

router.post(
    "/redefinir-senha",
    async (req, res) => {
        const token = String(
            req.body?.token || ""
        ).trim();

        const novaSenha =
            req.body?.novaSenha;

        if (!/^[a-f0-9]{64}$/i.test(token)) {
            return res.status(400).json({
                sucesso: false,
                erro: "Token inválido ou expirado."
            });
        }

        if (!senhaValida(novaSenha)) {
            return res.status(400).json({
                sucesso: false,
                erro:
                    "A nova senha deve possuir entre 8 e 72 caracteres."
            });
        }

        try {
            const tokenHash =
                hashToken(token);

            const [usuarios] = await db.query(
                `
                    SELECT
                        id,
                        senha
                    FROM usuarios
                    WHERE token_recuperacao = ?
                      AND token_expiracao > NOW()
                      AND deleted_at IS NULL
                    LIMIT 1
                `,
                [tokenHash]
            );

            if (usuarios.length === 0) {
                return res.status(400).json({
                    sucesso: false,
                    erro: "Token inválido ou expirado."
                });
            }

            const usuario = usuarios[0];

            const senhaRepetida =
                await bcrypt.compare(
                    novaSenha,
                    usuario.senha
                );

            if (senhaRepetida) {
                return res.status(400).json({
                    sucesso: false,
                    erro:
                        "A nova senha não pode ser igual à senha atual."
                });
            }

            const hash =
                await bcrypt.hash(
                    novaSenha,
                    12
                );

            await db.query(
                `
                    UPDATE usuarios
                    SET
                        senha = ?,
                        token_recuperacao = NULL,
                        token_expiracao = NULL
                    WHERE id = ?
                      AND token_recuperacao = ?
                `,
                [
                    hash,
                    usuario.id,
                    tokenHash
                ]
            );

            return res.status(200).json({
                sucesso: true,
                mensagem:
                    "Senha redefinida com sucesso!"
            });
        } catch (erro) {
            console.error(
                "[recuperação] Erro ao redefinir senha:",
                erro.code || erro.message
            );

            return res.status(500).json({
                sucesso: false,
                erro:
                    "Erro interno ao redefinir a senha."
            });
        }
    }
);

// ==========================================
// ENVIAR FOTO DE PERFIL PARA O CLOUDINARY
// ==========================================

router.post(
    "/upload-foto",
    authUser,
    processarFotoPerfil,
    async (req, res) => {
        const arquivo = req.file;

        const usuarioId = Number(
            req.usuario?.id
        );

        let novaFoto = null;
        let fotoSalvaNoBanco = false;

        if (!arquivo) {
            return res.status(400).json({
                sucesso: false,
                erro: "Nenhum arquivo enviado."
            });
        }

        if (
            !Number.isInteger(usuarioId)
            || usuarioId <= 0
        ) {
            return res.status(401).json({
                sucesso: false,
                erro: "Usuário não autenticado."
            });
        }

        try {
            const [usuarios] = await db.query(
                `
                    SELECT foto_perfil
                    FROM usuarios
                    WHERE id = ?
                      AND deleted_at IS NULL
                    LIMIT 1
                `,
                [usuarioId]
            );

            if (usuarios.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    erro: "Usuário não encontrado."
                });
            }

            const fotoAnterior =
                usuarios[0].foto_perfil;

            novaFoto = await enviarImagem(
                arquivo.buffer,
                {
                    pasta:
                        `motorflex/perfis/${usuarioId}`
                }
            );

            const fotoUrl =
                novaFoto.url;

            const [resultado] = await db.query(
                `
                    UPDATE usuarios
                    SET foto_perfil = ?
                    WHERE id = ?
                      AND deleted_at IS NULL
                `,
                [
                    fotoUrl,
                    usuarioId
                ]
            );

            if (resultado.affectedRows === 0) {
                try {
                    await removerImagem(
                        novaFoto.publicId
                    );
                    novaFoto = null;
                } catch (erroRemocao) {
                    console.warn(
                        "[upload] Não foi possível limpar a imagem não utilizada:",
                        erroRemocao.message
                    );
                }

                return res.status(404).json({
                    sucesso: false,
                    erro: "Usuário não encontrado."
                });
            }

            fotoSalvaNoBanco = true;

            await removerFotoAnterior(
                fotoAnterior
            );

            return res.status(200).json({
                sucesso: true,
                mensagem:
                    "Foto de perfil atualizada com sucesso!",
                fotoUrl
            });
        } catch (erro) {
            /*
             * Se a imagem chegou ao Cloudinary, mas não foi
             * salva no banco, remove a imagem órfã.
             */
            if (
                novaFoto?.publicId
                && !fotoSalvaNoBanco
            ) {
                try {
                    await removerImagem(
                        novaFoto.publicId
                    );
                } catch (erroRemocao) {
                    console.warn(
                        "[upload] Não foi possível limpar a nova imagem:",
                        erroRemocao.message
                    );
                }
            }

            console.error(
                "[upload] Erro ao salvar foto:",
                erro.code || erro.message
            );

            const cloudinaryNaoConfigurado =
                erro.codigo
                === "CLOUDINARY_NAO_CONFIGURADO";

            return res.status(500).json({
                sucesso: false,
                erro: cloudinaryNaoConfigurado
                    ? "O armazenamento de imagens não está configurado."
                    : "Erro interno ao salvar a foto."
            });
        }
    }
);

// ==========================================
// REMOVER FOTO DE PERFIL
//
// Esta rota deve ficar antes de DELETE /:id.
// ==========================================

router.delete(
    "/remover-foto",
    authUser,
    async (req, res) => {
        const usuarioId = Number(
            req.usuario?.id
        );

        if (
            !Number.isInteger(usuarioId)
            || usuarioId <= 0
        ) {
            return res.status(401).json({
                sucesso: false,
                erro: "Usuário não autenticado."
            });
        }

        try {
            const [usuarios] = await db.query(
                `
                    SELECT foto_perfil
                    FROM usuarios
                    WHERE id = ?
                      AND deleted_at IS NULL
                    LIMIT 1
                `,
                [usuarioId]
            );

            if (usuarios.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    erro: "Usuário não encontrado."
                });
            }

            const fotoAnterior =
                usuarios[0].foto_perfil;

            const [resultado] = await db.query(
                `
                    UPDATE usuarios
                    SET foto_perfil = NULL
                    WHERE id = ?
                      AND deleted_at IS NULL
                `,
                [usuarioId]
            );

            if (resultado.affectedRows === 0) {
                return res.status(404).json({
                    sucesso: false,
                    erro: "Usuário não encontrado."
                });
            }

            /*
             * A foto é retirada primeiro do banco.
             * Se o Cloudinary estiver momentaneamente indisponível,
             * isso não desconecta o usuário nem desfaz a remoção.
             */
            await removerFotoAnterior(
                fotoAnterior
            );

            return res.status(200).json({
                sucesso: true,
                mensagem:
                    "Foto de perfil removida com sucesso!",
                fotoUrl: null
            });
        } catch (erro) {
            console.error(
                "[upload] Erro ao remover foto:",
                erro.code || erro.message
            );

            return res.status(500).json({
                sucesso: false,
                erro:
                    "Erro interno ao remover a foto."
            });
        }
    }
);

// ==========================================
// PAINEL ADMINISTRATIVO
// ==========================================

router.get(
    "/",
    authAdmin,
    usuarioController.listarUsuarios
);

router.get(
    "/admin/estatisticas",
    authAdmin,
    usuarioController.obterEstatisticasAdmin
);

router.get(
    "/admin/cadastros-mes",
    authAdmin,
    usuarioController.obterCadastrosPorMes
);

router.delete(
    "/:id",
    authAdmin,
    usuarioController.deletarUsuario
);

router.put(
    "/:id/tipo",
    authAdmin,
    async (req, res) => {
        const id =
            Number(req.params.id);

        const { tipo } =
            req.body;

        if (
            !Number.isInteger(id)
            || id <= 0
        ) {
            return res.status(400).json({
                sucesso: false,
                erro: "ID inválido."
            });
        }

        if (!TIPOS_VALIDOS.includes(tipo)) {
            return res.status(400).json({
                sucesso: false,
                erro:
                    `Tipo inválido. Use: ${TIPOS_VALIDOS.join(", ")}.`
            });
        }

        try {
            const [resultado] = await db.query(
                `
                    UPDATE usuarios
                    SET tipo = ?
                    WHERE id = ?
                      AND deleted_at IS NULL
                `,
                [tipo, id]
            );

            if (resultado.affectedRows === 0) {
                return res.status(404).json({
                    sucesso: false,
                    erro: "Usuário não encontrado."
                });
            }

            return res.status(200).json({
                sucesso: true,
                mensagem:
                    `Tipo de acesso alterado para ${tipo} com sucesso!`
            });
        } catch (erro) {
            console.error(
                "[admin] Erro ao alterar tipo:",
                erro.code || erro.message
            );

            return res.status(500).json({
                sucesso: false,
                erro:
                    "Erro interno ao alterar o tipo de acesso."
            });
        }
    }
);

// ==========================================
// VERIFICAR SENHA DO USUÁRIO AUTENTICADO
// ==========================================

router.post(
    "/verificar-senha",
    authUser,
    async (req, res) => {
        const usuarioId = Number(
            req.usuario?.id
        );

        const senha = String(
            req.body?.senha || ""
        );

        if (
            !Number.isInteger(usuarioId)
            || usuarioId <= 0
        ) {
            return res.status(401).json({
                sucesso: false,
                erro: "Usuário não autenticado."
            });
        }

        if (!senha) {
            return res.status(400).json({
                sucesso: false,
                erro: "A senha é obrigatória."
            });
        }

        try {
            const [usuarios] = await db.query(
                `
                    SELECT senha
                    FROM usuarios
                    WHERE id = ?
                      AND deleted_at IS NULL
                    LIMIT 1
                `,
                [usuarioId]
            );

            if (usuarios.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    erro: "Usuário não encontrado."
                });
            }

            const correta =
                await bcrypt.compare(
                    senha,
                    usuarios[0].senha
                );

            return res.status(200).json({
                sucesso: correta,

                ...(correta
                    ? {
                        mensagem:
                            "Senha verificada com sucesso!"
                    }
                    : {
                        erro:
                            "Senha incorreta."
                    })
            });
        } catch (erro) {
            console.error(
                "[senha] Erro ao verificar senha:",
                erro.code || erro.message
            );

            return res.status(500).json({
                sucesso: false,
                erro:
                    "Erro interno ao verificar a senha."
            });
        }
    }
);

module.exports = router;