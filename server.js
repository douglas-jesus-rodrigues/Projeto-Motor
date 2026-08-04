// Importa o framework Express, que será usado para criar o servidor e as rotas da aplicação
const express = require("express");

// Importa o módulo path, usado para trabalhar com caminhos de arquivos e pastas
// Ele ajuda o Node.js a encontrar arquivos independente do sistema operacional
const path = require("path");

// Importa o CORS, que permite que o frontend e backend se comuniquem mesmo estando em portas diferentes
const cors = require("cors");

// Importa o cookie-parser, usado para ler e manipular cookies enviados pelo navegador
// Será útil principalmente para autenticação e sessões
const cookieParser = require("cookie-parser");

// Importa o express-session, responsável por criar e controlar sessões de usuários
// Exemplo: manter um usuário logado no sistema
const session = require("express-session");

// Carrega as variáveis de ambiente do arquivo .env
// Exemplo: PORT, senha do banco, chaves secretas etc.
require("dotenv").config();


// Cria uma aplicação Express
// A variável app representa o servidor inteiro
const app = express();


// =====================================================
// CONFIGURAÇÕES DO SERVIDOR
// =====================================================


// Permite que o servidor receba dados no formato JSON
// Exemplo:
// { "nome": "João", "email": "joao@email.com" }
//
// Sem isso o backend não conseguiria entender dados enviados pelo frontend
app.use(express.json());


// Permite receber dados enviados por formulários HTML
// extended:true permite receber objetos dentro de objetos
// Exemplo:
// usuario.nome, usuario.email
app.use(express.urlencoded({ extended: true }));


// Configuração do CORS
// Permite comunicação entre frontend e backend
app.use(cors({

    // Define quais endereços podem acessar essa API
    // Aqui estamos permitindo dois possíveis frontends:
    // React na porta 3000
    // Outro frontend na porta 4000
    origin: [
        "http://localhost:4000",
        "http://localhost:3000"
    ],

    // Permite envio de cookies junto nas requisições
    // Necessário para manter login usando sessão
    credentials: true
}));


// Ativa o cookie-parser no projeto
// Com ele conseguimos acessar cookies enviados pelo navegador
// Exemplo:
// req.cookies.usuario
app.use(cookieParser());


// =====================================================
// CONFIGURAÇÃO DE SESSÃO DO USUÁRIO
// =====================================================


// Cria o sistema de sessão
// Sessão guarda informações temporárias do usuário logado
app.use(session({

    // Chave usada para proteger os dados da sessão
    // Normalmente vem do arquivo .env por segurança
    // Caso não exista usa "motorflex_sessao"
    secret: process.env.SESSION_SECRET || "motorflex_sessao",


    // Evita salvar a sessão novamente se nada mudou
    // Melhora desempenho
    resave: false,


    // Não cria sessão vazia para usuários que nunca fizeram login
    // Evita criar dados desnecessários
    saveUninitialized: false,


    // Configuração do cookie da sessão
    cookie: {


        // Impede que scripts do navegador acessem o cookie
        // Ajuda na segurança contra ataques XSS
        httpOnly: true,


        // false significa que funciona em HTTP local
        // Em produção com HTTPS deve ser true
        secure: false,


        // Define quanto tempo a sessão ficará ativa
        // Aqui está configurado para 24 horas
        maxAge:
        1000 * 60 * 60 * 24

    }
}));



// =====================================================
// ARQUIVOS PÚBLICOS
// =====================================================


// Define a pasta "public" como pública
// Tudo dentro dela pode ser acessado pelo navegador
//
// Exemplo:
// public/css/style.css
// public/js/script.js
// public/pages/index.html
app.use(express.static(path.join(__dirname, "public")));



// =====================================================
// PÁGINA PRINCIPAL
// =====================================================


// Quando alguém acessar:
// localhost:4000/
//
// Essa rota será executada
app.get("/", (req, res) => {


    // Envia o arquivo index.html para o navegador
    //
    // __dirname representa a pasta atual do projeto
    // path.join monta o caminho correto até o arquivo
    res.sendFile(
        path.join(__dirname, "public", "pages", "index.html")
    );

});



// =====================================================
// ROTAS DA API
// =====================================================


// Importa as rotas relacionadas aos usuários
//
// Dentro desse arquivo provavelmente existem:
// - cadastro
// - login
// - atualização
// - exclusão
const usuarioRoutes = require("./src/routes/usuarioRoutes");


// Todas as rotas desse arquivo começam com:
// /api/usuarios
//
// Exemplo:
// GET /api/usuarios
// POST /api/usuarios/login
app.use("/api/usuarios", usuarioRoutes);



// Importa as rotas relacionadas aos veículos
//
// Responsável por operações como:
// - cadastrar veículo
// - listar veículos
// - editar veículo
// - remover veículo
const veiculoRoutes = require("./src/routes/veiculoRoutes");


// Todas as rotas de veículos começam com:
// /api/veiculos
//
// Exemplo:
// GET /api/veiculos
// POST /api/veiculos
app.use("/api/veiculos", veiculoRoutes);



// =====================================================
// ROTA DE TESTE
// =====================================================


// Criando uma rota simples para verificar se o servidor está funcionando
//
// Ao acessar:
// localhost:4000/teste
//
// Retorna uma mensagem JSON
app.get("/teste", (req, res) => {


    res.json({

        // Indica que a operação funcionou
        sucesso: true,


        // Mensagem exibida para confirmar funcionamento
        mensagem: "Servidor motorFlex funcionando!",


        // Mostra qual porta o servidor está usando
        porta: process.env.PORT || 4000

    });

});



// =====================================================
// TRATAMENTO DE ROTAS INEXISTENTES
// =====================================================


// Essa parte só executa se nenhuma rota anterior funcionar
//
// Exemplo:
// usuário tenta acessar:
// localhost:4000/abc123
//
// Como não existe, cai aqui
app.use((req, res) => {


    // Retorna erro 404 (Página/Rota não encontrada)
    res.status(404).json({

        sucesso: false,

        mensagem:
        "Rota não encontrada."

    });

});



// =====================================================
// INICIALIZAÇÃO DO SERVIDOR
// =====================================================


// Define a porta onde o servidor ficará funcionando
//
// Primeiro tenta pegar do arquivo .env
// Caso não exista usa a porta 4000
const PORT = process.env.PORT || 4000;


// Define o endereço usado na mensagem do console
const PROD = process.env.PROD || "http://localhost";



// Inicia o servidor
//
// Depois disso o backend começa a aceitar requisições
app.listen(PORT, () => {


    // Mostra no terminal uma mensagem informando que iniciou
    console.log(
        `Servidor rodando em ${PROD}:${PORT}`
    );


});