const express = require("express");
const router = express.Router();
// Importe a sua conexão com o banco de dados (Ajuste o caminho para onde fica seu pool/conexão)
const db = require("../config/db"); // Exemplo: ajustado para a sua pasta de banco

// 1. Obter total de usuários (para o card do painel)
router.get("/usuarios/total", async (req, res) => {
    try {
        const [resultado] = await db.query("SELECT COUNT(*) AS total FROM usuarios");
        res.json({ total: resultado[0].total });
    } catch (erro) {
        console.error("Erro ao buscar total de usuários:", erro);
        res.status(500).json({ erro: "Erro no servidor ao contar usuários" });
    }
});

// 2. Obter total de anúncios/veículos (para o card do painel)
router.get("/anuncios/total", async (req, res) => {
    try {
        const [resultado] = await db.query("SELECT COUNT(*) AS total FROM veiculos");
        res.json({ total: resultado[0].total });
    } catch (erro) {
        console.error("Erro ao buscar total de anúncios:", erro);
        res.status(500).json({ erro: "Erro no servidor ao contar anúncios" });
    }
});

// 3. Listar todos os usuários (para a tabela em usuarios.html)
router.get("/usuarios", async (req, res) => {
    try {
        const [usuarios] = await db.query("SELECT id, nome, email, tipo FROM usuarios ORDER BY id DESC");
        res.json(usuarios);
    } catch (erro) {
        console.error("Erro ao listar usuários:", erro);
        res.status(500).json({ erro: "Erro ao buscar a lista de usuários" });
    }
});

// 4. Alterar o tipo do usuário (Cliente <-> Admin)
router.put("/usuarios/:id/tipo", async (req, res) => {
    const { id } = req.params;
    const { tipo } = req.body; // Espera receber 'admin' ou 'cliente'

    try {
        await db.query("UPDATE usuarios SET tipo = ? WHERE id = ?", [tipo, id]);
        res.json({ sucesso: true, mensagem: "Tipo de usuário alterado com sucesso!" });
    } catch (erro) {
        console.error("Erro ao alterar tipo do usuário:", erro);
        res.status(500).json({ erro: "Erro ao atualizar permissão do usuário" });
    }
});

// 5. Excluir usuário do banco de dados
router.delete("/usuarios/:id", async (req, res) => {
    const { id } = req.params;

    try {
        await db.query("DELETE FROM usuarios WHERE id = ?", [id]);
        res.json({ sucesso: true, mensagem: "Usuário excluído com sucesso!" });
    } catch (erro) {
        console.error("Erro ao excluir usuário:", erro);
        res.status(500).json({ erro: "Erro ao excluir o usuário do banco de dados" });
    }
});

module.exports = router;