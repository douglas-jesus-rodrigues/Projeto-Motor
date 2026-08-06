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
            marca,       // Texto enviado pelo front-end (ex: "Honda")
            modelo,      // Texto enviado pelo front-end (ex: "Civic")
            versao,
            ano_fabricacao,
            ano_modelo,
            preco,
            quilometragem,
            combustivel, // Texto enviado pelo front-end (ex: "flex")
            cambio,      // Texto enviado pelo front-end (ex: "manual")
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

        // 1. RESOLVER MARCA_ID (Busca ou cadastra a marca para obter o ID)
        let marcaId;
        const [marcaRows] = await db.query("SELECT id FROM marca WHERE LOWER(nome) = LOWER(?)", [marca]);
        if (marcaRows.length > 0) {
            marcaId = marcaRows[0].id;
        } else {
            const [novaMarca] = await db.query("INSERT INTO marca (nome) VALUES (?)", [marca]);
            marcaId = novaMarca.insertId;
        }

        // 2. RESOLVER MODELO_ID (Busca ou cadastra o modelo vinculado à marca)
        let modeloId;
        const [modeloRows] = await db.query("SELECT id FROM modelo WHERE marca_id = ? AND LOWER(nome) = LOWER(?)", [marcaId, modelo]);
        if (modeloRows.length > 0) {
            modeloId = modeloRows[0].id;
        } else {
            const [novoModelo] = await db.query("INSERT INTO modelo (marca_id, nome) VALUES (?, ?)", [marcaId, modelo]);
            modeloId = novoModelo.insertId;
        }

        // 3. RESOLVER TIPO_COMBUSTIVEL_ID
        let combustivelId = 3; // Padrão flex
        if (combustivel) {
            const [combRows] = await db.query("SELECT id FROM tipo_combustivel WHERE LOWER(nome) = LOWER(?)", [combustivel]);
            if (combRows.length > 0) combustivelId = combRows[0].id;
        }

        // 4. RESOLVER TIPO_TRANSMISSAO_ID
        let transmissaoId = 1; // Padrão manual
        if (cambio) {
            const [transRows] = await db.query("SELECT id FROM tipo_transmissao WHERE LOWER(nome) = LOWER(?)", [cambio]);
            if (transRows.length > 0) transmissaoId = transRows[0].id;
        }

        // 5. INSERIR O VEÍCULO USANDO AS CHAVES ESTRANGEIRAS CORRETAS
        const [resultado] = await db.query(
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `,
            [
                usuario_id,
                marcaId,
                modeloId,
                versao || null,
                ano_fabricacao,
                ano_modelo,
                preco,
                quilometragem || 0,
                combustivelId,
                transmissaoId,
                cor || null,
                portas || null,
                carroceria || null,
                descricao || null
            ]
        );

        const veiculoId = resultado.insertId;

        // 6. SALVAR O REGISTRO DA FOTO SE HOUVER ARQUIVO
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
        console.error("Erro ao cadastrar veículo:", erro);
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
                marca.nome AS marca_nome,
                modelo.nome AS modelo_nome,
                fotos_veiculos.imagem AS imagem
            FROM veiculos
            LEFT JOIN marca ON marca.id = veiculos.marca_id
            LEFT JOIN modelo ON modelo.id = veiculos.modelo_id
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
        console.error("Erro ao listar veículos:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar veículos."
        });
    }
});

module.exports = router;

// LISTAR APENAS OS VEÍCULOS DE UM USUÁRIO ESPECÍFICO
router.get("/usuario/:usuarioId", async (req, res) => {
    const { usuarioId } = req.params;

    try {
        const [veiculos] = await db.query(
            `
            SELECT 
                veiculos.*,
                marca.nome AS marca,
                modelo.nome AS modelo,
                fotos_veiculos.imagem AS imagem
            FROM veiculos
            LEFT JOIN marca ON marca.id = veiculos.marca_id
            LEFT JOIN modelo ON modelo.id = veiculos.modelo_id
            LEFT JOIN fotos_veiculos
            ON fotos_veiculos.veiculo_id = veiculos.id
            AND fotos_veiculos.principal = true
            WHERE veiculos.usuario_id = ?
            ORDER BY veiculos.id DESC
            `,
            [usuarioId]
        );

        return res.status(200).json({
            sucesso: true,
            veiculos
        });

    } catch (erro) {
        console.error("Erro ao buscar veículos do usuário:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar os anúncios do usuário."
        });
    }
});