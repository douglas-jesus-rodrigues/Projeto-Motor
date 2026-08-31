const express = require("express");
const router = express.Router();
const perfilController = require("../controllers/perfilController");
const upload = require("../middlewares/upload");

// Rota GET para buscar os dados atualizados do banco
router.get("/meu-perfil", perfilController.obterPerfil);

// Rota POST para upload da foto de perfil
router.post("/upload-foto", upload.single("fotoPerfil"), perfilController.atualizarFotoPerfil);

// Rota DELETE para remover a foto de perfil
router.delete("/remover-foto", perfilController.removerFotoPerfil);

module.exports = router;