const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Importação corrigida para o seu authMiddleware.js
const authUser = require("../middlewares/authMiddleware"); 

// ==========================================
// GET /api/conversas — Listar todas as conversas do utilizador logado
// ==========================================
router.get("/", authUser, async (req, res) => {
    const meuId = req.usuario.id || req.usuario._id;

    try {
        const [conversas] = await db.query(
            `SELECT 
                c.id, 
                c.veiculo_id, 
                c.status, 
                c.ultima_mensagem, 
                c.ultimo_envio, 
                c.criado_em,
                IF(c.participante_1_id = ?, c.participante_2_id, c.participante_1_id) AS outro_usuario_id,
                CONCAT_WS(' ', u.nome, u.sobrenome) AS outro_usuario_nome,
                u.foto_perfil,
                v.preco AS veiculo_preco,
                m.nome AS veiculo_marca,
                mo.nome AS veiculo_modelo,
                (SELECT f.imagem FROM fotos_veiculos f WHERE f.veiculo_id = v.id ORDER BY f.principal DESC, f.id LIMIT 1) AS veiculo_foto
             FROM conversa c
             JOIN usuarios u ON u.id = IF(c.participante_1_id = ?, c.participante_2_id, c.participante_1_id)
             LEFT JOIN veiculos v ON v.id = c.veiculo_id
             LEFT JOIN marca m ON m.id = v.marca_id
             LEFT JOIN modelo mo ON mo.id = v.modelo_id
             WHERE c.participante_1_id = ? OR c.participante_2_id = ?
             ORDER BY COALESCE(c.ultimo_envio, c.criado_em) DESC`,
            [meuId, meuId, meuId, meuId]
        );

        return res.status(200).json({ sucesso: true, conversas });
    } catch (erro) {
        console.error("❌ Erro ao buscar conversas:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro ao buscar conversas." });
    }
});

// ==========================================
// POST /api/conversas/iniciar — Criar ou obter conversa existente
// ==========================================
router.post("/iniciar", authUser, async (req, res) => {
    const { outro_usuario_id, veiculo_id } = req.body;
    const meuId = req.usuario.id || req.usuario._id;

    if (!outro_usuario_id) {
        return res.status(400).json({ sucesso: false, erro: "ID do outro utilizador é obrigatório." });
    }

    if (Number(meuId) === Number(outro_usuario_id)) {
        return res.status(400).json({ sucesso: false, erro: "Não pode iniciar uma conversa consigo mesmo." });
    }

    try {
        const pMenor = Math.min(meuId, outro_usuario_id);
        const pMaior = Math.max(meuId, outro_usuario_id);
        const vChave = veiculo_id ? Number(veiculo_id) : 0;

        const [existente] = await db.query(
            `SELECT id FROM conversa 
             WHERE participante_menor_id = ? AND participante_maior_id = ? AND veiculo_chave = ?`,
            [pMenor, pMaior, vChave]
        );

        if (existente.length > 0) {
            return res.status(200).json({ sucesso: true, conversa_id: existente[0].id });
        }

        const [nova] = await db.query(
            `INSERT INTO conversa (participante_1_id, participante_2_id, veiculo_id) VALUES (?, ?, ?)`,
            [meuId, outro_usuario_id, veiculo_id || null]
        );

        return res.status(201).json({ sucesso: true, conversa_id: nova.insertId });
    } catch (erro) {
        console.error("❌ Erro ao iniciar conversa:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro ao iniciar conversa." });
    }
});

// ==========================================
// POST /api/conversas/:id/mensagem — Registar envio de nova mensagem
// ==========================================
router.post("/:id/mensagem", authUser, async (req, res) => {
    const { id } = req.params;
    const { texto } = req.body;
    const meuId = req.usuario.id || req.usuario._id;

    if (!texto || !texto.trim()) {
        return res.status(400).json({ sucesso: false, erro: "A mensagem não pode estar vazia." });
    }

    try {
        const [resultado] = await db.query(
            `UPDATE conversa 
             SET ultima_mensagem = ?, 
                 ultimo_envio = NOW(), 
                 total_mensagens = total_mensagens + 1
             WHERE id = ? AND (participante_1_id = ? OR participante_2_id = ?)`,
            [texto.trim(), id, meuId, meuId]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ sucesso: false, erro: "Conversa não encontrada ou sem permissão." });
        }

        return res.status(200).json({ sucesso: true, mensagem: "Mensagem enviada com sucesso!" });
    } catch (erro) {
        console.error("❌ Erro ao enviar mensagem:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro interno ao atualizar a mensagem." });
    }
});

module.exports = router;