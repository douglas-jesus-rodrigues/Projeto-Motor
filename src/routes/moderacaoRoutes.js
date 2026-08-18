const express = require("express");
const router = express.Router();
const moderacaoController = require("../controllers/moderacaoController");

// Endpoint que recebe a ação do botão via JavaScript (fetch)
router.post("/:id/:acao", moderacaoController.gerenciarDenuncia);

module.exports = router;
