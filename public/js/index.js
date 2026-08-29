// =========================================================================
// MOTORFLEX - SISTEMA UNIFICADO DE INTERFACE, ROTAS E BANCO DE DADOS
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. GERENCIAMENTO DE NAVEGAÇÃO SPA (INÍCIO, SOBRE NÓS E CONTATO)
    const linksSpa = document.querySelectorAll(".nav-link[data-target]");
    const secoes = document.querySelectorAll(".page-section");

    function alternarSecao(targetId) {
        secoes.forEach(sec => {
            sec.classList.remove("active");
        });

        const secaoAtiva = document.getElementById(`sec-${targetId}`);
        if (secaoAtiva) {
            secaoAtiva.classList.add("active");
        }

        linksSpa.forEach(link => {
            if (link.getAttribute("data-target") === targetId) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });
    }

    linksSpa.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const target = link.getAttribute("data-target");
            alternarSecao(target);
            window.location.hash = target;
        });
    });

    // Detectar Hash na URL ao carregar (ex: index.html#sobre ou index.html#contato)
    const hashAtual = window.location.hash.replace("#", "") || "home";
    if (document.getElementById(`sec-${hashAtual}`)) {
        alternarSecao(hashAtual);
    } else {
        alternarSecao("home");
    }

    // 2. GERENCIAMENTO DE SESSÃO E PERFIL DO USUÁRIO
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    const acoesDeslogado = document.getElementById("acoesDeslogado");
    const dropdownUsuario = document.getElementById("dropdownUsuario");
    const nomeUsuario = document.getElementById("nomeUsuario");
    const avatarLetra = document.getElementById("avatarLetra");
    const irPainel = document.getElementById("irPainel");
    const itemAnunciar = document.getElementById("itemAnunciar");

    if (usuario) {
        if (acoesDeslogado) acoesDeslogado.style.display = "none";
        if (dropdownUsuario) dropdownUsuario.style.display = "block";

        let rotaPainel = "/pages/painel-cliente.html";
        if (usuario.tipo === "empresa") {
            rotaPainel = "/pages/painel-empresa.html";
        } else if (usuario.tipo === "admin" || usuario.cargo === "admin") {
            rotaPainel = "/pages/painel-admin.html";
        }

        // Oculta a opção de anunciar se o usuário for Admin, exibe se for cliente/empresa
        if (usuario.tipo === "admin" || usuario.cargo === "admin") {
            if (itemAnunciar) itemAnunciar.style.display = "none";
        } else {
            if (itemAnunciar) itemAnunciar.style.display = "block";
        }

        if (irPainel) {
            irPainel.href = rotaPainel;
        }

        let nomeExibicao = "Minha Conta";
        if (usuario.tipo === "empresa" && usuario.empresa && usuario.empresa.nome_empresa) {
            nomeExibicao = usuario.empresa.nome_empresa;
        } else if (usuario.nome) {
            nomeExibicao = usuario.nome.split(" ")[0];
        }

        if (nomeUsuario) nomeUsuario.textContent = nomeExibicao;
        if (avatarLetra) avatarLetra.textContent = nomeExibicao.charAt(0).toUpperCase();

    } else {
        if (acoesDeslogado) acoesDeslogado.style.display = "flex";
        if (dropdownUsuario) dropdownUsuario.style.display = "none";
        
        // Garante que visitantes deslogados não vejam o botão de anunciar
        if (itemAnunciar) itemAnunciar.style.display = "none";
    }

    // 3. DROPDOWN E SAIR
    const btnConfig = document.getElementById("btnConfig");
    const menuConfig = document.getElementById("menuConfig");

    if (btnConfig && menuConfig) {
        btnConfig.addEventListener("click", (e) => {
            e.stopPropagation();
            const oculto = menuConfig.hidden;
            menuConfig.hidden = !oculto;
            btnConfig.setAttribute("aria-expanded", oculto);
        });

        document.addEventListener("click", (e) => {
            if (!btnConfig.contains(e.target) && !menuConfig.contains(e.target)) {
                menuConfig.hidden = true;
                btnConfig.setAttribute("aria-expanded", "false");
            }
        });
    }

    const btnSair = document.getElementById("btnSair");
    if (btnSair) {
        btnSair.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("usuario");
            window.location.reload();
        });
    }

    // 4. FUNCIONALIDADE DE BUSCA RÁPIDA
    const btnBuscarRapido = document.getElementById("btnBuscarRapido");
    const inputBuscaRapida = document.getElementById("inputBuscaRapida");

    function executarBusca() {
        const termo = inputBuscaRapida.value.trim();
        if (termo) {
            window.location.href = `/pages/catalogo.html?busca=${encodeURIComponent(termo)}`;
        } else {
            window.location.href = "/pages/catalogo.html";
        }
    }

    if (btnBuscarRapido && inputBuscaRapida) {
        btnBuscarRapido.addEventListener("click", executarBusca);
        inputBuscaRapida.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                executarBusca();
            }
        });
    }

    // 5. MENU RESPONSIVO MOBILE E EFEITOS DE SCROLL
    const btnMobile = document.getElementById("btnMobile");
    const menuNavegacao = document.getElementById("menuNavegacao");

    if (btnMobile && menuNavegacao) {
        btnMobile.addEventListener("click", () => {
            menuNavegacao.classList.toggle("ativo");
        });
    }

    const header = document.querySelector(".header");
    if (header) {
        window.addEventListener("scroll", () => {
            if (window.scrollY > 50) {
                header.style.background = "rgba(4, 4, 5, 0.95)";
                header.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.7)";
            } else {
                header.style.background = "rgba(8, 8, 10, 0.85)";
                header.style.boxShadow = "none";
            }
        });
    }

    // 6. EFEITO DE FUMAÇA AO CLICAR NO BOTÃO "VER CATÁLOGO"
    const btnCatalogo = document.getElementById("btnVerCatalogo");

    if (btnCatalogo) {
        btnCatalogo.addEventListener("click", (e) => {
            const rect = btnCatalogo.getBoundingClientRect();
            const totalParticles = 16;

            for (let i = 0; i < totalParticles; i++) {
                createSmokeParticle(rect);
            }
        });
    }
});

function createSmokeParticle(rect) {
    const particle = document.createElement("div");
    particle.classList.add("smoke-particle");

    const posX = rect.left + rect.width / 2;
    const posY = rect.top + rect.height / 2;

    const size = Math.random() * 70 + 40;

    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 140 + 50; 
    
    const dx = (Math.cos(angle) * distance) + "px";
    const dy = (Math.sin(angle) * distance - Math.random() * 60) + "px"; 
    const scale = (Math.random() * 1.6 + 1.8).toFixed(2);

    particle.style.left = `${posX}px`;
    particle.style.top = `${posY}px`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    
    particle.style.setProperty("--dx", dx);
    particle.style.setProperty("--dy", dy);
    particle.style.setProperty("--scale", scale);

    document.body.appendChild(particle);

    setTimeout(() => {
        particle.remove();
    }, 1200);
}