const db = require("../config/db");

exports.obterPerfil = async (req, res) => {
    let conn;
    try {
        // O ID do usuário deve vir da sessão (req.session.usuario.id) ou do token decodificado
        const usuarioId = req.session?.usuario?.id || req.query.id; 

        if (!usuarioId) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "Usuário não autenticado."
            });
        }

        conn = await db.getConnection();

        // Query inteligente: Se for empresa, traz os dados corporativos. Se não, traz nulo neles.
        const [rows] = await conn.query(
            `
            SELECT 
                u.id, u.nome, u.sobrenome, u.email, u.telefone, u.cpf, u.tipo,
                e.cnpj, e.nome_empresa, e.razao_social, e.inscricao_estadual, e.site
            FROM usuarios u
            LEFT JOIN empresas e ON u.id = e.usuario_id
            WHERE u.id = ?
            `,
            [usuarioId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Usuário não encontrado."
            });
        }

        const dadosPerfil = rows[0];

        return res.status(200).json({
            sucesso: true,
            usuario: dadosPerfil
        });

    } catch (erro) {
        console.error("Erro ao buscar perfil no banco:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno no servidor ao carregar perfil."
        });
    } finally {
        if (conn) conn.release();
    }
};
