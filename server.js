const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const { Server } = require("socket.io");

require("dotenv").config();

const app = express();

// Express e Socket.IO utilizarão o mesmo servidor HTTP.
const httpServer = http.createServer(app);

// ==========================================
// CONFIGURAÇÃO DE CORS
// ==========================================
const origensPermitidas = [
    "http://localhost:4000",
    "http://localhost:3000"
];

const configuracaoCors = {
    origin: origensPermitidas,
    credentials: true
};

// ==========================================
// CONFIGURAÇÃO DO SOCKET.IO
// ==========================================
const io = new Server(httpServer, {
    cors: configuracaoCors,
    transports: [
        "websocket",
        "polling"
    ]
});

// ==========================================
// CONFIGURAÇÕES E MIDDLEWARES
// ==========================================
app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(cors(configuracaoCors));

app.use(cookieParser());

app.use(session({
    secret: process.env.SESSION_SECRET || "motorflex_sessao",
    resave: false,
    saveUninitialized: false,

    cookie: {
        httpOnly: true,

        // Enquanto estiver usando HTTP local, deixe false.
        // Na publicação com HTTPS, deverá ser true.
        secure: false,

        maxAge: 1000 * 60 * 60 * 24
    }
}));

// ==========================================
// ROTAS ESTÁTICAS DE UPLOADS
// ==========================================
app.use(
    "/uploads",
    express.static(
        path.join(
            __dirname,
            "public",
            "uploads"
        )
    )
);

app.use(
    "/uploads",
    express.static(
        path.join(
            __dirname,
            "uploads"
        )
    )
);

// ==========================================
// SERVIÇOS EM SEGUNDO PLANO
// ==========================================
try {
    require("./src/middlewares/cronInatividade");

    console.log(
        "⚙️ Agendador de inatividade LGPD ativado."
    );
} catch (erro) {
    console.error(
        "❌ Erro ao inicializar o middleware do Cron:",
        erro.message
    );
}

// ==========================================
// ARQUIVOS PÚBLICOS
// ==========================================
app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);

// ==========================================
// PÁGINA INICIAL
// ==========================================
app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "pages",
            "animacao.html"
        )
    );
});

// ==========================================
// ROTAS DE USUÁRIOS E AUTENTICAÇÃO
// ==========================================
const usuarioRoutes = require(
    "./src/routes/usuarioRoutes"
);

app.use(
    "/api/usuarios",
    usuarioRoutes
);

// ==========================================
// ROTAS DE VEÍCULOS
// ==========================================
const veiculoRoutes = require(
    "./src/routes/veiculoRoutes"
);

app.use(
    "/api/veiculos",
    veiculoRoutes
);

// ==========================================
// ROTAS DE ADMINISTRAÇÃO
// ==========================================
const adminRoutes = require(
    "./src/routes/adminRoutes"
);

app.use(
    "/api/admin",
    adminRoutes
);

// ==========================================
// ROTAS DE MODERAÇÃO
// ==========================================
const moderacaoRoutes = require(
    "./src/routes/moderacaoRoutes"
);

app.use(
    "/api/moderacao",
    moderacaoRoutes
);

// ==========================================
// ROTAS DE PERFIL
// ==========================================
const perfilRoutes = require(
    "./src/routes/perfilRoutes"
);

app.use(
    "/api/perfil",
    perfilRoutes
);

// ==========================================
// CONVERSAS PRIVADAS
// ==========================================
const mensagensRoutes = require(
    "./src/routes/mensagensRoutes"
);

app.use(
    "/api/conversas",
    mensagensRoutes
);

// ==========================================
// ROTAS AUXILIARES
// ==========================================
const auxiliaresRoutes = require(
    "./src/routes/auxiliaresRoutes"
);

app.use(
    "/api",
    auxiliaresRoutes
);

// ==========================================
// CHAT GLOBAL COM SOCKET.IO
// ==========================================

// Este arquivo será responsável pela autenticação,
// entrada na sala global e distribuição das mensagens.
const iniciarChatGlobal = require(
    "./src/sockets/chatGlobal"
);

iniciarChatGlobal(io);

// ==========================================
// ROTA DE TESTE
// ==========================================
app.get("/teste", (req, res) => {
    res.json({
        sucesso: true,
        mensagem: "Servidor MotorFlex funcionando!",
        socketIO: true,
        porta: process.env.PORT || 4000
    });
});

// ==========================================
// ROTA NÃO ENCONTRADA
// ==========================================
app.use((req, res) => {
    res.status(404).json({
        sucesso: false,
        mensagem: "Rota não encontrada."
    });
});

// ==========================================
// TRATAMENTO DE ERROS DO EXPRESS
// ==========================================
app.use((erro, req, res, next) => {
    console.error(
        "❌ Erro interno do servidor:",
        erro.message
    );

    if (res.headersSent) {
        return next(erro);
    }

    return res.status(500).json({
        sucesso: false,
        mensagem: "Erro interno do servidor."
    });
});

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
// ==========================================
const PORT = process.env.PORT || 4000;
const PROD = process.env.PROD || "http://localhost";

httpServer.listen(PORT, () => {
    console.log(
        `🚀 Servidor MotorFlex rodando em ${PROD}:${PORT}`
    );

    console.log(
        "💬 Socket.IO preparado para conexões em tempo real."
    );
});