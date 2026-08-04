// Importa a classe Resend da biblioteca "resend"
// A classe Resend contém as funções necessárias para enviar e-mails através da API do Resend
//
// Exemplo:
// enviar um e-mail de confirmação de cadastro
const { Resend } = require("resend");


// Carrega as variáveis de ambiente que estão dentro do arquivo .env
//
// O arquivo .env normalmente guarda informações sensíveis,
// como:
// - chaves de API
// - senhas
// - configurações do sistema
//
// Exemplo de arquivo .env:
//
// RESEND_API_KEY=chave_secreta_aqui
//
// Dessa forma a chave não fica escrita diretamente no código
require("dotenv").config();


// Cria uma nova instância do Resend
//
// Aqui estamos "criando o objeto" que será usado pelo sistema
// para enviar os e-mails.
//
// A variável resend agora possui acesso aos métodos da biblioteca,
// como:
//
// resend.emails.send()
//
// que será usado para disparar mensagens.
const resend = new Resend(


    // Busca a chave de autenticação da API do Resend
    //
    // process.env acessa as variáveis de ambiente carregadas pelo dotenv
    //
    // Aqui ele pega:
    //
    // RESEND_API_KEY=alguma_chave
    //
    // que está no arquivo .env
    //
    // Essa chave é o que permite que o sistema tenha autorização
    // para enviar e-mails usando a conta do Resend.
    process.env.RESEND_API_KEY


);


// Exporta o objeto resend para que outros arquivos do projeto possam usar.
//
// Sem essa linha, esse arquivo ficaria isolado.
//
// Exemplo:
//
// Em outro arquivo:
//
// const resend = require("./config/resend");
//
// resend.emails.send({
//    from: "email@teste.com",
//    to: "usuario@email.com",
//    subject: "Bem-vindo",
//    html: "<h1>Olá</h1>"
// });
//
// Ou seja:
// esse arquivo cria a configuração uma única vez
// e disponibiliza para o restante do sistema.
module.exports = resend;