const mysql = require("mysql2");

require("dotenv").config();

// ==========================================
// AMBIENTE
// ==========================================
const EM_PRODUCAO =
    process.env.NODE_ENV === "production";

// Suporta os nomes utilizados localmente e
// também as variáveis fornecidas pelo Railway.
const DB_HOST =
    process.env.DB_HOST ||
    process.env.MYSQLHOST ||
    "localhost";

const DB_PORT = Number(
    process.env.DB_PORT ||
    process.env.MYSQLPORT ||
    3306
);

const DB_USER =
    process.env.DB_USER ||
    process.env.MYSQLUSER ||
    "root";

const DB_PASSWORD =
    process.env.DB_PASSWORD ||
    process.env.MYSQLPASSWORD ||
    "";

const DB_NAME =
    process.env.DB_NAME ||
    process.env.MYSQLDATABASE ||
    "motorflex";

// ==========================================
// VALIDAÇÃO DA PORTA
// ==========================================
if (
    !Number.isInteger(DB_PORT) ||
    DB_PORT <= 0 ||
    DB_PORT > 65535
) {
    throw new Error(
        "DB_PORT possui um valor inválido."
    );
}

// ==========================================
// CONFIGURAÇÃO DE SSL
// ==========================================

// Alguns bancos externos exigem SSL.
// No MySQL local, normalmente deve permanecer false.
const usarSSL =
    String(process.env.DB_SSL || "false")
        .toLowerCase() === "true";

const rejeitarCertificadoInvalido =
    String(
        process.env
            .DB_SSL_REJECT_UNAUTHORIZED ||
        "true"
    ).toLowerCase() !== "false";

// ==========================================
// POOL DE CONEXÕES
// ==========================================
const configuracaoPool = {
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,

    waitForConnections: true,
    connectionLimit: Number(
        process.env.DB_CONNECTION_LIMIT || 10
    ),
    queueLimit: 0,

    charset: "utf8mb4",
    timezone: "Z",

    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

if (usarSSL) {
    configuracaoPool.ssl = {
        rejectUnauthorized:
            rejeitarCertificadoInvalido
    };
}

const pool =
    mysql.createPool(configuracaoPool);

// Converte o pool para suporte a Promises.
const db = pool.promise();

// ==========================================
// TESTE INICIAL DA CONEXÃO
// ==========================================
async function testarConexao() {
    let conexao;

    try {
        conexao =
            await db.getConnection();

        await conexao.query(
            "SELECT 1"
        );

        console.log(
            "✅ Banco de dados conectado com sucesso!"
        );

        console.log(
            `🗄️ Banco: ${DB_NAME}`
        );

        console.log(
            `🔐 SSL: ${
                usarSSL
                    ? "ativado"
                    : "desativado"
            }`
        );
    } catch (erro) {
        // Em produção evita apresentar endereço,
        // usuário ou outros detalhes da conexão.
        const detalhe = EM_PRODUCAO
            ? erro.code ||
              "DB_CONNECTION_ERROR"
            : erro.message;

        console.error(
            "❌ Erro ao conectar no banco:",
            detalhe
        );
    } finally {
        if (conexao) {
            conexao.release();
        }
    }
}

testarConexao();

module.exports = db;