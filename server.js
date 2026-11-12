"use strict";

const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const { Server } = require("socket.io");

require("dotenv").config();

const app = express();
const httpServer = http.createServer(app);

// ==========================================
// CONFIGURAÇÃO DO AMBIENTE
// ==========================================
const PORT =
    Number(process.env.PORT) || 4000;

const HOST =
    process.env.HOST || "0.0.0.0";

const EM_PRODUCAO =
    process.env.NODE_ENV ===
    "production";

const APP_URL = String(
    process.env.APP_URL ||
    process.env.PROD ||
    `http://localhost:${PORT}`
).replace(/\/+$/, "");

// ==========================================
// ORIGENS PERMITIDAS
// ==========================================
const origensPadrao = [
    `http://localhost:${PORT}`,
    "http://localhost:3000",
    APP_URL
];

const ORIGENS_PERMITIDAS = [
    ...new Set(
        String(
            process.env.CORS_ORIGINS ||
            origensPadrao.join(",")
        )
            .split(",")

            .map((origem) =>
                origem
                    .trim()
                    .replace(/\/+$/, "")
            )

            .filter((origem) =>
                /^https?:\/\//i.test(
                    origem
                )
            )
    )
];

// ==========================================
// CONFIGURAÇÃO DO CORS
// ==========================================
const configuracaoCors = {
    credentials: true,

    origin(origem, callback) {
        /*
         * Requisições internas ou ferramentas
         * locais podem não enviar Origin.
         */
        if (!origem) {
            return callback(
                null,
                true
            );
        }

        const origemNormalizada =
            origem.replace(
                /\/+$/,
                ""
            );

        if (
            ORIGENS_PERMITIDAS.includes(
                origemNormalizada
            )
        ) {
            return callback(
                null,
                true
            );
        }

        console.warn(
            `⚠️ Origem bloqueada pelo CORS: ${origem}`
        );

        const erro = new Error(
            "Origem não autorizada pelo CORS."
        );

        erro.status = 403;

        return callback(erro);
    }
};

// ==========================================
// CONFIGURAÇÃO DO SOCKET.IO
// ==========================================
const io = new Server(
    httpServer,
    {
        cors: configuracaoCors,

        transports: [
            "websocket",
            "polling"
        ],

        maxHttpBufferSize: 1e6
    }
);

/*
 * Disponibiliza o Socket.IO para as rotas.
 *
 * Dentro das rotas será possível acessar:
 *
 * req.app.get("io")
 */
app.set("io", io);

// ==========================================
// SOCKET.IO DAS MENSAGENS PRIVADAS
// ==========================================
const iniciarChatPrivado =
    require(
        "./src/sockets/chatPrivado"
    );

iniciarChatPrivado(io);

// ==========================================
// CONFIGURAÇÕES DO EXPRESS
// ==========================================
if (EM_PRODUCAO) {
    /*
     * Necessário em hospedagens que utilizam
     * proxy HTTPS, como Render e Railway.
     */
    app.set(
        "trust proxy",
        1
    );
}

app.disable("x-powered-by");

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);

app.use(
    cors(configuracaoCors)
);

app.use(
    cookieParser()
);

// ==========================================
// CONFIGURAÇÃO DA SESSÃO
// ==========================================
const SESSION_SECRET =
    process.env.SESSION_SECRET ||
    "motorflex_sessao_local";

if (
    EM_PRODUCAO &&
    !process.env.SESSION_SECRET
) {
    console.warn(
        "⚠️ SESSION_SECRET não foi configurado no ambiente de produção."
    );
}

app.use(
    session({
        secret:
            SESSION_SECRET,

        resave:
            false,

        saveUninitialized:
            false,

        cookie: {
            httpOnly:
                true,

            secure:
                EM_PRODUCAO,

            sameSite:
                EM_PRODUCAO
                    ? "none"
                    : "lax",

            maxAge:
                1000 *
                60 *
                60 *
                24
        }
    })
);

// ==========================================
// PASTA DE UPLOADS
// ==========================================
const pastaUploadsPublic =
    path.join(
        __dirname,
        "public",
        "uploads"
    );

app.use(
    "/uploads",

    express.static(
        pastaUploadsPublic,
        {
            fallthrough:
                true,

            maxAge:
                EM_PRODUCAO
                    ? "1d"
                    : 0
        }
    )
);

