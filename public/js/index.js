// ==========================================
// MOTORFLEX - JAVASCRIPT DA HOME
// ==========================================

// MENU MOBILE
const btnMobile = document.getElementById("btnMobile");
const menu = document.getElementById("menu");

if (btnMobile && menu) {
    btnMobile.addEventListener("click", function () {
        menu.classList.toggle("ativo");
    });
}

// BOTÃO DE BUSCA
const botaoBusca = document.querySelector(".busca button");

if (botaoBusca) {
    botaoBusca.addEventListener("click", function () {
        alert("Sistema de busca será conectado ao banco de dados em breve.");
    });
}

// EFEITO NOS CARDS
const cards = document.querySelectorAll(".card");

cards.forEach(function (card) {
    card.addEventListener("mouseenter", function () {
        card.style.transform = "translateY(-8px)";
        card.style.transition = "0.4s";
    });

    card.addEventListener("mouseleave", function () {
        card.style.transform = "translateY(0px)";
    });
});

// HEADER AO ROLAR
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

// CONTROLE DE LOGIN NO MENU
const usuario = JSON.parse(localStorage.getItem("usuario"));

const menuLogado = document.getElementById("menuLogado");
const menuNaoLogado = document.getElementById("menuNaoLogado");
const nomeUsuario = document.getElementById("nomeUsuario");
const irPainel = document.getElementById("irPainel");

if (usuario) {
    if (menuNaoLogado) {
        menuNaoLogado.style.display = "none";
    }

    if (menuLogado) {
        menuLogado.style.display = "flex";
    }

    if (nomeUsuario) {
        if (usuario.tipo === "empresa" && usuario.empresa && usuario.empresa.nome_empresa) {
            nomeUsuario.textContent = usuario.empresa.nome_empresa;
        } else {
            nomeUsuario.textContent = usuario.nome;
        }
    }
}

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