document.addEventListener("DOMContentLoaded", () => {
    // 1. VERIFICAÇÃO DE SEGURANÇA
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    if (!usuario) {
        window.location.href = "/pages/login.html";
        return;
    }

    // 2. EXIBIR O NOME DO USUÁRIO PERSONALIZADO
    const nomeUsuario = document.getElementById("nomeUsuario");
    if (usuario && nomeUsuario) {
        // Separa o nome pelos espaços e pega apenas a primeira palavra
        const primeiroNome = usuario.nome ? usuario.nome.split(" ")[0] : "Cliente";
        
        // Mantém o ícone do Font Awesome e atualiza o texto de boas-vindas
        nomeUsuario.innerHTML = `<i class="fa-solid fa-user-circle"></i> Bem-vindo, ${primeiroNome}`;
    }

    // 3. CONFIGURAR BOTÃO DE SAIR DEFINITIVO (DENTRO DO MODAL)
    const btnSair = document.getElementById("btnSair");
    if (btnSair) {
        btnSair.addEventListener("click", function() {
            // Limpa o armazenamento local das credenciais do usuário
            localStorage.removeItem("usuario");
            localStorage.removeItem("token"); // Remove o token de autenticação caso utilize
            
            // Redireciona o cliente de volta para a tela de login
            window.location.href = "/pages/login.html";
        });
    }
});

document.addEventListener("DOMContentLoaded", () => {
    // =========================================================================
    // 1. VERIFICAÇÃO DE SEGURANÇA E SAUDAÇÃO PERSONALIZADA
    // =========================================================================
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    // Bloqueia o acesso e joga para o login caso o usuário não esteja autenticado
    if (!usuario) {
        window.location.href = "/pages/login.html";
        return;
    }

    // Exibe o primeiro nome do banco de dados na mensagem de boas-vindas
    const nomeUsuario = document.getElementById("nomeUsuario");
    if (usuario && nomeUsuario) {
        // Separa o nome pelos espaços e pega apenas a primeira palavra
        const primeiroNome = usuario.nome ? usuario.nome.split(" ")[0] : "Cliente";
        nomeUsuario.innerHTML = `<i class="fa-solid fa-user-circle"></i> Bem-vindo, ${primeiroNome}`;
    }

    // =========================================================================
    // 2. CONTROLE DO DROPDOWN DE CONFIGURAÇÕES (COM ANIMAÇÃO)
    // =========================================================================
    const btnConfig = document.getElementById('btnConfig');
    const menuConfig = document.getElementById('menuConfig');

    if (btnConfig && menuConfig) {
        // Abre e fecha o menu ao clicar na engrenagem
        btnConfig.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que o evento de fechar global seja disparado
            
            // Alterna a classe que aciona a opacidade e escala no CSS
            const estaAtivo = menuConfig.classList.toggle('mostrar');
            
            // Altera o atributo aria para o CSS disparar a rotação da engrenagem
            btnConfig.setAttribute('aria-expanded', estaAtivo);
        });

        // Fecha a caixinha automaticamente se o usuário clicar fora dela
        document.addEventListener('click', () => {
            menuConfig.classList.remove('mostrar');
            btnConfig.setAttribute('aria-expanded', 'false');
        });
    }

    // =========================================================================
    // 3. CONTROLE MICRO-INTERATIVO DO MODAL DE CONFIRMAÇÃO DE SAÍDA
    // =========================================================================
    const gatilhoSair = document.getElementById('gatilhoSair');
    const modalSairContainer = document.getElementById('modalSairContainer');
    const btnCancelarSair = document.getElementById('btnCancelarSair');
    const btnSairConfirmado = document.getElementById('btnSair');

    if (gatilhoSair && modalSairContainer && btnCancelarSair) {
        // Função utilitária para fechar o modal limpando as classes
        const fecharModal = () => modalSairContainer.classList.remove('mostrar-modal');

        // Intercepta o clique do link de sair do dropdown e ergue o modal na tela
        gatilhoSair.addEventListener('click', (e) => {
            e.preventDefault();
            modalSairContainer.classList.add('mostrar-modal');
        });

        // Fecha se o usuário desistir e clicar em Cancelar
        btnCancelarSair.addEventListener('click', fecharModal);

        // Fecha se o usuário clicar na área escura desfocada (fora da caixinha)
        modalSairContainer.addEventListener('click', (e) => {
            if (e.target === modalSairContainer) fecharModal();
        });

        // AÇÃO DEFINITIVA: Executa o logout limpo se o usuário confirmar
        if (btnSairConfirmado) {
            btnSairConfirmado.addEventListener('click', () => {
                fecharModal();
                
                // Limpa as credenciais de segurança salvas no navegador
                localStorage.removeItem("usuario");
                localStorage.removeItem("token"); 
                
                // Desloga e manda de volta para a tela de login
                window.location.href = "/pages/login.html";
            });
        }
    }
});
