const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");

// ==========================================
// CADASTRO E LOGIN
// ==========================================
router.post("/cadastro", usuarioController.cadastrarUsuario);
router.post("/login", usuarioController.loginUsuario);
router.get("/verificar-email/:token", usuarioController.verificarEmail);

// ==========================================
// PAINEL ADMINISTRATIVO (CRUD E ESTATÍSTICAS)
// ==========================================

// Listar todos os usuários (necessário para a tabela do painel adm)
router.get("/", usuarioController.listarUsuarios);

// Estatísticas para os cards do painel
router.get("/admin/estatisticas", usuarioController.obterEstatisticasAdmin);

// Deletar usuário pelo ID (botão de lixeira na tabela)
router.delete("/:id", usuarioController.deletarUsuario);

module.exports = router;

// Rota para buscar os cadastros agrupados por mês
router.get("/admin/cadastros-mes", usuarioController.obterCadastrosPorMes);

const authAdmin = require("../middlewares/authAdmin");

// Todas estas rotas abaixo agora exigem que o usuário seja um administrador autenticado
router.get("/", authAdmin, usuarioController.listarUsuarios);
router.get("/admin/estatisticas", authAdmin, usuarioController.obterEstatisticasAdmin);
router.delete("/:id", authAdmin, usuarioController.deletarUsuario);

// ALTERAR TIPO DE ACESSO DO USUÁRIO (ex: 'admin' <-> 'individual')
router.put("/:id/tipo", async (req, res) => {
    const { id } = req.params;
    const { tipo } = req.body;

    // 1. Validação básica de entrada
    if (!tipo) {
        return res.status(400).json({
            sucesso: false,
            erro: "O novo tipo de usuário é obrigatório."
        });
    }

    try {
        // 2. Atualiza a coluna 'tipo' na tabela de usuários
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