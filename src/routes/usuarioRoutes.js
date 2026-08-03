const express = require("express");

const router = express.Router();

const usuarioController =
require("../controllers/usuarioController");

// ==========================================
// CADASTRO
// ==========================================
router.post(
    "/cadastro",
    usuarioController.cadastrarUsuario
);

// ==========================================
// LOGIN
// ==========================================
router.post(
    "/login",
    usuarioController.loginUsuario
);

// ==========================================
// CONFIRMAR E-MAIL
// ==========================================
router.get(
    "/verificar-email/:token",
    usuarioController.verificarEmail
);

module.exports = router;