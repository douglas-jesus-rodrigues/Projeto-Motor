const db = require("../config/db");

// ==========================================
// GERENCIAR DENÚNCIA (MANTER OU REMOVER)
// ==========================================
exports.gerenciarDenuncia = async (req, res) => {
    let conn;

    try {
        const { id, acao } = req.params; // id = ID do Anúncio

        if (!id || !acao) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Parâmetros inválidos ou ausentes."
            });
        }

        if (acao !== "manter" && acao !== "remover") {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Ação de moderação inválida."
            });
        }

        conn = await db.getConnection();
        await conn.beginTransaction();

        if (acao === "manter") {
            // AÇÃO: Ignorar denúncia
            // Atualiza o status de todas as denúncias deste anúncio para 'arquivada'
            await conn.query(
                `
                UPDATE denuncias 
                SET status = 'arquivada', atualizado_em = NOW() 
                WHERE anuncio_id = ? AND status = 'pendente'
                `,
                [id]
            );

            await conn.commit();

            return res.status(200).json({
                sucesso: true,
                mensagem: "Denúncia arquivada. O anúncio foi mantido no catálogo."
            });
        }

        if (acao === "remover") {
            // AÇÃO: Aceitar denúncia e tirar o veículo do ar
            // 1. Desativa o anúncio/veículo (Exclusão Lógica)
            await conn.query(
                `
                UPDATE veiculos 
                SET ativo = false, atualizado_em = NOW() 
                WHERE id = ?
                `,
                [id]
            );

            // 2. Atualiza o status das denúncias desse anúncio para 'aceita' ou 'resolvida'
            await conn.query(
                `
                UPDATE denuncias 
                SET status = 'resolvida', atualizado_em = NOW() 
                WHERE anuncio_id = ? AND status = 'pendente'
                `,
                [id]
            );

            await conn.commit();

            return res.status(200).json({
                sucesso: true,
                mensagem: "Anúncio removido do catálogo com sucesso."
            });
        }

    } catch (erro) {
        if (conn) await conn.rollback();

        console.error("Erro ao processar moderação no banco:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno no servidor ao salvar decisão."
        });

    } finally {
        if (conn) conn.release();
    }
};
