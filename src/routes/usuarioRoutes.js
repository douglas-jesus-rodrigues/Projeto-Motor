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