const db = require("../config/db");
const path = require("path");

exports.obterPerfil = async (req, res) => {
    let conn;
    try {
        // O ID do usuário deve vir da sessão (req.session.usuario.id) ou do parâmetro/query
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
                u.id, u.nome, u.sobrenome, u.email, u.telefone, u.cpf, u.tipo, u.foto_perfil,
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

exports.atualizarFotoPerfil = async (req, res) => {
    let conn;
    try {
        // Pega o ID do usuário da sessão ou do corpo da requisição
        const usuarioId = req.session?.usuario?.id || req.body.usuarioId;
        const arquivo = req.file;

        if (!usuarioId) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "Usuário não autenticado."
            });
        }

        if (!arquivo) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Nenhum arquivo enviado."
            });
        }

        conn = await db.getConnection();
        const caminhoArquivo = `/uploads/${arquivo.filename}`;

        // 1. Insere o registro detalhado na tabela 'arquivos_uploads' (Abordagem Completa)[cite: 1]
        const queryUploads = `
            INSERT INTO arquivos_uploads 
            (usuario_id, tipo, caminho_arquivo, nome_original, nome_salvo, mime_type, extensao, tamanho_bytes) 
            VALUES (?, 'foto_perfil', ?, ?, ?, ?, ?, ?)
        `;
        
        await conn.query(queryUploads, [
            usuarioId,
            caminhoArquivo,
            arquivo.originalname,
            arquivo.filename,
            arquivo.mimetype,
            path.extname(arquivo.originalname).replace(".", ""),
            arquivo.size
        ]);

        // 2. Atualiza a coluna 'foto_perfil' na tabela 'usuarios'[cite: 1]
        const queryUsuario = `UPDATE usuarios SET foto_perfil = ? WHERE id = ?`;
        await conn.query(queryUsuario, [caminhoArquivo, usuarioId]);

        // Atualiza também na sessão caso ela exista
        if (req.session?.usuario) {
            req.session.usuario.foto_perfil = caminhoArquivo;
        }

        return res.status(200).json({
            sucesso: true,
            mensagem: "Foto de perfil atualizada com sucesso!",
            fotoUrl: caminhoArquivo
        });

    } catch (erro) {
        console.error("Erro ao atualizar foto de perfil:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno no servidor ao salvar a foto."
        });
    } finally {
        if (conn) conn.release();
    }
};