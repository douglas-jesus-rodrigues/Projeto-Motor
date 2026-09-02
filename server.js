const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const fs = require("fs");
require("dotenv").config();

const app = express();

// ==========================================
// CONFIGURAÇÕES E MIDDLEWARES
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin: [
        "http://localhost:4000",
        "http://localhost:3000"
    ],
    credentials: true
}));

app.use(cookieParser());

app.use(session({
    secret: process.env.SESSION_SECRET || "motorflex_sessao",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// ==========================================
// GARANTIR QUE A PASTA DE UPLOADS EXISTE
// ==========================================
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ==========================================
// SERVIÇOS EM SEGUNDO PLANO (CRON JOBS / LGPD)
// ==========================================
try {
    require("./src/middlewares/cronInatividade");
    console.log("⚙️ Agendador de inatividade LGPD ativado.");
} catch (err) {
    console.error("❌ Erro ao inicializar o middleware do Cron:", err.message);
}

// ==========================================
// ARQUIVOS PÚBLICOS E PÁGINA INICIAL
// ==========================================
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pages", "index.html"));
});

// ==========================================
// REGISTRO DE ROTAS DA API
// ==========================================
const usuarioRoutes = require("./src/routes/usuarioRoutes");
app.use("/api/usuarios", usuarioRoutes);

const veiculoRoutes = require("./src/routes/veiculoRoutes");
app.use("/api/veiculos", veiculoRoutes);

const adminRoutes = require("./src/routes/adminRoutes");
app.use("/api/admin", adminRoutes);

const moderacaoRoutes = require("./src/routes/moderacaoRoutes");
app.use("/api/moderacao", moderacaoRoutes);

const perfilRoutes = require("./src/routes/perfilRoutes");
app.use("/api/perfil", perfilRoutes);

// ==========================================
// ENDPOINTS AUXILIARES E TRATAMENTO
// ==========================================
app.get("/teste", (req, res) => {
    res.json({
        sucesso: true,
        mensagem: "Servidor MotorFlex funcionando!",
        porta: process.env.PORT || 4000
    });
});

app.use((req, res) => {
    res.status(404).json({
        sucesso: false,
        mensagem: "Rota não encontrada."
    });
});

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
// ==========================================
const PORT = process.env.PORT || 4000;
const PROD = process.env.PROD || "http://localhost";

app.listen(PORT, () => {
    console.log(`🚀 Servidor MotorFlex rodando em ${PROD}:${PORT}`);
});