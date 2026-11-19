"use strict";

const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const MySQLStore =
    require("express-mysql-session")(
        session
    );

const { Server } =
    require("socket.io");

require("dotenv").config();

const app = express();

const httpServer =
    http.createServer(app);

// ==========================================
// CONFIGURAÇÃO DO AMBIENTE
// ==========================================

const PORT =
    Number(process.env.PORT) ||
    4000;

const HOST =
    process.env.HOST ||
    "0.0.0.0";

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
         * Requisições internas e ferramentas
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

        maxHttpBufferSize:
            1e6
    }
);

/*
 * Disponibiliza o Socket.IO
 * para as rotas.
 *
 * Uso:
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
     * Necessário no Render, pois o serviço
     * utiliza um proxy HTTPS.
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

// ==========================================
// BANCO DAS SESSÕES
// ==========================================

const configuracaoBancoSessao = {
    host:
        process.env.DB_HOST ||
        process.env.MYSQL_ADDON_HOST ||
        "localhost",

    port:
        Number(
            process.env.DB_PORT ||
            process.env.MYSQL_ADDON_PORT
        ) || 3306,

    user:
        process.env.DB_USER ||
        process.env.MYSQL_ADDON_USER ||
        "root",

    password:
        process.env.DB_PASSWORD ||
        process.env.MYSQL_ADDON_PASSWORD ||
        "",

    database:
        process.env.DB_NAME ||
        process.env.MYSQL_ADDON_DB ||
        "motorflex",

    connectionLimit:
        Number(
            process.env
                .DB_CONNECTION_LIMIT
        ) || 10,

    /*
     * Cria automaticamente a tabela
     * sessions caso ela não exista.
     */
    createDatabaseTable:
        true,

    /*
     * Remove sessões vencidas.
     */
    clearExpired:
        true,

    /*
     * Verifica sessões vencidas
     * a cada 15 minutos.
     */
    checkExpirationInterval:
        1000 *
        60 *
        15,

    /*
     * Duração da sessão:
     * 24 horas.
     */
    expiration:
        1000 *
        60 *
        60 *
        24,

    schema: {
        tableName:
            "sessions",

        columnNames: {
            session_id:
                "session_id",

            expires:
                "expires",

            data:
                "data"
        }
    }
};

// ==========================================
// SSL DO BANCO DAS SESSÕES
// ==========================================

const usarSslBanco =
    String(
        process.env.DB_SSL ||
        "false"
    )
        .trim()
        .toLowerCase() ===
    "true";

if (usarSslBanco) {
    configuracaoBancoSessao.ssl = {
        rejectUnauthorized:
            String(
                process.env
                    .DB_SSL_REJECT_UNAUTHORIZED ||
                "true"
            )
                .trim()
                .toLowerCase() !==
            "false"
    };
}

// ==========================================
// CRIAÇÃO DO ARMAZENAMENTO DE SESSÕES
// ==========================================

const armazenamentoSessao =
    new MySQLStore(
        configuracaoBancoSessao
    );

if (
    typeof armazenamentoSessao.on ===
    "function"
) {
    armazenamentoSessao.on(
        "error",
        (erro) => {
            console.error(
                "❌ Erro no armazenamento de sessões:",
                erro.message
            );
        }
    );
}

// ==========================================
// MIDDLEWARE DA SESSÃO
// ==========================================

app.use(
    session({
        /*
         * Nome personalizado do cookie.
         */
        name:
            "motorflex.sid",

        /*
         * Sessões persistentes no MySQL.
         */
        store:
            armazenamentoSessao,

        secret:
            SESSION_SECRET,

        resave:
            false,

        saveUninitialized:
            false,

        /*
         * Renova o tempo do cookie
         * enquanto o usuário navega.
         */
        rolling:
            true,

        /*
         * Permite cookies seguros
         * atrás do proxy do Render.
         */
        proxy:
            EM_PRODUCAO,

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

console.log(
    "🗃️ Sessões persistentes configuradas no MySQL."
);

// ==========================================
// PASTA DE UPLOADS LOCAIS ANTIGOS
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

                sessaoPersistente:
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
                erro.status ||
                500
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