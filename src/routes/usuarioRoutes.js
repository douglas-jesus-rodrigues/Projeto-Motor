const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt"); // 1. Importação do bcrypt movida para o topo

// Importações do projeto
const usuarioController = require("../controllers/usuarioController");
const authAdmin = require("../middlewares/authAdmin");
const db = require("../config/db");
const { enviarEmailRecuperacao } = require("../config/emailService");

// ==========================================
// CONFIGURAÇÃO DO MULTER (UPLOAD DE FOTOS)
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../../public/uploads"));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// ==========================================
// CADASTRO, LOGIN E PERFIL DO USUÁRIO
// ==========================================
router.post("/cadastro", usuarioController.cadastrarUsuario);
router.post("/login", usuarioController.loginUsuario);
router.get("/verificar-email/:token", usuarioController.verificarEmail);

// Rota para solicitar a recuperação de senha
router.post("/esqueci-senha", async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ sucesso: false, erro: "O e-mail é obrigatório." });
    }

    try {
        const [usuarios] = await db.query("SELECT * FROM usuarios WHERE email = ?", [email]);

        if (usuarios.length === 0) {
            return res.status(200).json({ 
                sucesso: true, 
                mensagem: "Se o e-mail estiver cadastrado, as instruções foram enviadas." 
            });
        }

        const usuario = usuarios[0];
        const token = crypto.randomBytes(32).toString("hex");

        // Define a expiração para 10 minutos a partir de agora
        const expiracao = new Date(Date.now() + 10 * 60 * 1000);

        // Salva o token e a data de expiração na tabela do usuário
        await db.query(
            "UPDATE usuarios SET token_recuperacao = ?, token_expiracao = ? WHERE id = ?", 
            [token, expiracao, usuario.id]
        );

        await enviarEmailRecuperacao(usuario.email, token);

        return res.status(200).json({ 
            sucesso: true, 
            mensagem: "E-mail de recuperação enviado com sucesso!" 
        });

    } catch (erro) {
        console.error("Erro na rota de esqueci-senha:", erro);
        return res.status(500).json({ 
            sucesso: false, 
            erro: "Erro interno ao processar a recuperação de senha." 
        });
    }
});

// Rota para salvar a nova senha
router.post("/redefinir-senha", async (req, res) => {
    const { token, novaSenha } = req.body;

    if (!token || !novaSenha) {
        return res.status(400).json({ sucesso: false, erro: "Token e nova senha são obrigatórios." });
    }

    try {
        // 1. Busca o usuário pelo token e valida se ele ainda não expirou (prazo de 10 minutos)
        const [usuarios] = await db.query(
            "SELECT * FROM usuarios WHERE token_recuperacao = ? AND token_expiracao > NOW()", 
            [token]
        );

        if (usuarios.length === 0) {
            return res.status(400).json({ sucesso: false, erro: "Token inválido ou expirado." });
        }

        const usuario = usuarios[0];

        // 2. Verifica se a nova senha é igual à senha atual (usando bcrypt.compare)
        const senhaAntigaIgual = await bcrypt.compare(novaSenha, usuario.senha);

        if (senhaAntigaIgual) {
            return res.status(400).json({ 
                sucesso: false, 
                erro: "A nova senha não pode ser igual à sua senha atual." 
            });
        }

        // 3. Criptografa a nova senha
        const hashedPassword = await bcrypt.hash(novaSenha, 10);

        // 4. Atualiza a senha no banco, limpa o token e a expiração
        await db.query(
            "UPDATE usuarios SET senha = ?, token_recuperacao = NULL, token_expiracao = NULL WHERE id = ?",
            [hashedPassword, usuario.id]
        );

        return res.status(200).json({ 
            sucesso: true, 
            mensagem: "Senha redefinida com sucesso!" 
        });

    } catch (erro) {
        console.error("Erro ao redefinir senha:", erro);
        return res.status(500).json({ 
            sucesso: false, 
            erro: "Erro interno ao redefinir a senha." 
        });
    }
});

// Rota de Upload de Foto de Perfil
router.post("/upload-foto", upload.single("fotoPerfil"), async (req, res) => {
    try {
        const { usuarioId } = req.body;
        const arquivo = req.file;

        if (!arquivo) {
            return res.status(400).json({ sucesso: false, erro: "Nenhum arquivo enviado." });
        }

        if (!usuarioId) {
            return res.status(400).json({ sucesso: false, erro: "ID do usuário não informado." });
        }

        const fotoUrl = `/uploads/${arquivo.filename}`;

        const [resultado] = await db.query(
            "UPDATE usuarios SET foto_url = ? WHERE id = ?",
            [fotoUrl, usuarioId]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ sucesso: false, erro: "Usuário não encontrado no banco de dados." });
        }

        return res.status(200).json({ 
            sucesso: true, 
            mensagem: "Foto de perfil atualizada com sucesso!",
            fotoUrl: fotoUrl 
        });

    } catch (error) {
        console.error("Erro no upload da foto de perfil:", error);
        return res.status(500).json({ sucesso: false, erro: "Erro interno no servidor ao salvar a foto." });
    }
});

// ==========================================
// PAINEL ADMINISTRATIVO (ROTAS PROTEGIDAS)
// ==========================================

router.get("/", authAdmin, usuarioController.listarUsuarios);
router.get("/admin/estatisticas", authAdmin, usuarioController.obterEstatisticasAdmin);
router.get("/admin/cadastros-mes", authAdmin, usuarioController.obterCadastrosPorMes);
router.delete("/:id", authAdmin, usuarioController.deletarUsuario);

router.put("/:id/tipo", authAdmin, async (req, res) => {
    const { id } = req.params;
    const { tipo } = req.body;

    if (!tipo) {
        return res.status(400).json({
            sucesso: false,
            erro: "O novo tipo de acesso é obrigatório."
        });
    }

    try {
        const [resultado] = await db.query(
            "UPDATE usuarios SET tipo = ? WHERE id = ?",
            [tipo, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                sucesso: false,
                erro: "Usuário não encontrado."
            });
        }

        return res.status(200).json({
            sucesso: true,
            mensagem: `Tipo de acesso alterado para ${tipo} com sucesso!`
        });

    } catch (erro) {
        console.error("Erro ao alterar tipo do usuário:", erro);
        return res.status(500).json({
            sucesso: false,
            erro: "Erro interno no servidor ao alterar o tipo de acesso."
        });
    }
});

module.exports = router;