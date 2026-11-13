"use strict";

const cloudinary = require("../config/cloudinary");

function verificarConfiguracao() {
    if (!cloudinary.configurado) {
        const erro = new Error(
            "Cloudinary não está configurado no servidor."
        );

        erro.codigo = "CLOUDINARY_NAO_CONFIGURADO";

        throw erro;
    }
}

function enviarImagem(
    buffer,
    {
        pasta = "motorflex",
        publicId = null
    } = {}
) {
    verificarConfiguracao();

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        return Promise.reject(
            new Error("Arquivo de imagem inválido.")
        );
    }

    return new Promise((resolve, reject) => {
        const opcoes = {
            folder: pasta,
            resource_type: "image",
            overwrite: false,
            unique_filename: true,
            use_filename: false
        };

        if (publicId) {
            opcoes.public_id = String(publicId);
            opcoes.overwrite = true;
            opcoes.unique_filename = false;
        }

        const upload = cloudinary.uploader.upload_stream(
            opcoes,
            (erro, resultado) => {
                if (erro) {
                    reject(erro);
                    return;
                }

                resolve({
                    url: resultado.secure_url,
                    publicId: resultado.public_id,
                    largura: resultado.width,
                    altura: resultado.height,
                    formato: resultado.format,
                    tamanho: resultado.bytes
                });
            }
        );

        upload.end(buffer);
    });
}

function extrairPublicIdDaUrl(url) {
    const endereco = String(url || "").trim();

    if (
        !endereco ||
        !endereco.includes("res.cloudinary.com") ||
        !endereco.includes("/upload/")
    ) {
        return null;
    }

    try {
        const depoisDoUpload =
            endereco.split("/upload/")[1];

        if (!depoisDoUpload) {
            return null;
        }

        const semParametros = depoisDoUpload
            .split("?")[0]
            .split("#")[0];

        const partes = semParametros
            .split("/")
            .filter(Boolean);

        const indiceVersao = partes.findIndex(
            (parte) => /^v\d+$/.test(parte)
        );

        const partesPublicId =
            indiceVersao >= 0
                ? partes.slice(indiceVersao + 1)
                : partes;

        const caminho = partesPublicId.join("/");

        if (!caminho) {
            return null;
        }

        return decodeURIComponent(
            caminho.replace(/\.[^/.]+$/, "")
        );
    } catch {
        return null;
    }
}

async function removerImagem(urlOuPublicId) {
    verificarConfiguracao();

    const valor = String(
        urlOuPublicId || ""
    ).trim();

    if (!valor) {
        return {
            removida: false,
            resultado: "identificador_ausente"
        };
    }

    const publicId = valor.startsWith("http")
        ? extrairPublicIdDaUrl(valor)
        : valor;

    if (!publicId) {
        return {
            removida: false,
            resultado: "imagem_externa"
        };
    }

    const resultado =
        await cloudinary.uploader.destroy(
            publicId,
            {
                resource_type: "image",
                invalidate: true
            }
        );

    return {
        removida: [
            "ok",
            "not found"
        ].includes(resultado.result),

        resultado: resultado.result,
        publicId
    };
}

module.exports = {
    enviarImagem,
    removerImagem,
    extrairPublicIdDaUrl
};