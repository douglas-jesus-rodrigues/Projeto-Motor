const express = require("express");
const router = express.Router();
const db = require("../config/db");
const authAdmin = require("../middlewares/authAdmin");

// Executa uma consulta opcional: se a tabela/coluna não existir, devolve o valor padrão
async function tentar(fn, padrao) {
    try { return await fn(); }
    catch (e) { console.error("⚠️ /admin/resumo (opcional):", e.sqlMessage || e.message); return padrao; }
}
const linhas = async (sql, params = []) => (await db.query(sql, params))[0];
const um = async (sql, params = []) => (await linhas(sql, params))[0] || {};
const num = (v) => Number(v) || 0;

// Início da janela de 6 meses (primeiro dia do mês, 5 meses atrás)
const INICIO_SERIE = "DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')";

// ==========================================
// GET /api/admin/resumo — tudo o que o painel administrativo precisa em UMA chamada
// ==========================================
router.get("/resumo", authAdmin, async (req, res) => {
    try {
        const [u, a, empresasPend, denunciasPend, conversasAbertas, su, sa, recUsuarios, recAnuncios] = await Promise.all([
            // ---- usuários
            um(`SELECT COUNT(*) AS total,
                       SUM(tipo = 'individual')  AS individual,
                       SUM(tipo = 'empresa')     AS empresa,
                       SUM(tipo = 'admin')       AS admin,
                       SUM(status = 'ativo')     AS ativos,
                       SUM(status = 'bloqueado') AS bloqueados,
                       SUM(status IN ('inativo','inactive_warning','inactive_expired')) AS inativos,
                       SUM(criado_em >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS novos_30d
                FROM usuarios WHERE deleted_at IS NULL`),

            // ---- anúncios
            um(`SELECT COUNT(*) AS total,
                       SUM(status_anuncio_id = 1) AS ativos,
                       COALESCE(SUM(visualizacoes), 0) AS visualizacoes,
                       SUM(criado_em >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS novos_30d,
                       SUM(NOT EXISTS (SELECT 1 FROM fotos_veiculos f WHERE f.veiculo_id = veiculos.id)) AS sem_foto
                FROM veiculos`),

            // ---- opcionais
            tentar(async () => num((await um("SELECT COUNT(*) AS n FROM empresas WHERE status_verificacao = 'pendente'")).n), 0),
            tentar(async () => num((await um("SELECT COUNT(*) AS n FROM denuncias WHERE status = 'pendente'")).n), 0),
            tentar(async () => num((await um("SELECT COUNT(*) AS n FROM conversa WHERE status = 'aberta'")).n), 0),

            // ---- série dos últimos 6 meses
            linhas(`SELECT DATE_FORMAT(criado_em, '%Y-%m') AS mes, COUNT(*) AS n FROM usuarios
                    WHERE deleted_at IS NULL AND criado_em >= ${INICIO_SERIE} GROUP BY mes`),
            linhas(`SELECT DATE_FORMAT(criado_em, '%Y-%m') AS mes, COUNT(*) AS n FROM veiculos
                    WHERE criado_em >= ${INICIO_SERIE} GROUP BY mes`),

            // ---- recentes
            linhas(`SELECT id, nome, sobrenome, email, tipo, status, foto_perfil, criado_em
                    FROM usuarios WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 5`),
            linhas(`SELECT v.id, v.preco, v.ano_fabricacao, v.ano_modelo, v.visualizacoes, v.criado_em, v.usuario_id,
                           m.nome AS marca, mo.nome AS modelo,
                           (SELECT f.imagem FROM fotos_veiculos f WHERE f.veiculo_id = v.id ORDER BY f.principal DESC, f.id LIMIT 1) AS imagem,
                           CONCAT_WS(' ', us.nome, us.sobrenome) AS dono
                    FROM veiculos v
                    LEFT JOIN marca m ON m.id = v.marca_id
                    LEFT JOIN modelo mo ON mo.id = v.modelo_id
                    LEFT JOIN usuarios us ON us.id = v.usuario_id
                    ORDER BY v.id DESC LIMIT 5`)
        ]);

        const mapU = Object.fromEntries(su.map((r) => [r.mes, num(r.n)]));
        const mapA = Object.fromEntries(sa.map((r) => [r.mes, num(r.n)]));
        const serie = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
            const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            serie.push({ mes, usuarios: mapU[mes] || 0, anuncios: mapA[mes] || 0 });
        }

        res.set("Cache-Control", "no-store");

        return res.status(200).json({
            sucesso: true,
            gerado_em: new Date().toISOString(),
            usuarios: {
                total: num(u.total), individual: num(u.individual), empresa: num(u.empresa), admin: num(u.admin),
                ativos: num(u.ativos), bloqueados: num(u.bloqueados), inativos: num(u.inativos), novos_30d: num(u.novos_30d)
            },
            anuncios: {
                total: num(a.total), ativos: num(a.ativos), visualizacoes: num(a.visualizacoes),
                novos_30d: num(a.novos_30d), sem_foto: num(a.sem_foto)
            },
            pendencias: { empresas_pendentes: empresasPend, denuncias_pendentes: denunciasPend },
            conversas: { total: conversasAbertas },
            serie,
            recentes: { usuarios: recUsuarios, anuncios: recAnuncios }
        });

    } catch (erro) {
        console.error("❌ Erro em /admin/resumo:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro ao montar o resumo administrativo." });
    }
});

