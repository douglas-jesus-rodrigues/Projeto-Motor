"use strict";

const express = require("express");

const router = express.Router();

const moderacaoController = require(
    "../controllers/moderacaoController"
);

const authAdmin = require(
    "../middlewares/authAdmin"
);

// Todas as rotas abaixo exigem administrador autenticado.
router.use(authAdmin);

// ==========================================
// LISTAR DENÚNCIAS
// GET /api/moderacao/denuncias
// ==========================================
router.get(
    "/denuncias",
    moderacaoController.listarDenuncias
);

// ==========================================
// RESOLVER UMA DENÚNCIA
// POST /api/moderacao/denuncias/:id/resolver
// ==========================================
router.post(
    "/denuncias/:id/resolver",
    moderacaoController.resolverDenuncia
);

// ==========================================
// COMPATIBILIDADE COM O ENDPOINT ANTIGO
// POST /api/moderacao/:id/:acao
// ==========================================
router.post(
    "/:id/:acao",
    moderacaoController.gerenciarDenuncia
);

module.exports = router;