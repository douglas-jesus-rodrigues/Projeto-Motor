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

    const btnLogin = document.getElementById("btnLogin");
    const btnCadastro = document.getElementById("btnCadastro");
    const dropdownUsuario = document.getElementById("dropdownUsuario");
    const nomeUsuario = document.getElementById("nomeUsuario");
    const avatarLetra = document.getElementById("avatarLetra");
    const irPainel = document.getElementById("irPainel");
    const menuNavegacao = document.getElementById("menuNavegacao");

    if (usuario) {
        if (btnLogin) btnLogin.style.display = "none";
        if (btnCadastro) btnCadastro.style.display = "none";
        if (dropdownUsuario) dropdownUsuario.style.display = "block";

        let rotaPainel = "/pages/painel-cliente.html";
        if (usuario.tipo === "empresa") {
            rotaPainel = "/pages/painel-empresa.html";
        } else if (usuario.tipo === "admin") {
            rotaPainel = "/pages/painel-admin.html";
        }

        if (irPainel) {
            irPainel.href = rotaPainel;
        }

        if (menuNavegacao && !document.getElementById("linkMeuPainel")) {
            const li = document.createElement("li");
            li.innerHTML = `<a href="${rotaPainel}" id="linkMeuPainel" style="color: var(--primary); font-weight: 700;">Meu Painel</a>`;
            menuNavegacao.appendChild(li);
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
        if (btnLogin) btnLogin.style.display = "inline-block";
        if (btnCadastro) btnCadastro.style.display = "inline-block";
        if (dropdownUsuario) dropdownUsuario.style.display = "none";

        const linkMeuPainel = document.getElementById("linkMeuPainel");
        if (linkMeuPainel) linkMeuPainel.parentElement.remove();
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

    // 4. MENU RESPONSIVO MOBILE E EFEITOS DE SCROLL
    const btnMobile = document.getElementById("btnMobile");

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

    // 5. CARREGAMENTO DOS CARDS NA HOME
    const containerHome = document.getElementById("cardsVeiculos");
    if (containerHome) carregarVeiculosHome(containerHome);
});

async function carregarVeiculosHome(container) {
    try {
        const resposta = await fetch("/api/veiculos");
        if (!resposta.ok) throw new Error(`Erro: ${resposta.status}`);

        const dados = await resposta.json();

        if (dados.sucesso && Array.isArray(dados.veiculos) && dados.veiculos.length > 0) {
            container.innerHTML = "";
            dados.veiculos.slice(0, 6).forEach(veiculo => {
                container.appendChild(criarElementoCard(veiculo));
            });
        } else {
            container.innerHTML = `<p style="color: var(--text-secondary); grid-column: 1/-1; text-align: center; padding: 40px 0;">Nenhum veículo disponível no momento.</p>`;
        }
    } catch (erro) {
        console.error("Erro ao carregar veículos na Home:", erro);
        container.innerHTML = `<p style="color: var(--primary); grid-column: 1/-1; text-align: center; padding: 40px 0;">Erro ao conectar com o banco de dados.</p>`;
    }
}

function criarElementoCard(veiculo) {
    const imagemUrl = veiculo.imagem 
        ? `/uploads/${veiculo.imagem}` 
        : "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=600";

    const marca = veiculo.marca_nome || veiculo.marca || "Veículo";
    const modelo = veiculo.modelo_nome || veiculo.modelo || "";
    const anoFab = veiculo.ano_fabricacao || veiculo.ano || "";
    const anoMod = veiculo.ano_modelo || veiculo.ano || "";
    const km = veiculo.quilometragem ? Number(veiculo.quilometragem).toLocaleString("pt-BR") : "0";
    const preco = veiculo.preco ? Number(veiculo.preco).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00";

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        <div class="img-card">
            <img src="${imagemUrl}" alt="${marca} ${modelo}" loading="lazy">
        </div>
        <h3>${marca} ${modelo}</h3>
        <p class="card-info">${anoFab}/${anoMod} • ${km} km</p>
        <strong>R$ ${preco}</strong>
        <a href="/pages/detalhes.html?id=${veiculo.id}" class="btn-action">Ver Detalhes</a>
    `;
    return card;
}

// Exemplo de checagem do usuário no JS
const usuarioLogado = JSON.parse(localStorage.getItem('usuario')) || null;
const itemAnunciar = document.getElementById('itemAnunciar');

if (usuarioLogado) {
    // Se o tipo/cargo for admin, oculta a opção de anunciar
    if (usuarioLogado.tipo === 'admin' || usuarioLogado.cargo === 'admin') {
        if (itemAnunciar) itemAnunciar.style.display = 'none';
    } else {
        if (itemAnunciar) itemAnunciar.style.display = 'block';
    }
}