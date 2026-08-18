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
