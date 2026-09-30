document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 1. NAVEGAÇÃO SPA (Single Page Application)
    // ==========================================
    const linksSpa = document.querySelectorAll(".nav-link[data-target]");
    const secoes = document.querySelectorAll(".page-section");
    const menuNavegacao = document.getElementById("menuNavegacao");
    const btnMobile = document.getElementById("btnMobile");

    function alternarSecao(targetId, rolarAoTopo = true) {
        secoes.forEach(sec => sec.classList.remove("active"));
        const secaoAlvo = document.getElementById(`sec-${targetId}`);
        if (secaoAlvo) secaoAlvo.classList.add("active");

        linksSpa.forEach(link => link.classList.toggle("active", link.dataset.target === targetId));
        if (rolarAoTopo) window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function secaoDaUrl() {
        const hash = window.location.hash.replace("#", "") || "home";
        return document.getElementById(`sec-${hash}`) ? hash : "home";
    }

    linksSpa.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetId = link.dataset.target;
            alternarSecao(targetId);
            window.location.hash = targetId;

            if (menuNavegacao && menuNavegacao.classList.contains("active")) {
                menuNavegacao.classList.remove("active");
                if (btnMobile) btnMobile.classList.remove("active");
            }
        });
    });

    window.addEventListener("hashchange", () => alternarSecao(secaoDaUrl()));
    alternarSecao(secaoDaUrl(), false);

    // ==========================================
    // UTILITÁRIOS GERAIS
    // ==========================================
    const IMAGEM_SEM_FOTO = "/imagens/sem-foto.jpg";

    function escapeHTML(str) {
        return String(str ?? "").replace(/[&<>'"]/g,
            tag => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[tag] || tag)
        );
    }

    // minúsculas e sem acentos (para busca tolerante: "tesla" acha "Tésla")
    function normalizarTexto(str) {
        return String(str ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }

    function formatarPreco(valor) {
        const n = Number(valor);
        if (!isFinite(n)) return "Consulte";
        return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
    }

    function formatarKm(km) {
        const n = Number(km);
        if (!isFinite(n)) return "";
        return n === 0 ? "0 km" : `${n.toLocaleString("pt-BR")} km`;
    }

    function normalizarUrlFoto(valor) {
        if (typeof valor !== "string") return null;

        let src = valor.trim();
        if (!src) return null;

        const invalidos = ["null", "undefined", "false", "0", "nan"];
        if (invalidos.includes(src.toLowerCase())) return null;

        if (/^(data:image\/|blob:)/i.test(src)) return src;
        if (/^(https?:)?\/\//i.test(src)) return src;

        src = src.replace(/\\/g, "/").replace(/^\.\//, "");

        if (src.startsWith("/uploads/")) return src;
        if (src.startsWith("uploads/")) return `/${src}`;
        if (src.startsWith("/")) return src;

        return `/uploads/${encodeURIComponent(src)}`;
    }

    function urlDetalhes(id) {
        return `/pages/detalhes-veiculo.html?id=${encodeURIComponent(id)}`;
    }

    function irParaComTransicao(destino) {
        document.body.classList.add("page-exit");
        setTimeout(() => {
            window.location.href = destino;
        }, 300);
    }

    // ==========================================
    // UTILITÁRIOS DE USUÁRIO (foto, nome da empresa, avatar)
    // ==========================================
    function obterFotoUsuario(usuario) {
        const candidatas = [usuario.fotoUrl, usuario.foto_perfil];
        for (const c of candidatas) {
            const url = normalizarUrlFoto(c);
            if (url) return url;
        }
        return null;
    }

    function obterNomeEmpresa(usuario) {
        const candidatas = [
            usuario.empresa?.nome_empresa,
            usuario.empresa?.nomeEmpresa,
            usuario.nome_empresa,
            usuario.nomeEmpresa,
            typeof usuario.empresa === "string" ? usuario.empresa : null
        ];
        for (const c of candidatas) {
            if (typeof c === "string" && c.trim()) return c.trim();
        }
        return null;
    }

    function aplicarAvatar(avatarImagem, avatarLetra, fotoUrl, nomeExibicao) {
        const mostrarLetra = () => {
            if (avatarImagem) {
                avatarImagem.style.display = "none";
                avatarImagem.removeAttribute("src");
            }
            if (avatarLetra) {
                avatarLetra.textContent = (nomeExibicao || "?").charAt(0).toUpperCase();
                avatarLetra.style.display = "flex";
            }
        };

        if (!avatarImagem || !fotoUrl) {
            mostrarLetra();
            return;
        }

        avatarImagem.onerror = () => {
            console.warn("Avatar não carregou (possível 404):", fotoUrl);
            avatarImagem.onerror = null;
            mostrarLetra();
        };
        avatarImagem.onload = () => {
            avatarImagem.style.display = "block";
            if (avatarLetra) avatarLetra.style.display = "none";
        };

        avatarImagem.src = fotoUrl;
    }

    // ==========================================
    // 2. SESSÃO E PERFIL (nome/foto levam ao painel)
    // ==========================================
    const CHAVES_SESSAO = ["usuario", "usuario_logado"];
    const CLASSES_PERFIL = ["usuario-cliente", "usuario-empresa", "usuario-admin", "usuario-deslogado"];

    function lerUsuarioLogado() {
        const bruto =
            localStorage.getItem("usuario") ||
            localStorage.getItem("usuario_logado") ||
            sessionStorage.getItem("usuario") ||
            sessionStorage.getItem("usuario_logado");

        if (!bruto || bruto === "undefined" || bruto === "null") return null;

        try {
            const obj = JSON.parse(bruto);
            return obj && typeof obj === "object" ? obj : null;
        } catch (e) {
            CHAVES_SESSAO.forEach(k => localStorage.removeItem(k));
            return null;
        }
    }

    function iniciarSessao() {
        const acoesDeslogado = document.getElementById("acoesDeslogado");
        const perfilUsuario = document.getElementById("perfilUsuario");
        const irPainel = document.getElementById("irPainel");
        const nomeUsuario = document.getElementById("nomeUsuario");
        const avatarLetra = document.getElementById("avatarLetra");
        const avatarImagem = document.getElementById("avatarImagem");

        document.body.classList.remove(...CLASSES_PERFIL);

        const usuario = lerUsuarioLogado();

        if (!usuario) {
            if (acoesDeslogado) acoesDeslogado.style.display = "flex";
            if (perfilUsuario) perfilUsuario.style.display = "none";
            document.body.classList.add("usuario-deslogado");
            return;
        }

        if (acoesDeslogado) acoesDeslogado.style.display = "none";
        if (perfilUsuario) perfilUsuario.style.display = "block";

        // Painel (perfil) conforme o tipo de conta
        let rotaPainel = "/pages/painel-cliente.html";
        let tipoPerfilClass = "usuario-cliente";

        if (usuario.tipo === "empresa") {
            rotaPainel = "/pages/painel-empresa.html";
            tipoPerfilClass = "usuario-empresa";
        } else if (["admin", "super_admin"].includes(usuario.tipo) || usuario.cargo === "admin") {
            rotaPainel = "/pages/painel-admin.html";
            tipoPerfilClass = "usuario-admin";
        }

        document.body.classList.add(tipoPerfilClass);
        if (irPainel) irPainel.href = rotaPainel;

        // Conta empresa: sempre o nome da empresa (nunca o nome pessoal do dono)
        let nomeExibicao = "Minha Conta";
        if (usuario.tipo === "empresa") {
            nomeExibicao = obterNomeEmpresa(usuario) || "Minha Empresa";
        } else if (usuario.nome) {
            nomeExibicao = String(usuario.nome).split(" ")[0];
        }

        if (nomeUsuario) nomeUsuario.textContent = nomeExibicao;
        aplicarAvatar(avatarImagem, avatarLetra, obterFotoUsuario(usuario), nomeExibicao);
    }

    iniciarSessao();

    window.addEventListener("storage", (e) => {
        if (e.key === null || CHAVES_SESSAO.includes(e.key)) iniciarSessao();
    });

    // Correção do botão "voltar" (BFCACHE)
    window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
            document.body.classList.remove("page-exit");
            iniciarSessao();
        }
    });

    // ==========================================
    // 3. VEÍCULOS DO BANCO DE DADOS (carrossel + busca + marcas)
    // ==========================================
    let veiculos = [];
    let veiculosCarregados = false;

    const btnBuscarRapido = document.getElementById("btnBuscarRapido");
    const inputBuscaRapida = document.getElementById("inputBuscaRapida");
    const sugestoesBusca = document.getElementById("sugestoesBusca");
    const track = document.getElementById("carsTrack");

    function normalizarVeiculo(v) {
        const marca = String(v.marca_nome || v.marca || "").trim();
        const modelo = String(v.modelo_nome || v.modelo || "").trim();
        const fotoReal = normalizarUrlFoto(v.imagem);

        return {
            id: v.id,
            marca,
            modelo,
            nome: `${marca} ${modelo}`.trim(),
            versao: v.versao ? String(v.versao).trim() : "",
            imagem: fotoReal || IMAGEM_SEM_FOTO,
            temFoto: !!fotoReal,
            preco: Number(v.preco),
            ano: v.ano_modelo || v.ano_fabricacao || "",
            km: v.quilometragem,
            carroceria: v.carroceria ? String(v.carroceria) : "",
            cor: v.cor ? String(v.cor) : "",
            criado: v.criado_em ? (Date.parse(v.criado_em) || 0) : 0
        };
    }

    async function carregarVeiculos() {
        renderizarEsqueletoCarrossel();

        try {
            const resposta = await fetch("/api/veiculos");
            if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
            const dados = await resposta.json();

            const lista = Array.isArray(dados.veiculos) ? dados.veiculos : (Array.isArray(dados) ? dados : []);

            veiculos = lista
                .filter(v => v && v.id != null)
                // se a API informar o status do anúncio, mostra só os ativos (id 1)
                .filter(v => v.status_anuncio_id == null || Number(v.status_anuncio_id) === 1)
                .map(normalizarVeiculo)
                .filter(v => v.nome);
        } catch (erro) {
            console.log("Não foi possível carregar os veículos:", erro.message);
            veiculos = [];
        }

        veiculosCarregados = true;
        renderizarCarrossel();
        renderizarMarcasRapidas();
        atualizarBadgeHero();

        // se o usuário já estava digitando, atualiza as sugestões
        if (inputBuscaRapida && document.activeElement === inputBuscaRapida) atualizarSugestoes();
    }

    // ---------- Badge do hero ----------
    function atualizarBadgeHero() {
        const badge = document.getElementById("heroBadge");
        const texto = document.getElementById("heroBadgeTexto");
        if (!badge || !texto || veiculos.length === 0) return;

        texto.textContent = veiculos.length === 1
            ? "1 veículo disponível agora"
            : `${veiculos.length} veículos disponíveis agora`;
        badge.hidden = false;
    }

    // ---------- Marcas populares ----------
    function renderizarMarcasRapidas() {
        const box = document.getElementById("marcasRapidas");
        if (!box || veiculos.length === 0) return;

        const contagem = new Map();
        veiculos.forEach(v => {
            if (v.marca) contagem.set(v.marca, (contagem.get(v.marca) || 0) + 1);
        });

        const top = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m]) => m);
        if (top.length === 0) return;

        box.innerHTML = `<span>Populares:</span>` + top.map(m =>
            `<a class="chip-marca" href="/pages/catalogo.html?busca=${encodeURIComponent(m)}">${escapeHTML(m)}</a>`
        ).join("");
        box.hidden = false;
    }

    // ---------- Carrossel de destaques ----------
    function renderizarEsqueletoCarrossel() {
        if (!track) return;
        track.className = "cars-track carregando";
        track.innerHTML = Array.from({ length: 6 }, () => `
            <div class="car-card skeleton" aria-hidden="true">
                <div class="car-imagem"></div>
                <div class="car-info">
                    <div class="linha"></div>
                    <div class="linha curta"></div>
                </div>
            </div>
        `).join("");
    }

    function cardCarroHTML(v) {
        const km = formatarKm(v.km);

        return `
            <a href="${urlDetalhes(v.id)}" class="car-card" title="Ver detalhes de ${escapeHTML(v.nome)}">
                <div class="car-imagem">
                    ${v.ano ? `<span class="car-tag">${escapeHTML(v.ano)}</span>` : ""}
                    <img src="${escapeHTML(v.imagem)}" alt="${escapeHTML(v.nome)}" loading="lazy"
                         onerror="this.onerror=null;this.src='${IMAGEM_SEM_FOTO}'">
                </div>
                <div class="car-info">
                    <h3 class="car-nome">${escapeHTML(v.nome)}</h3>
                    <p class="car-versao">${escapeHTML(v.versao)}</p>
                    <div class="car-rodape">
                        <div>
                            <div class="car-preco">${escapeHTML(formatarPreco(v.preco))}</div>
                            ${km ? `<div class="car-km">${escapeHTML(km)}</div>` : ""}
                        </div>
                        <span class="car-ver"><i class="fa-solid fa-arrow-right"></i></span>
                    </div>
                </div>
            </a>
        `;
    }

    function renderizarCarrossel() {
        if (!track) return;

        if (veiculos.length === 0) {
            track.className = "cars-track parado";
            track.innerHTML = `<p class="carrossel-vazio">Nenhum veículo anunciado no momento. Volte em breve!</p>`;
            return;
        }

        // Destaques = anúncios mais recentes (com foto primeiro)
        const destaques = [...veiculos]
            .sort((a, b) =>
                (Number(b.temFoto) - Number(a.temFoto)) ||
                (b.criado - a.criado) ||
                (Number(b.id) - Number(a.id)))
            .slice(0, 10);

        // Garante largura suficiente para o loop ficar contínuo em telas grandes
        let base = destaques;
        while (base.length < 6) base = base.concat(destaques);

        const html = base.map(cardCarroHTML).join("");

        // Lista duplicada para o loop infinito (a animação anda -50%)
        track.className = "cars-track";
        track.innerHTML = html + html;
        track.style.setProperty("--duracao", `${base.length * 5}s`);
    }

    // ==========================================
    // 4. BUSCA RÁPIDA (sugestões do banco -> detalhes do veículo)
    // ==========================================
    let itemAtivo = -1;

    function executarBusca() {
        if (!inputBuscaRapida) return;
        const termo = inputBuscaRapida.value.trim();
        irParaComTransicao(
            termo ? `/pages/catalogo.html?busca=${encodeURIComponent(termo)}` : "/pages/catalogo.html"
        );
    }

    // Marca os trechos digitados dentro do texto (ignorando acentos)
    function destacarTexto(texto, termos) {
        const original = String(texto ?? "");
        const norm = normalizarTexto(original);
        if (!termos.length || norm.length !== original.length) return escapeHTML(original);

        const marcados = new Array(original.length).fill(false);
        termos.forEach(t => {
            let i = norm.indexOf(t);
            while (i !== -1) {
                for (let k = i; k < i + t.length; k++) marcados[k] = true;
                i = norm.indexOf(t, i + t.length);
            }
        });

        let html = "";
        let buffer = "";
        let aberto = false;
        const fechar = () => {
            html += aberto ? `<mark>${escapeHTML(buffer)}</mark>` : escapeHTML(buffer);
            buffer = "";
        };

        for (let i = 0; i < original.length; i++) {
            if (marcados[i] !== aberto) {
                fechar();
                aberto = marcados[i];
            }
            buffer += original[i];
        }
        fechar();
        return html;
    }

    // Todos os termos digitados precisam existir em marca/modelo/versão/carroceria/cor/ano
    function buscarVeiculos(texto) {
        const termos = normalizarTexto(texto).split(/\s+/).filter(Boolean);
        if (termos.length === 0) return { termos, itens: [], total: 0 };

        const consulta = termos.join(" ");
        const achados = [];

        for (const v of veiculos) {
            const nome = normalizarTexto(v.nome);
            const palheiro = `${nome} ${normalizarTexto(v.versao)} ${normalizarTexto(v.carroceria)} ${normalizarTexto(v.cor)} ${v.ano}`;
            if (!termos.every(t => palheiro.includes(t))) continue;

            let pontos = 1;
            if (nome.startsWith(consulta)) pontos = 4;
            else if (nome.includes(consulta)) pontos = 3;
            else if (termos.every(t => nome.includes(t))) pontos = 2;

            achados.push({ v, pontos });
        }

        achados.sort((a, b) => b.pontos - a.pontos);
        return { termos, itens: achados.slice(0, 6).map(a => a.v), total: achados.length };
    }

    function mostrarSugestoes(visivel) {
        if (!sugestoesBusca) return;
        sugestoesBusca.hidden = !visivel;
        inputBuscaRapida?.setAttribute("aria-expanded", String(visivel));
        if (!visivel) itemAtivo = -1;
    }

    function atualizarSugestoes() {
        if (!sugestoesBusca || !inputBuscaRapida) return;

        const texto = inputBuscaRapida.value.trim();
        itemAtivo = -1;

        if (texto.length < 2) {
            mostrarSugestoes(false);
            return;
        }

        if (!veiculosCarregados) {
            sugestoesBusca.innerHTML = `<li class="sugestao-carregando"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando veículos...</li>`;
            mostrarSugestoes(true);
            return;
        }

        const { termos, itens, total } = buscarVeiculos(texto);

        if (itens.length === 0) {
            sugestoesBusca.innerHTML = `
                <li class="sugestao-vazio">Nenhum veículo encontrado para “${escapeHTML(texto)}”.</li>
                <li><a class="sugestao-rodape" href="/pages/catalogo.html?busca=${encodeURIComponent(texto)}">
                    Buscar no catálogo <i class="fa-solid fa-arrow-right"></i>
                </a></li>`;
            mostrarSugestoes(true);
            return;
        }

        const linhas = itens.map(v => {
            const sub = [v.versao, v.ano, formatarKm(v.km)].filter(Boolean).join(" • ");
            return `
                <li role="option">
                    <a class="sugestao-item" href="${urlDetalhes(v.id)}">
                        <img src="${escapeHTML(v.imagem)}" alt="" class="sugestao-img"
                             onerror="this.onerror=null;this.src='${IMAGEM_SEM_FOTO}'">
                        <div class="sugestao-texto">
                            <div class="sugestao-nome">${destacarTexto(v.nome, termos)}</div>
                            <div class="sugestao-sub">${destacarTexto(sub, termos)}</div>
                        </div>
                        <span class="sugestao-preco">${escapeHTML(formatarPreco(v.preco))}</span>
                    </a>
                </li>`;
        }).join("");

        const rotuloRodape = total > itens.length
            ? `Ver todos os ${total} resultados no catálogo`
            : "Ver no catálogo";

        sugestoesBusca.innerHTML = linhas + `
            <li><a class="sugestao-rodape" href="/pages/catalogo.html?busca=${encodeURIComponent(texto)}">
                ${rotuloRodape} <i class="fa-solid fa-arrow-right"></i>
            </a></li>`;

        mostrarSugestoes(true);
    }

    function moverSelecao(direcao) {
        if (!sugestoesBusca || sugestoesBusca.hidden) return;
        const itens = [...sugestoesBusca.querySelectorAll(".sugestao-item, .sugestao-rodape")];
        if (itens.length === 0) return;

        itemAtivo = (itemAtivo + direcao + itens.length) % itens.length;
        itens.forEach((el, i) => el.classList.toggle("ativo", i === itemAtivo));
        itens[itemAtivo].scrollIntoView({ block: "nearest" });
    }

    btnBuscarRapido?.addEventListener("click", executarBusca);

    let debounceBusca;
