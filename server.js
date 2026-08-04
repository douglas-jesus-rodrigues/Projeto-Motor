const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
require("dotenv").config();

const app = express();

// CONFIGURAÇÕES
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

// ARQUIVOS PÚBLICOS
app.use(express.static(path.join(__dirname, "public")));

// PÁGINA INICIAL
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pages", "index.html"));
});

// ROTAS
const usuarioRoutes = require("./src/routes/usuarioRoutes");
app.use("/api/usuarios", usuarioRoutes);

const veiculoRoutes = require("./src/routes/veiculoRoutes");
app.use("/api/veiculos", veiculoRoutes);

// TESTE
app.get("/teste", (req, res) => {
    res.json({
        sucesso: true,
        mensagem: "Servidor motorFlex funcionando!",
        porta: process.env.PORT || 4000
    });
});

// 404
app.use((req, res) => {
    res.status(404).json({
        sucesso: false,
        mensagem: "Rota não encontrada."
    });
});

const PORT = process.env.PORT || 4000;
const PROD = process.env.PROD || "http://localhost";

app.listen(PORT, () => {
    console.log(`Servidor rodando em ${PROD}:${PORT}`);
});