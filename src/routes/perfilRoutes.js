const express = require("express");
const router = express.Router();
const perfilController = require("../controllers/perfilController");
const upload = require("../middlewares/upload"); // Ajuste o caminho conforme a localização do seu multer

// Rota GET para buscar os dados atualizados do banco
router.get("/meu-perfil", perfilController.obterPerfil);

// Rota POST para upload da foto de perfil (usando o campo 'fotoPerfil' que vem do FormData do front-end)
router.post("/upload-foto", upload.single("fotoPerfil"), perfilController.atualizarFotoPerfil);

module.exports = router;