// ==========================================
// GET /api/admin/usuarios — LISTAR TODOS OS UTILIZADORES (Para o Painel de Gestão)
// ==========================================
router.get("/usuarios", authAdmin, async (req, res) => {
    try {
        console.log("🟢 A rota /api/admin/usuarios foi acionada com sucesso!");
        const [usuarios] = await db.query(
            `SELECT id, nome, sobrenome, email, cpf, tipo, status FROM usuarios WHERE deleted_at IS NULL ORDER BY id DESC`
        );
        return res.status(200).json({ sucesso: true, usuarios });
    } catch (erro) {
        console.error("❌ Erro ao listar utilizadores:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro ao buscar utilizadores." });
    }
});

// ==========================================
// PUT /api/admin/usuarios/:id/tipo — ALTERAR TIPO DE ACESSO
// ==========================================
router.put("/usuarios/:id/tipo", authAdmin, async (req, res) => {
    const { id } = req.params;
    const { tipo } = req.body;

    const tiposValidos = ["admin", "empresa", "individual"];
    if (!tipo || !tiposValidos.includes(tipo.toLowerCase().trim())) {
        return res.status(400).json({ sucesso: false, erro: "Tipo de acesso inválido." });
    }

    try {
        const [resultado] = await db.query(
            `UPDATE usuarios SET tipo = ? WHERE id = ?`,
            [tipo.toLowerCase().trim(), id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ sucesso: false, erro: "Utilizador não encontrado." });
        }

        return res.status(200).json({ sucesso: true, mensagem: "Tipo de acesso alterado com sucesso!" });
    } catch (erro) {
        console.error("❌ Erro ao alterar tipo de utilizador:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro interno ao atualizar o tipo de utilizador." });
    }
});

// ==========================================
// DELETE /api/admin/usuarios/:id — EXCLUIR UTILIZADOR
// ==========================================
router.delete("/usuarios/:id", authAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const [resultado] = await db.query(
            `DELETE FROM usuarios WHERE id = ?`,
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ sucesso: false, erro: "Utilizador não encontrado para exclusão." });
        }

        return res.status(200).json({ sucesso: true, mensagem: "Utilizador excluído com sucesso!" });
    } catch (erro) {
        console.error("❌ Erro ao excluir utilizador:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro interno ao excluir o utilizador." });
    }
});

module.exports = router