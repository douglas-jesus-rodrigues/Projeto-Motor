// Seleciona o formulário principal da página usando o ID "formCadastro"
const formCadastro = document.getElementById("formCadastro");

// --- SEÇÃO DE SELEÇÃO DE CAMPOS DE ENTRADA (INPUTS) ---
const nome = document.getElementById("nome");
const sobrenome = document.getElementById("sobrenome");
const email = document.getElementById("email");
const telefone = document.getElementById("telefone");
const tipo = document.getElementById("tipo"); 
const cpf = document.getElementById("cpf");

const nomeEmpresa = document.getElementById("nomeEmpresa");
const cnpj = document.getElementById("cnpj");
const razaoSocial = document.getElementById("razaoSocial");
const inscricaoEstadual = document.getElementById("inscricaoEstadual");
const site = document.getElementById("site");

const senha = document.getElementById("senha");
const confirmarSenha = document.getElementById("confirmarSenha");

const btnSenha = document.getElementById("btnSenha"); 
const btnCadastrar = document.getElementById("btnCadastrar"); 

// --- SEÇÃO DE SELEÇÃO DE MENSAGENS DE ERRO ---
const erroNome = document.getElementById("erroNome");
const erroSobrenome = document.getElementById("erroSobrenome");
const erroEmail = document.getElementById("erroEmail");
const erroTelefone = document.getElementById("erroTelefone");
const erroTipo = document.getElementById("erroTipo");
const erroCpf = document.getElementById("erroCpf");
const erroEmpresa = document.getElementById("erroEmpresa");
const erroCnpj = document.getElementById("erroCnpj");
const erroSenha = document.getElementById("erroSenha");
const erroConfirmar = document.getElementById("erroConfirmar");

const camposEmpresa = document.querySelectorAll(".empresa-campos");

// --- FORMATAÇÃO EM TEMPO REAL (MÁSCARAS SIMPLES) ---
cpf.addEventListener("input", () => {
    cpf.value = cpf.value.replace(/\D/g, "").slice(0, 11);
});

telefone.addEventListener("input", () => {
    telefone.value = telefone.value.replace(/\D/g, "").slice(0, 11);
});

cnpj.addEventListener("input", () => {
    cnpj.value = cnpj.value.replace(/\D/g, "").slice(0, 14);
});

// --- LÓGICA DE MOSTRAR/ESCONDER CAMPOS DE EMPRESA ---
tipo.addEventListener("change", () => {
    if (tipo.value === "empresa") {
        camposEmpresa.forEach(campo => campo.style.display = "flex");
    } else {
        camposEmpresa.forEach(campo => campo.style.display = "none");
        nomeEmpresa.value = "";
        cnpj.value = "";
        razaoSocial.value = "";
        inscricaoEstadual.value = "";
        site.value = "";
    }
});

// --- LÓGICA DE MOSTRAR/OCULTAR SENHA ---
btnSenha.addEventListener("click", () => {
    if (senha.type === "password") {
        senha.type = "text"; 
        btnSenha.textContent = "Ocultar"; 
    } else {
        senha.type = "password";
        btnSenha.textContent = "Ver"; 
    }
});