inputBuscaRapida?.addEventListener("input", () => {
    clearTimeout(debounceBusca);
    debounceBusca = setTimeout(atualizarSugestoes, 120);
});
    inputBuscaRapida?.addEventListener("focus", () => {
        if (inputBuscaRapida.value.trim().length >= 2) atualizarSugestoes();
    });

    inputBuscaRapida?.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            moverSelecao(1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            moverSelecao(-1);
        } else if (e.key === "Escape") {
            mostrarSugestoes(false);
        } else if (e.key === "Enter") {
            e.preventDefault();
            const ativo = sugestoesBusca?.querySelector(".ativo");
            if (ativo) {
                ativo.click(); // vai para o detalhes do veículo escolhido (ou catálogo)
            } else {
                mostrarSugestoes(false);
                executarBusca();
            }
        }
    });

    document.addEventListener("click", (e) => {
        if (inputBuscaRapida && sugestoesBusca &&
            !inputBuscaRapida.contains(e.target) && !sugestoesBusca.contains(e.target)) {
            mostrarSugestoes(false);
        }
    });

    // ==========================================
    // 5. MENU MOBILE E CABEÇALHO DINÂMICO (SCROLL)
    // ==========================================
    const header = document.querySelector("header");

    btnMobile?.addEventListener("click", () => {
        menuNavegacao?.classList.toggle("active");
        btnMobile.classList.toggle("active");
    });

    let headerRolado = false;
