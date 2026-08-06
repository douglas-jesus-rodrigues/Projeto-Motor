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
        // Pega apenas o primeiro nome para uma saudação mais amigável
        const primeiroNome = usuario.nome ? usuario.nome.split(" ")[0] : "Cliente";
        
        // Mantém o ícone do Font Awesome e atualiza o texto de boas-vindas
        nomeUsuario.innerHTML = `<i class="fa-solid fa-user-circle"></i> Bem-vindo, ${primeiroNome}`;
    }

    // 3. CONFIGURAR BOTÃO DE SAIR
    const btnSair = document.getElementById("btnSair");
    if (btnSair) {
        btnSair.addEventListener("click", function(event){
            event.preventDefault();

            localStorage.removeItem("usuario");
            localStorage.removeItem("token"); // Remove o token também, caso utilize
            window.location.href = "/pages/login.html";
        });
    }
});