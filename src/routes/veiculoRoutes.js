const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");

const db = require("../config/db");

// CONFIGURAÇÃO DO MULTER
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, "../../public/uploads"));
    },
    filename: function (req, file, cb) {
        const nomeArquivo = Date.now() + "-" + file.originalname;
        cb(null, nomeArquivo);
    }
});

const upload = multer({ storage });

// CADASTRAR VEÍCULO COM FOTO
router.post("/", upload.single("imagem"), async (req, res) => {
    try {
        const {
            usuario_id,
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

        if (!usuario_id || !marca || !modelo || !ano_fabricacao || !ano_modelo || !preco) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Preencha todos os campos obrigatórios."
            });
        }

        const [resultado] = await db.query(
            `
            INSERT INTO veiculos
            (
                usuario_id,
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
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                usuario_id,
                marca,
                modelo,
                versao || null,
                ano_fabricacao,
                ano_modelo,
                preco,
                quilometragem || 0,
                combustivel || "flex",
                cambio || "manual",
                cor || null,
                portas || null,
                carroceria || null,
                descricao || null
            ]
        );

        const veiculoId = resultado.insertId;

        if (req.file) {
            await db.query(
                `
                INSERT INTO fotos_veiculos
                (veiculo_id, imagem, principal)
                VALUES (?, ?, ?)
                `,
                [veiculoId, req.file.filename, true]
            );
        }

        return res.status(201).json({
            sucesso: true,
            mensagem: "Veículo publicado com sucesso!"
        });

    } catch (erro) {
        console.error("Erro ao cadastrar veículo:");
        console.error(erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno no servidor."
        });
    }
});

// LISTAR VEÍCULOS COM FOTO PRINCIPAL
router.get("/", async (req, res) => {
    try {
        const [veiculos] = await db.query(
            `
            SELECT 
                veiculos.*,
                fotos_veiculos.imagem AS imagem
            FROM veiculos
            LEFT JOIN fotos_veiculos
            ON fotos_veiculos.veiculo_id = veiculos.id
            AND fotos_veiculos.principal = true
            ORDER BY veiculos.id DESC
            `
        );

        return res.status(200).json({
            sucesso: true,
            veiculos
        });

    } catch (erro) {
        console.error("Erro ao listar veículos:");
        console.error(erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar veículos."
        });
    }
});

module.exports = router;