window.addEventListener("scroll", () => {
    const rolado = window.scrollY > 50;
    if (rolado === headerRolado) return;
    headerRolado = rolado;
    header?.classList.toggle("rolado", rolado);
}, { passive: true });

    // ==========================================
    // 6. ANIMAÇÃO DE FUMAÇA NO BOTÃO DO CATÁLOGO
    // ==========================================
    const btnVerCatalogo = document.getElementById("btnVerCatalogo");
    btnVerCatalogo?.addEventListener("click", (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        for (let i = 0; i < 16; i++) {
            const p = document.createElement("div");
            p.className = "smoke-particle";
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * 140 + 50;
            p.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;width:${Math.random() * 70 + 40}px;height:${Math.random() * 70 + 40}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - Math.random() * 60}px;--scale:${(Math.random() * 1.6 + 1.8).toFixed(2)}`;
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 1200);
        }
    });

    // ==========================================
    // 7. TRANSIÇÃO ENTRE PÁGINAS (FADE OUT)
    // Delegação de evento: funciona também para os cards e sugestões criados pelo JS
    // ==========================================
    document.addEventListener("click", (e) => {
        if (e.defaultPrevented) return; // já tratado (ex.: links da SPA)

        const link = e.target.closest("a[href]");
        if (!link) return;

        const href = link.getAttribute("href");
        const alvo = link.getAttribute("target");

        if (link.dataset.target) return;
        if (alvo === "_blank") return;
        if (link.hasAttribute("download")) return;
        if (!href || href.startsWith("#")) return;
        if (/^(javascript:|mailto:|tel:)/i.test(href)) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;

        e.preventDefault();
        irParaComTransicao(href);
    });

    // ==========================================
    // 8. INICIALIZAÇÃO
    // ==========================================

    const heroBanner = document.querySelector(".hero-banner");
if (track && heroBanner && "IntersectionObserver" in window) {
    new IntersectionObserver(([entrada]) => {
        track.classList.toggle("pausado", !entrada.isIntersecting);
    }).observe(heroBanner);
}

    const anoAtual = document.getElementById("anoAtual");
    if (anoAtual) anoAtual.textContent = new Date().getFullYear();

    carregarVeiculos();
});