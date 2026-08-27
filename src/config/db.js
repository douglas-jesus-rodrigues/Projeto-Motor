const mysql = require("mysql2");
require("dotenv").config();

// 1. Cria o pool de conexões
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "motorflex",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 2. Converte para suporte a Promises (Async/Await)
const db = pool.promise();

// 3. Teste inicial de conexão
(async () => {
    try {
        const connection = await db.getConnection();
        console.log("✅ Banco de dados conectado com sucesso!");
        connection.release();
    } catch (erro) {
        console.error("❌ Erro ao conectar no banco de dados:", erro.message);
    }
})();

module.exports = db;