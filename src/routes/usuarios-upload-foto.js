app.post('/api/usuarios/upload-foto', upload.single('foto'), async (req, res) => {
    try {
        const usuarioId = req.user.id; // ID obtido através do seu token de autenticação (JWT)
        const arquivo = req.file;

        if (!arquivo) {
            return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
        }

        // Caminho relativo ou URL que será salva no banco
        const caminhoArquivo = `/uploads/${arquivo.filename}`;

        // 1. Inserir o registro na tabela 'arquivos_uploads' (Abordagem Completa)
        const queryUploads = `
            INSERT INTO arquivos_uploads 
            (usuario_id, tipo, caminho_arquivo, nome_original, nome_salvo, mime_type, extensao, tamanho_bytes) 
            VALUES (?, 'foto_perfil', ?, ?, ?, ?, ?, ?)
        `;
        
        await db.query(queryUploads, [
            usuarioId,
            caminhoArquivo,
            arquivo.originalname,
            arquivo.filename,
            arquivo.mimetype,
            path.extname(arquivo.originalname).replace('.', ''),
            arquivo.size
        ]);

        // 2. Atualizar a tabela 'usuarios' com o caminho da nova foto
        const queryUsuario = `UPDATE usuarios SET foto_perfil = ? WHERE id = ?`;
        await db.query(queryUsuario, [caminhoArquivo, usuarioId]);

        // 3. Retornar a URL de sucesso para o front-end atualizar a tela
        return res.json({ 
            sucesso: true, 
            mensagem: 'Foto atualizada com sucesso!',
            fotoUrl: caminhoArquivo 
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ erro: 'Erro interno ao processar o upload da foto.' });
    }
});