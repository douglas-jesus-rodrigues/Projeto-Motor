const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Campos que NUNCA saem do servidor
const SECRETOS = ["senha", "token_verificacao", "token_recuperacao", "token_expiracao"];

// ==========================================
// GET /api/perfil/meu-perfil?id=123
//   individual / admin → dados do usuário (+ endereço, se houver)
//   empresa            → dados do usuário + dados da empresa (+ endereço)
// Usa SELECT * e escolhe os campos em JS: não quebra se o banco tiver
// alguma coluna com nome diferente do esperado.
// ==========================================
router.get("/meu-perfil", async (req, res) => {
    const id = Number(req.query.id);
    if (!id) return res.status(400).json({ sucesso: false, mensagem: "ID de usuário inválido." });

    try {
        const [linhas] = await db.query("SELECT * FROM usuarios WHERE id = ? LIMIT 1", [id]);
        const u = linhas[0];
        if (!u || u.deleted_at) {
            return res.status(404).json({ sucesso: false, mensagem: "Usuário não encontrado." });
        }

        const usuario = { ...u };
        SECRETOS.forEach((c) => delete usuario[c]);

        // Compatibilidade: o front lê "foto_perfil"
        if (!usuario.foto_perfil && usuario.foto_url) usuario.foto_perfil = usuario.foto_url;

        // Dados corporativos — só para contas do tipo empresa
        if (String(u.tipo).toLowerCase() === "empresa") {
            try {
                const [emp] = await db.query("SELECT * FROM empresas WHERE usuario_id = ? LIMIT 1", [id]);
                if (emp[0]) {
                    const { id: _i, usuario_id: _u, criado_em: _c, atualizado_em: _a, ...dadosEmpresa } = emp[0];
                    Object.assign(usuario, dadosEmpresa);
                }
            } catch (e) {
                console.error("⚠️ /meu-perfil — falha ao ler 'empresas':", e.sqlMessage || e);
            }
        }

        // Endereço — se a tabela/colunas falharem, o perfil continua carregando
        try {
            const [end] = await db.query("SELECT * FROM enderecos WHERE usuario_id = ? ORDER BY id DESC LIMIT 1", [id]);
            const e = end[0];
            usuario.endereco = e
                ? { cep: e.cep, estado: e.estado, cidade: e.cidade, bairro: e.bairro, rua: e.rua, numero: e.numero, complemento: e.complemento }
                : null;
        } catch (e) {
            console.error("⚠️ /meu-perfil — falha ao ler 'enderecos':", e.sqlMessage || e);
            usuario.endereco = null;
        }

        return res.status(200).json({ sucesso: true, usuario });

    } catch (erro) {
        console.error("❌ Erro em /meu-perfil:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar os dados do perfil." });
    }
});

module.exports = router;