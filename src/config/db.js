// ==========================================
// IMPORTA A BIBLIOTECA MYSQL2
// responsável por conectar o Node.js ao MySQL
// ==========================================
const mysql = require("mysql2");


// ==========================================
// IMPORTA O DOTENV
// permite usar as variáveis do arquivo .env
// ==========================================
require("dotenv").config();


// ==========================================
// CRIA A CONEXÃO COM O BANCO
// createPool cria várias conexões automáticas
// melhor desempenho e mais profissional
// ==========================================
const db = mysql.createPool({

    // ======================================
    // HOST DO BANCO
    // localhost = banco no próprio computador
    // ======================================
    host: process.env.DB_HOST || "localhost",

    // ======================================
    // USUÁRIO DO MYSQL
    // normalmente root no XAMPP
    // ======================================
    user: process.env.DB_USER || "root",

    // ======================================
    // SENHA DO MYSQL
    // vazio caso não tenha senha
    // ======================================
    password: process.env.DB_PASSWORD || "",

    // ======================================
    // NOME DO BANCO DE DADOS
    // ======================================
    database: process.env.DB_NAME || "motorflex",

    // ======================================
    // AGUARDA CONEXÕES DISPONÍVEIS
    // ======================================
    waitForConnections: true,

    // ======================================
    // LIMITE DE CONEXÕES SIMULTÂNEAS
    // ======================================
    connectionLimit: 10,

    // ======================================
    // LIMITE DA FILA DE ESPERA
    // 0 = sem limite
    // ======================================
    queueLimit: 0
});


// ==========================================
// TESTA A CONEXÃO COM O BANCO
// ==========================================
db.getConnection((erro, connection) => {

    // ======================================
    // SE DER ERRO
    // ======================================
    if (erro) {

        console.error("Erro ao conectar no banco de dados:");

        // mostra a mensagem do erro
        console.error(erro.message);

        return;
    }

    // ======================================
    // SE CONECTAR COM SUCESSO
    // ======================================
    console.log("Banco de dados conectado com sucesso!");

    // ======================================
    // LIBERA A CONEXÃO
    // importante para não travar o pool
    // ======================================
    connection.release();
});


// ==========================================
// EXPORTA O BANCO
// .promise() permite usar async/await
// ==========================================
module.exports = db.promise();

