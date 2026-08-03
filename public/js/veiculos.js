const express = require("express");
const router = express.Router();

const db = require("../config/db");

// ==========================================
// CADASTRAR VEÍCULO
// ==========================================
router.post("/", async (req, res) => {

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

        // ======================================
        // VALIDAÇÕES
        // ======================================
        if (
            !usuario_id ||
            !marca ||
            !modelo ||
            !ano_fabricacao ||
            !ano_modelo ||
            !preco
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Preencha todos os campos obrigatórios."
            });
        }

        // ======================================
        // INSERT
        // ======================================
        await db.query(
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
            ]
        );

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

// ==========================================
// LISTAR VEÍCULOS
// ==========================================
router.get("/", async (req, res) => {

    try {

        const [veiculos] = await db.query(
            `
            SELECT 
                veiculos.*,
                usuarios.nome,
                usuarios.sobrenome
            FROM veiculos
            INNER JOIN usuarios
            ON usuarios.id = veiculos.usuario_id
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