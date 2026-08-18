document.addEventListener("DOMContentLoaded", async () => {
    // Armazenamento privado em memória apenas para as informações estritamente ocultadas
    const dadosReais = {
        email: "",
        cpf: ""
    };

    // 1. VERIFICAÇÃO DE SEGURANÇA LOCAL INICIAL
    const usuarioLocal = JSON.parse(localStorage.getItem("usuario"));

    if (!usuarioLocal) {
        window.location.href = "/pages/login.html";
        return;
    }

    configurarBotaoVoltar(usuarioLocal.tipo);

    try {
        // 2. BUSCA OS DADOS EM TEMPO REAL NO BANCO DE DADOS
        const response = await fetch(`/api/perfil/meu-perfil?id=${usuarioLocal.id}`);
        const dados = await response.json();

        if (!dados.sucesso) {
            throw new Error(dados.mensagem);
        }

        const usuario = dados.usuario;
        localStorage.setItem("usuario", JSON.stringify(usuario));

        // 3. CONFIGURAÇÃO DA BADGE
        const badgeTipoConta = document.getElementById("badgeTipoConta");
        if (badgeTipoConta) {
            badgeTipoConta.className = "badge";
            badgeTipoConta.classList.add(usuario.tipo);

            if (usuario.tipo === "admin") {
                badgeTipoConta.innerHTML = 'Administrador';
            } else if (usuario.tipo === "empresa") {
                badgeTipoConta.innerHTML = 'Conta Jurídica';
            } else {
                badgeTipoConta.innerHTML = 'Conta Individual';
            }
        }

        // 4. RETENÇÃO SEGURA DOS DADOS SENSÍVEIS (E-MAIL E CPF)
        dadosReais.email = usuario.email || "";
        dadosReais.cpf = formatarCPF(usuario.cpf);

        // Preenchimento dos dados textuais limpos/comuns abertos
        document.getElementById("nome").value = usuario.nome || "";
        document.getElementById("sobrenome").value = usuario.sobrenome || "";
        document.getElementById("telefone").value = formatarTelefone(usuario.telefone) || "";

        // Aplicação das máscaras iniciais protegidas
        document.getElementById("email").value = dadosReais.email ? gerarMascaraEmail(dadosReais.email) : "";
        document.getElementById("cpf").value = dadosReais.cpf ? "***.***.***-**" : "";

        // 5. SEÇÃO CORPORATIVA
        if (usuario.tipo === "empresa") {
            const secaoEmpresa = document.getElementById("secaoEmpresa");
            if (secaoEmpresa) {
                secaoEmpresa.style.display = "block";

                document.getElementById("cnpj").value = formatarCNPJ(usuario.cnpj) || "";
                document.getElementById("nomeEmpresa").value = usuario.nome_empresa || "";
                document.getElementById("razaoSocial").value = usuario.razao_social || "";
                document.getElementById("inscricaoEstadual").value = usuario.inscricao_estadual || "";
                document.getElementById("site").value = usuario.site || "";
            }
        }

        // 6. ATIVAÇÃO DO GATILHO DOS BOTÕES TEXTUAIS (VER / OCULTAR)
        configurarBotoesRevelar(dadosReais);

    } catch (error) {
        console.error("Erro ao carregar perfil do banco:", error);
        alert("Não foi possível carregar as informações atualizadas do servidor.");
    }
});

/**
 * Define de maneira dinâmica para qual painel o usuário retornará ao clicar em Voltar
 */
function configurarBotaoVoltar(tipo) {
    const btnVoltar = document.getElementById("btnVoltar");
    if (btnVoltar) {
        if (tipo === "admin") {
            btnVoltar.href = "/pages/painel-admin.html";
        } else {
            btnVoltar.href = "/pages/painel-cliente.html";
        }
    }
}

/**
 * Controla a alternância de texto do botão ("Ver" / "Ocultar") e do valor do input
 */
function configurarBotoesRevelar(dadosReais) {
    const botoes = document.querySelectorAll(".btn-revelar");

    botoes.forEach(botao => {
        botao.addEventListener("click", () => {
            const alvoId = botao.getAttribute("data-alvo");
            const input = document.getElementById(alvoId);

            if (!input) return;

            // Tratamento toUpperCase para evitar qualquer falha caso mude a caixa alta do HTML
            if (botao.innerText.trim().toUpperCase() === "VER") {
                input.value = dadosReais[alvoId]; // Revela o dado real
                botao.innerText = "Ocultar"; // Altera o texto
                botao.style.color = "#ffffff";
                botao.style.backgroundColor = "var(--primary)"; // Destaca o botão ativo em vermelho
                botao.style.borderColor = "var(--primary-hover)";
            } else {
                input.value = alvoId === "email" ? gerarMascaraEmail(dadosReais.email) : "***.***.***-**";
                botao.innerText = "Ver"; // Retorna o texto original
                botao.style.color = ""; // Reseta o estilo para o padrão CSS
                botao.style.backgroundColor = "";
                botao.style.borderColor = "";
            }
        });
    });
}

/**
 * Cria uma máscara amigável para emails (exemplo: adm***@motorflex.com)
 */
function gerarMascaraEmail(email) {
    if (!email.includes("@")) return "******";
    const [usuario, dominio] = email.split("@");
    if (usuario.length <= 3) return `${usuario}***@${dominio}`;
    return `${usuario.substring(0, 3)}***@${dominio}`;
}

// ==========================================
// MÁSCARAS DE PROCESSAMENTO VISUAL (MYSQL)
// ==========================================

function formatarCPF(cpf) {
    if (!cpf) return "";
    const limpo = cpf.replace(/\D/g, "");
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatarCNPJ(cnpj) {
    if (!cnpj) return "";
    const limpo = cnpj.replace(/\D/g, "");
    return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatarTelefone(tel) {
    if (!tel) return "";
    const limpo = tel.replace(/\D/g, "");
    if (limpo.length === 11) {
        return limpo.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return limpo.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
}
