const db = require("../config/db");
const path = require("path");
const fs = require("fs");

exports.obterPerfil = async (req, res) => {
    let conn;
    try {
        const usuarioId = req.session?.usuario?.id || req.query.id; 

        if (!usuarioId) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "Usuário não autenticado."
            });
        }

        conn = await db.getConnection();

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

        const queryUsuario = `UPDATE usuarios SET foto_perfil = ? WHERE id = ?`;
        await conn.query(queryUsuario, [caminhoArquivo, usuarioId]);

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

exports.removerFotoPerfil = async (req, res) => {
    let conn;
    try {
        const usuarioId = req.session?.usuario?.id || req.body.usuarioId;

        if (!usuarioId) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "Usuário não autenticado."
            });
        }

        conn = await db.getConnection();

        // 1. Busca a foto atual para excluir o arquivo físico da pasta
        const [rows] = await conn.query(
            `SELECT foto_perfil FROM usuarios WHERE id = ?`,
            [usuarioId]
        );

        if (rows.length > 0 && rows[0].foto_perfil) {
            const caminhoRelativo = rows[0].foto_perfil; // Ex: /uploads/arquivo.jpg
            const caminhoFisico = path.join(__dirname, "../../public", caminhoRelativo);

            if (fs.existsSync(caminhoFisico)) {
                fs.unlinkSync(caminhoFisico);
            }
        }

        // 2. Define a coluna como NULL no banco
        await conn.query(
            `UPDATE usuarios SET foto_perfil = NULL WHERE id = ?`,
            [usuarioId]
        );

        if (req.session?.usuario) {
            req.session.usuario.foto_perfil = null;
        }

        return res.status(200).json({
            sucesso: true,
            mensagem: "Foto de perfil removida com sucesso!"
        });

    } catch (erro) {
        console.error("Erro ao remover foto de perfil:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno no servidor ao remover a foto."
        });
    } finally {
        if (conn) conn.release();
    }
};