// --- LÓGICA DE ENVIO DO FORMULÁRIO (VALIDAÇÃO E API) ---
formCadastro.addEventListener("submit", async (event) => {
    event.preventDefault();
    limparErros();

    let valido = true;

    if (nome.value.trim() === "") {
        erroNome.textContent = "Digite seu nome.";
        valido = false;
    }

    if (sobrenome.value.trim() === "") {
        erroSobrenome.textContent = "Digite seu sobrenome.";
        valido = false;
    }

    if (email.value.trim() === "") {
        erroEmail.textContent = "Digite seu e-mail.";
        valido = false;
    } else if (!validarEmail(email.value.trim())) {
        erroEmail.textContent = "Digite um e-mail válido.";
        valido = false;
    }

    if (telefone.value.trim() === "") {
        erroTelefone.textContent = "Digite seu telefone.";
        valido = false;
    } else if (telefone.value.length < 10) {
        erroTelefone.textContent = "Digite um telefone válido.";
        valido = false;
    }

    if (tipo.value === "") {
        erroTipo.textContent = "Selecione o tipo de conta.";
        valido = false;
    }

    if (cpf.value.trim() === "") {
        erroCpf.textContent = "Digite seu CPF.";
        valido = false;
    } else if (cpf.value.length !== 11) {
        erroCpf.textContent = "CPF deve ter 11 números.";
        valido = false;
    }

    if (tipo.value === "empresa") {
        if (nomeEmpresa.value.trim() === "") {
            erroEmpresa.textContent = "Digite o nome da empresa.";
            valido = false;
        }

        if (cnpj.value.trim() === "") {
            erroCnpj.textContent = "Digite o CNPJ.";
            valido = false;
        } else if (cnpj.value.length !== 14) {
            erroCnpj.textContent = "CNPJ deve ter 14 números.";
            valido = false;
        }
    }

    if (senha.value.length < 6) {
        erroSenha.textContent = "A senha deve ter no mínimo 6 caracteres.";
        valido = false;
    }

    if (confirmarSenha.value.trim() === "") {
        erroConfirmar.textContent = "Confirme sua senha.";
        valido = false;
    } else if (confirmarSenha.value !== senha.value) {
        erroConfirmar.textContent = "As senhas não coincidem.";
        valido = false;
    }

    if (!valido) return;
    
    btnCadastrar.textContent = "Cadastrando...";
    btnCadastrar.disabled = true;

    const dados = {
        nome: nome.value.trim(),
        sobrenome: sobrenome.value.trim(),
        email: email.value.trim().toLowerCase(), 
        telefone: telefone.value.trim(),
        cpf: cpf.value.trim(),
        tipo: tipo.value,
        senha: senha.value,
        cnpj: tipo.value === "empresa" ? cnpj.value.trim() : null,
        nome_empresa: tipo.value === "empresa" ? nomeEmpresa.value.trim() : null,
        razao_social: tipo.value === "empresa" ? razaoSocial.value.trim() : null,
        inscricao_estadual: tipo.value === "empresa" ? inscricaoEstadual.value.trim() : null,
        site: tipo.value === "empresa" ? site.value.trim() : null
    };

    try {
        const resposta = await fetch("/api/usuarios/cadastro", {
            method: "POST", 
            headers: {
                "Content-Type": "application/json" 
            },
            body: JSON.stringify(dados) 
        });

        const data = await resposta.json();

        // Se o servidor retornar erro (ex: e-mail já cadastrado)
        if (!data.sucesso) {
            Swal.fire({
                icon: 'error',
                title: 'Atenção',
                text: data.mensagem,
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914',
                confirmButtonText: 'OK'
            });
        } else {
            // Se deu tudo certo no cadastro
            Swal.fire({
                icon: 'success',
                title: 'Sucesso!',
                text: data.mensagem,
                background: '#141414',
                color: '#ffffff',
                confirmButtonColor: '#e50914',
                confirmButtonText: 'Entrar'
            }).then(() => {
                window.location.href = "/pages/login.html";
            });
        }

    } catch (erro) {
        console.error("Erro:", erro);
        Swal.fire({
            icon: 'error',
            title: 'Erro de Conexão',
            text: 'Erro ao conectar com o servidor.',
            background: '#141414',
            color: '#ffffff',
            confirmButtonColor: '#e50914'
        });
    } finally {
        btnCadastrar.textContent = "Cadastrar";
        btnCadastrar.disabled = false;
    }
});

// --- FUNÇÕES AUXILIARES ---
function limparErros() {
    erroNome.textContent = "";
    erroSobrenome.textContent = "";
    erroEmail.textContent = "";
    erroTelefone.textContent = "";
    erroTipo.textContent = "";
    erroCpf.textContent = "";
    erroEmpresa.textContent = "";
    erroCnpj.textContent = "";
    erroSenha.textContent = "";
    erroConfirmar.textContent = "";
}

function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.(com|com\.br|net|org|edu|gov|br)$/i;
    return regex.test(email);
}