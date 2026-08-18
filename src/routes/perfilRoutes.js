const express = require("express");
const router = express.Router();
const perfilController = require("../controllers/perfilController");

// Rota GET para buscar os dados atualizados do banco
router.get("/meu-perfil", perfilController.obterPerfil);

module.exports = router;
