const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

// Importações do projeto
const usuarioController = require("../controllers/usuarioController");
const authAdmin = require("../middlewares/authAdmin");
const db = require("../config/db"); // Certifique-se de que este caminho aponta para a sua conexão MySQL

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

// Rota de Upload de Foto de Perfil (Acessada em /api/usuarios/upload-foto)
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

        // Atualiza a coluna da foto no banco de dados MySQL
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

// Listar todos os usuários (Protegido por authAdmin)
router.get("/", authAdmin, usuarioController.listarUsuarios);

// Estatísticas para os cards do painel adm
router.get("/admin/estatisticas", authAdmin, usuarioController.obterEstatisticasAdmin);

// Cadastros agrupados por mês
router.get("/admin/cadastros-mes", authAdmin, usuarioController.obterCadastrosPorMes);

// Deletar usuário pelo ID
router.delete("/:id", authAdmin, usuarioController.deletarUsuario);

// Alterar tipo de acesso do usuário (ex: 'admin' <-> 'individual')
router.put("/:id/tipo", authAdmin, async (req, res) => {
    const { id } = req.params;
    const { tipo } = req.body;

    if (!tipo) {
        return res.status(400).json({
            sucesso: false,
            erro: "O novo tipo de usuário é obrigatório."
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