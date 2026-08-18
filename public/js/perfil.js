document.addEventListener("DOMContentLoaded", async () => {
    // 1. VERIFICAÇÃO DE SEGURANÇA LOCAL INICIAL
    const usuarioLocal = JSON.parse(localStorage.getItem("usuario"));

    // Se não houver dados locais, impede o carregamento e manda para o login
    if (!usuarioLocal) {
        window.location.href = "/pages/login.html";
        return;
    }

    // Configura o botão voltar imediatamente usando o tipo de conta local para evitar delay
    configurarBotaoVoltar(usuarioLocal.tipo);

    try {
        // 2. BUSCA OS DADOS EM TEMPO REAL NO BANCO DE DADOS (Via Fetch)
        // Passa o ID do usuário como Query Param para validação no Controller backend
        const response = await fetch(`/api/perfil/meu-perfil?id=${usuarioLocal.id}`);
        const dados = await response.json();

        if (!dados.sucesso) {
            throw new Error(dados.mensagem);
        }

        const usuario = dados.usuario;

        // Sincroniza e atualiza o localStorage para garantir consistência no restante do sistema
        localStorage.setItem("usuario", JSON.stringify(usuario));

        // 3. ATUALIZAÇÃO DA BADGE DE TIPO DE CONTA
        const badgeTipoConta = document.getElementById("badgeTipoConta");
        if (badgeTipoConta) {
            // Limpa classes anteriores e injeta a classe atual (admin, individual ou empresa)
            badgeTipoConta.className = "badge";
            badgeTipoConta.classList.add(usuario.tipo);

            // Injeta o texto e o ícone correspondente à categoria da conta
            if (usuario.tipo === "admin") {
                badgeTipoConta.innerHTML = '<i class="fa-solid fa-user-shield"></i> Administrador';
            } else if (usuario.tipo === "empresa") {
                badgeTipoConta.innerHTML = '<i class="fa-solid fa-building"></i> Conta Jurídica';
            } else {
                badgeTipoConta.innerHTML = '<i class="fa-solid fa-user"></i> Conta Individual';
            }
        }

        // 4. INJEÇÃO DOS DADOS PESSOAIS COMUNS
        document.getElementById("nome").value = usuario.nome || "";
        document.getElementById("sobrenome").value = usuario.sobrenome || "";
        document.getElementById("email").value = usuario.email || "";
        document.getElementById("telefone").value = formatarTelefone(usuario.telefone) || "";
        document.getElementById("cpf").value = formatarCPF(usuario.cpf) || "";

        // 5. EXIBIÇÃO E INJEÇÃO DOS DADOS DA SEÇÃO EMPRESA
        if (usuario.tipo === "empresa") {
            const secaoEmpresa = document.getElementById("secaoEmpresa");
            if (secaoEmpresa) {
                // Remove o 'display: none' do CSS e torna o bloco visível
                secaoEmpresa.style.display = "block";

                // Alimenta os inputs corporativos com os dados vindos do LEFT JOIN do backend
                document.getElementById("cnpj").value = formatarCNPJ(usuario.cnpj) || "";
                document.getElementById("nomeEmpresa").value = usuario.nome_empresa || "";
                document.getElementById("razaoSocial").value = usuario.razao_social || "";
                document.getElementById("inscricaoEstadual").value = usuario.inscricao_estadual || "";
                document.getElementById("site").value = usuario.site || "";
            }
        }

    } catch (error) {
        console.error("Erro ao carregar perfil do banco:", error);
        alert("Não foi possível carregar as informações atualizadas do servidor.");
    }
});

/**
 * Define de maneira dinâmica para qual painel o usuário retornará ao clicar em Voltar
 * @param {string} tipo - O tipo do usuário vindo do banco de dados (admin, individual, empresa)
 */
function configurarBotaoVoltar(tipo) {
    const btnVoltar = document.getElementById("btnVoltar");
    if (btnVoltar) {
        if (tipo === "admin") {
            btnVoltar.href = "/pages/painel-admin.html";
        } else {
            // Contas do tipo 'individual' e 'empresa' compartilham o painel-cliente.html
            btnVoltar.href = "/pages/painel-cliente.html";
        }
    }
}

// ==========================================
// FUNÇÕES AUXILIARES DE FORMATAÇÃO (MÁSCARAS)
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
