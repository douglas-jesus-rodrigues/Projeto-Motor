// =========================================================================
// MOTORFLEX - SISTEMA UNIFICADO DE INTERFACE, ROTAS E BANCO DE DADOS
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. GERENCIAMENTO DE SESSÃO E PERFIL DO USUÁRIO
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    const menuLogado = document.getElementById("menuLogado");
    const menuNaoLogado = document.getElementById("menuNaoLogado");
    const nomeUsuario = document.getElementById("nomeUsuario");
    const irPainel = document.getElementById("irPainel");

    if (usuario) {
        if (menuNaoLogado) menuNaoLogado.style.display = "none";
        if (menuLogado) menuLogado.hidden = false;

        if (nomeUsuario) {
            if (usuario.tipo === "empresa" && usuario.empresa && usuario.empresa.nome_empresa) {
                nomeUsuario.textContent = usuario.empresa.nome_empresa;
            } else if (usuario.nome) {
                nomeUsuario.textContent = usuario.nome.split(" ")[0];
            } else {
                nomeUsuario.textContent = "Minha Conta";
            }
        }
    } else {
        if (menuNaoLogado) menuNaoLogado.style.display = "flex";
        if (menuLogado) menuLogado.hidden = true;
    }

    if (irPainel) {
        irPainel.addEventListener("click", (event) => {
            if (!usuario) return; // Permite o fluxo normal de navegação caso não logado
            event.preventDefault();

            switch (usuario.tipo) {
                case "empresa":
                    window.location.href = "/pages/painel-empresa.html";
                    break;
                case "admin":
                    window.location.href = "/pages/painel-admin.html";
                    break;
                default:
                    window.location.href = "/pages/painel-cliente.html";
                    break;
            }
        });
    }

    // 2. CONTROLE DO DROPDOWN DE CONTA E LOGOUT
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
            window.location.href = "/index.html";
        });
    }

    // 3. MENU RESPONSIVO MOBILE E EFEITOS DE SCROLL
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

    // 4. SISTEMA DE BUSCA RÁPIDA
    const botaoBusca = document.getElementById("btnPesquisar") || document.querySelector(".busca button");

    if (botaoBusca) {
        botaoBusca.addEventListener("click", (e) => {
            e.preventDefault();

            const inputMarca = document.querySelector("input[name='marca']");
            const inputModelo = document.querySelector("input[name='modelo']");
            const inputAno = document.querySelector("input[name='ano']");

            const marca = inputMarca ? inputMarca.value.trim() : "";
            const modelo = inputModelo ? inputModelo.value.trim() : "";
            const ano = inputAno ? inputAno.value.trim() : "";

            const parametros = new URLSearchParams();
            if (marca) parametros.append("marca", marca);
            if (modelo) parametros.append("modelo", modelo);
            if (ano) parametros.append("ano", ano);

            window.location.href = `/pages/catalogo.html?${parametros.toString()}`;
        });
    }

    // 5. CARREGAMENTO DOS CARDS (HOME E CATÁLOGO)
    const containerHome = document.getElementById("cardsVeiculos") || document.querySelector(".destaques .cards");
    const containerCatalogo = document.getElementById("listaCatalogo");

    if (containerHome) carregarVeiculosHome(containerHome);
    if (containerCatalogo) carregarVeiculosCatalogo(containerCatalogo);
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

async function carregarVeiculosCatalogo(container) {
    try {
        const params = new URLSearchParams(window.location.search);
        const marca = params.get("marca") || "";
        const modelo = params.get("modelo") || "";
        const ano = params.get("ano") || "";

        const resposta = await fetch(`/api/veiculos?marca=${encodeURIComponent(marca)}&modelo=${encodeURIComponent(modelo)}&ano=${encodeURIComponent(ano)}`);
        if (!resposta.ok) throw new Error(`Erro: ${resposta.status}`);

        const dados = await resposta.json();

        if (dados.sucesso && Array.isArray(dados.veiculos) && dados.veiculos.length > 0) {
            container.innerHTML = "";
            dados.veiculos.forEach(veiculo => {
                container.appendChild(criarElementoCard(veiculo));
            });
        } else {
            container.innerHTML = `<p style="color: var(--text-secondary); grid-column: 1/-1; text-align: center; padding: 40px 0;">Nenhum veículo encontrado para a sua busca.</p>`;
        }
    } catch (erro) {
        console.error("Erro ao carregar catálogo:", erro);
        container.innerHTML = `<p style="color: var(--primary); grid-column: 1/-1; text-align: center; padding: 40px 0;">Erro ao carregar o catálogo de veículos.</p>`;
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