// ==========================================
// MOTORFLEX - JAVASCRIPT DA HOME
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. CONTROLE DE LOGIN E DIRECIONAMENTO NO MENU
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    const menuLogado = document.getElementById("menuLogado");
    const menuNaoLogado = document.getElementById("menuNaoLogado");
    const nomeUsuario = document.getElementById("nomeUsuario");
    const irPainel = document.getElementById("irPainel");

    if (usuario) {
        if (menuNaoLogado) menuNaoLogado.style.display = "none";
        if (menuLogado) menuLogado.style.display = "flex";

        // Exibe o nome correto no menu flutuante (Nome da Empresa ou Primeiro Nome do Cliente)
        if (nomeUsuario) {
            if (usuario.tipo === "empresa" && usuario.empresa && usuario.empresa.nome_empresa) {
                nomeUsuario.textContent = usuario.empresa.nome_empresa;
            } else if (usuario.nome) {
                // Pega o primeiro nome para não estourar o layout do menu
                nomeUsuario.textContent = usuario.nome.split(" ")[0];
            } else {
                nomeUsuario.textContent = "Conta";
            }
        }
    } else {
        if (menuNaoLogado) menuNaoLogado.style.display = "flex";
        if (menuLogado) menuLogado.style.display = "none";
    }

    // Gerencia o clique no link do Painel levando para a tela correta do banco
    if (irPainel) {
        irPainel.addEventListener("click", function (event) {
            event.preventDefault();

            if (!usuario) {
                window.location.href = "/pages/login.html";
                return;
            }

            if (usuario.tipo === "empresa") {
                window.location.href = "/pages/painel-empresa.html";
            } else if (usuario.tipo === "admin") {
                window.location.href = "/pages/painel-admin.html";
            } else {
                window.location.href = "/pages/painel-cliente.html";
            }
        });
    }

    // =========================================================================
    // 2. CONTROLE DO DROPDOWN DO AVATAR DE USUÁRIO
    // =========================================================================
    const btnConfig = document.getElementById('btnConfig');
    const menuConfig = document.getElementById('menuConfig');

    if (btnConfig && menuConfig) {
        btnConfig.addEventListener('click', (e) => {
            e.stopPropagation();
            const estaAtivo = menuConfig.classList.toggle('mostrar');
            btnConfig.setAttribute('aria-expanded', estaAtivo);
        });

        // Fecha a caixinha flutuante se o usuário clicar fora dela
        document.addEventListener('click', () => {
            menuConfig.classList.remove('mostrar');
            btnConfig.setAttribute('aria-expanded', 'false');
        });
    }

    // =========================================================================
    // 3. MENU RESPONSIVO MOBILE (BURGER)
    // =========================================================================
    const btnMobile = document.getElementById("btnMobile");
    const menu = document.getElementById("menu");

    if (btnMobile && menu) {
        btnMobile.addEventListener("click", function () {
            menu.classList.toggle("ativo");
        });
    }

    // =========================================================================
    // 4. BOTÃO DE BUSCA RÁPIDA
    // =========================================================================
    const botaoBusca = document.querySelector(".busca button");

    if (botaoBusca) {
        botaoBusca.addEventListener("click", function () {
            alert("Sistema de busca será conectado ao banco de dados em breve.");
        });
    }

    // =========================================================================
    // 5. HEADER COMPORTAMENTO AO ROLAR A PÁGINA
    // =========================================================================
    const header = document.querySelector(".header");

    if (header) {
        window.addEventListener("scroll", function () {
            if (window.scrollY > 50) {
                header.style.background = "#050505";
                header.style.boxShadow = "0 0 10px rgba(0,0,0,0.4)";
            } else {
                header.style.background = "#0b0b0b";
                header.style.boxShadow = "none";
            }
        });
    }
});
