const express = require("express");
const router = express.Router();
const db = require("../config/db");
const authUser = require("../middlewares/authMiddleware");

// ==========================================
// GET /api/conversas — Listar conversas ativas na sidebar
// ==========================================
router.get("/", authUser, async (req, res) => {
    const meuId = req.usuario.id;

    try {
        const [conversas] = await db.query(
            `SELECT 
                m.id, 
                m.veiculo_id, 
                m.status, 
                m.ultima_mensagem, 
                m.ultimo_envio, 
                m.criado_em,
                IF(m.participante_1_id = ?, m.participante_2_id, m.participante_1_id) AS outro_usuario_id,
                CONCAT_WS(' ', u.nome, u.sobrenome) AS outro_usuario_nome,
                u.foto_perfil,
                v.preco AS veiculo_preco,
                mar.nome AS veiculo_marca,
                mo.nome AS veiculo_modelo
             FROM mensagens m
             JOIN usuarios u ON u.id = IF(m.participante_1_id = ?, m.participante_2_id, m.participante_1_id)
             LEFT JOIN veiculos v ON v.id = m.veiculo_id
             LEFT JOIN marca mar ON mar.id = v.marca_id
             LEFT JOIN modelo mo ON mo.id = v.modelo_id
             WHERE (m.participante_1_id = ? OR m.participante_2_id = ?)
               AND (m.excluido_para_usuario_id IS NULL OR m.excluido_para_usuario_id != ?)
               AND m.excluido_para_todos = 0
             ORDER BY COALESCE(m.ultimo_envio, m.criado_em) DESC`,
            [meuId, meuId, meuId, meuId, meuId]
        );

        return res.status(200).json({ sucesso: true, conversas });
    } catch (erro) {
        console.error("❌ Erro ao buscar conversas:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro ao buscar conversas." });
    }
});

// ==========================================
// GET /api/conversas/:id/mensagens — Carregar histórico (visível até 10 dias)
// ==========================================
router.get("/:id/mensagens", authUser, async (req, res) => {
    const { id } = req.params;
    const meuId = req.usuario.id;

    try {
        // Busca as mensagens da tabela 'mensagens' criadas nos últimos 10 dias
        const [mensagens] = await db.query(
            `SELECT 
                m.id,
                m.ultima_mensagem AS texto,
                m.ultimo_envio AS criado_em,
                m.participante_1_id AS remetente_id,
                (m.participante_1_id = ?) AS enviada_por_mim
             FROM mensagens m
             WHERE m.id = ?
               AND (m.participante_1_id = ? OR m.participante_2_id = ?)
               AND m.criado_em >= NOW() - INTERVAL 10 DAY
               AND (m.excluido_para_usuario_id IS NULL OR m.excluido_para_usuario_id != ?)
               AND m.excluido_para_todos = 0
             ORDER BY m.criado_em ASC`,
            [meuId, id, meuId, meuId, meuId]
        );

        return res.status(200).json({ sucesso: true, mensagens });
    } catch (erro) {
        console.error("❌ Erro ao buscar mensagens:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro ao carregar mensagens." });
    }
});

// ==========================================
// POST /api/conversas/iniciar — Criar ou obter conversa
// ==========================================
router.post("/iniciar", authUser, async (req, res) => {
    const { outro_usuario_id, veiculo_id } = req.body;
    const meuId = req.usuario.id;

    if (!outro_usuario_id) {
        return res.status(400).json({ sucesso: false, erro: "ID do outro usuário é obrigatório." });
    }

    if (Number(meuId) === Number(outro_usuario_id)) {
        return res.status(400).json({ sucesso: false, erro: "Não pode iniciar uma conversa consigo mesmo." });
    }

    try {
        const [existente] = await db.query(
            `SELECT id FROM mensagens 
             WHERE ((participante_1_id = ? AND participante_2_id = ?) 
                OR (participante_1_id = ? AND participante_2_id = ?))
               AND (veiculo_id = ? OR (veiculo_id IS NULL AND ? IS NULL))`,
            [meuId, outro_usuario_id, outro_usuario_id, meuId, veiculo_id || null, veiculo_id || null]
        );

        if (existente.length > 0) {
            return res.status(200).json({ sucesso: true, conversa_id: existente[0].id });
        }

        const [nova] = await db.query(
            `INSERT INTO mensagens (participante_1_id, participante_2_id, veiculo_id, criado_em) VALUES (?, ?, ?, NOW())`,
            [meuId, outro_usuario_id, veiculo_id || null]
        );

        return res.status(201).json({ sucesso: true, conversa_id: nova.insertId });
    } catch (erro) {
        console.error("❌ Erro ao iniciar conversa:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro ao iniciar conversa." });
    }
});

// ==========================================
// POST /api/conversas/:id/mensagem — Enviar nova mensagem
// ==========================================
router.post("/:id/mensagem", authUser, async (req, res) => {
    const { id } = req.params;
    const { texto } = req.body;
    const meuId = req.usuario.id;

    if (!texto || !texto.trim()) {
        return res.status(400).json({ sucesso: false, erro: "A mensagem não pode estar vazia." });
    }

    try {
        const [resultado] = await db.query(
            `UPDATE mensagens 
             SET ultima_mensagem = ?, 
                 ultimo_envio = NOW(), 
                 excluido_para_todos = 0,
                 excluido_para_usuario_id = NULL
             WHERE id = ? AND (participante_1_id = ? OR participante_2_id = ?)`,
            [texto.trim(), id, meuId, meuId]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ sucesso: false, erro: "Registro não encontrado ou sem permissão." });
        }

        return res.status(200).json({ sucesso: true, mensagem: "Mensagem enviada com sucesso!" });
    } catch (erro) {
        console.error("❌ Erro ao enviar mensagem:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro interno ao atualizar mensagem." });
    }
});

// ==========================================
// DELETE /api/conversas/mensagem/:id — Apagar mensagem
// ==========================================
router.delete("/mensagem/:id", authUser, async (req, res) => {
    const { id } = req.params;
    const { tipo } = req.body;
    const meuId = req.usuario.id;

    try {
        if (tipo === "para_todos") {
            await db.query(
                `UPDATE mensagens SET excluido_para_todos = 1 WHERE id = ? AND (participante_1_id = ? OR participante_2_id = ?)`,
                [id, meuId, meuId]
            );
        } else {
            await db.query(
                `UPDATE mensagens SET excluido_para_usuario_id = ? WHERE id = ?`,
                [meuId, id]
            );
        }

        return res.status(200).json({ sucesso: true, mensagem: "Mensagem removida com sucesso!" });
    } catch (erro) {
        console.error("❌ Erro ao apagar mensagem:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro ao apagar mensagem." });
    }
});

module.exports = router;