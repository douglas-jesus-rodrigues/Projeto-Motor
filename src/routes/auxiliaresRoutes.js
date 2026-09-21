const express = require("express");
const router = express.Router();

// Correção: Aponta para o caminho real da conexão no seu projeto (src/config/db.js)
const db = require("../config/db"); 

// ==========================================
// ROTA: Buscar tipos de combustível
// ==========================================
router.get("/combustiveis", async (req, res) => {
    try {
        const [combustiveis] = await db.query("SELECT id, nome FROM tipo_combustivel");
        res.json(combustiveis);
    } catch (error) {
        console.error("Erro ao buscar combustíveis:", error);
        res.status(500).json({ 
            sucesso: false, 
            mensagem: "Erro ao buscar opções de combustível." 
        });
    }
});

// ==========================================
// ROTA: Buscar tipos de transmissão (câmbio)
// ==========================================
router.get("/cambios", async (req, res) => {
    try {
        const [cambios] = await db.query("SELECT id, nome FROM tipo_transmissao");
        res.json(cambios);
    } catch (error) {
        console.error("Erro ao buscar câmbios:", error);
        res.status(500).json({ 
            sucesso: false, 
            mensagem: "Erro ao buscar opções de câmbio." 
        });
    }
});

module.exports = router;