console.log(
    "📁 Uploads públicos:",
    pastaUploadsPublic
);

// ==========================================
// SERVIÇOS EM SEGUNDO PLANO
// ==========================================

// ------------------------------------------
// Inatividade e LGPD
// ------------------------------------------
try {
    require(
        "./src/middlewares/cronInatividade"
    );

    console.log(
        "⚙️ Agendador de inatividade LGPD ativado."
    );
} catch (erro) {
    console.error(
        "❌ Erro ao inicializar o agendador LGPD:",
        erro.message
    );
}

// ------------------------------------------
// Limpeza das mensagens com mais de 10 dias
// ------------------------------------------
try {
    const limpezaMensagens =
        require(
            "./src/services/limpezaMensagens"
        );

    limpezaMensagens
        .iniciarLimpezaMensagens();

    console.log(
        "✅ Limpeza automática do chat ativada."
    );
} catch (erro) {
    console.error(
        "❌ Erro ao iniciar a limpeza do chat:",
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
app.get(
    "/",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "public",
                "pages",
                "animacao.html"
            )
        );
    }
);

// ==========================================
// IMPORTAÇÃO DAS ROTAS
// ==========================================
const usuarioRoutes =
    require(
        "./src/routes/usuarioRoutes"
    );

const veiculoRoutes =
    require(
        "./src/routes/veiculoRoutes"
    );

const adminRoutes =
    require(
        "./src/routes/adminRoutes"
    );

const moderacaoRoutes =
    require(
        "./src/routes/moderacaoRoutes"
    );

const perfilRoutes =
    require(
        "./src/routes/perfilRoutes"
    );

const mensagensRoutes =
    require(
        "./src/routes/mensagensRoutes"
    );

const auxiliaresRoutes =
    require(
        "./src/routes/auxiliaresRoutes"
    );

// ==========================================
// REGISTRO DAS ROTAS
// ==========================================
app.use(
    "/api/usuarios",
    usuarioRoutes
);

app.use(
    "/api/veiculos",
    veiculoRoutes
);

app.use(
    "/api/admin",
    adminRoutes
);

app.use(
    "/api/moderacao",
    moderacaoRoutes
);

app.use(
    "/api/perfil",
    perfilRoutes
);

app.use(
    "/api/conversas",
    mensagensRoutes
);

app.use(
    "/api",
    auxiliaresRoutes
);

// ==========================================
// ROTA DE TESTE
// ==========================================
app.get(
    "/teste",
    (req, res) => {
        return res
            .status(200)
            .json({
                sucesso:
                    true,

                mensagem:
                    "Servidor MotorFlex funcionando!",

                socketIO:
                    true,

                chatPrivado:
                    true,

                ambiente:
                    process.env.NODE_ENV ||
                    "development",

                porta:
                    PORT,

                url:
                    APP_URL
            });
    }
);

// ==========================================
// ROTA NÃO ENCONTRADA
// ==========================================
app.use(
    (req, res) => {
        return res
            .status(404)
            .json({
                sucesso:
                    false,

                mensagem:
                    "Rota não encontrada."
            });
    }
);

// ==========================================
// TRATAMENTO GERAL DE ERROS
// ==========================================
app.use(
    (
        erro,
        req,
        res,
        next
    ) => {
        console.error(
            "❌ Erro interno:",
            erro.message
        );

        if (res.headersSent) {
            return next(erro);
        }

        if (
            erro.message ===
            "Origem não autorizada pelo CORS."
        ) {
            return res
                .status(403)
                .json({
                    sucesso:
                        false,

                    mensagem:
                        "Origem não autorizada."
                });
        }

        return res
            .status(
                erro.status || 500
            )
            .json({
                sucesso:
                    false,

                mensagem:
                    EM_PRODUCAO
                        ? "Erro interno do servidor."
                        : (
                            erro.message ||
                            "Erro interno do servidor."
                        )
            });
    }
);

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR
// ==========================================
httpServer.listen(
    PORT,
    HOST,
    () => {
        console.log(
            `🚀 MotorFlex rodando em ${APP_URL}`
        );

        console.log(
            "💬 Socket.IO privado preparado."
        );

        console.log(
            `🌐 Origens permitidas: ${ORIGENS_PERMITIDAS.join(", ")}`
        );
    }
);

// ==========================================
// EXPORTAÇÃO PARA TESTES
// ==========================================
module.exports = {
    app,
    httpServer,
    io
};