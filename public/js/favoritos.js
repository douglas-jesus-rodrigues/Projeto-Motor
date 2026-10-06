"use strict";

/* ==========================================================
   MotorFlex — Meus Favoritos
   Os ids dos favoritos ficam no localStorage ("favoritos_veiculos",
   a mesma chave usada pelas outras páginas) e os dados dos
   veículos vêm de /api/veiculos.

   Segurança: nada vindo do servidor entra na página como HTML
   (só textContent / atributos validados); URLs de imagem são
   validadas; o localStorage é sanitizado antes de usar.
   ========================================================== */
(() => {
    /* ---------- CONFIG ---------- */
    const CHAVE_FAVORITOS = "favoritos_veiculos";
    const CHAVE_ORDEM = "favoritos_ordem";
    const API_VEICULOS = "/api/veiculos";
    const LIMITE_FAVORITOS = 500;
    const TEMPO_REQUISICAO = 15000;
    const TEMPO_DESFAZER = 7000;
    const IMG_PADRAO = "/imagens/sem-foto.jpg";
    const DETALHES = "/pages/detalhes-veiculo.html";
    const PAGINA_INICIO = "/pages/index.html";

    // AJUSTE AQUI: para onde o "Voltar" leva em cada tipo de conta
    const PAINEIS = {
        individual: "/pages/painel-cliente.html",
        empresa:    "/pages/painel-empresa.html",
        admin:      "/pages/painel-admin.html"
    };
    const PAINEL_PADRAO = "/pages/painel-cliente.html";

    const NS_SVG = "http://www.w3.org/2000/svg";

    /* ---------- UTILITÁRIOS ---------- */
    const $ = (id) => document.getElementById(id);
    const brl = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
    const numero = (v) => { const n = Number(v); return v != null && v !== "" && Number.isFinite(n) ? n : null; };
    const normalizar = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const pluralVeiculos = (n) => (n === 1 ? "veículo" : "veículos");

    function el(tag, classe, texto) {
        const e = document.createElement(tag);
        if (classe) e.className = classe;
        if (texto != null) e.textContent = texto;
        return e;
    }
    function icone(nome, extra = "") {
        const svg = document.createElementNS(NS_SVG, "svg");
        svg.setAttribute("class", `ic ${extra}`.trim());
        svg.setAttribute("aria-hidden", "true");
        const uso = document.createElementNS(NS_SVG, "use");
        uso.setAttribute("href", `#i-${nome}`);
        svg.appendChild(uso);
        return svg;
    }
    function debounce(fn, ms) {
        let t = 0;
        return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    }

    // Só aceita imagem https ou do próprio site; bloqueia javascript:, data:, http externo e caminhos com "..".
    function urlImagem(img) {
        if (!img || typeof img !== "string") return IMG_PADRAO;
        const s = img.trim();
        let u;
        try { u = new URL(s, `${location.origin}/uploads/`); } catch { return IMG_PADRAO; }
        if (u.protocol !== "https:" && u.origin !== location.origin) return IMG_PADRAO;
        const relativo = !/^([a-z][a-z0-9+.-]*:|\/)/i.test(s);
        if (relativo && !u.pathname.startsWith("/uploads/")) return IMG_PADRAO;
        return u.href;
    }

    /* ---------- FAVORITOS (localStorage) ---------- */
    // Lê e sanitiza: só números/textos curtos, sem duplicados, com limite. Preserva o tipo original de cada id.
    function lerFavoritos() {
        try {
            const dados = JSON.parse(localStorage.getItem(CHAVE_FAVORITOS));
            if (!Array.isArray(dados)) return [];
            const vistos = new Set(), lista = [];
            for (const x of dados) {
                if (typeof x !== "number" && typeof x !== "string") continue;
                const k = String(x).trim();
                if (!k || k.length > 64 || vistos.has(k)) continue;
                vistos.add(k);
                lista.push(x);
                if (lista.length >= LIMITE_FAVORITOS) break;
            }
            return lista;
        } catch { return []; }
    }
    function salvarFavoritos(lista) {
        try { localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify(lista)); return true; }
        catch { return false; }
    }

    /* ---------- SESSÃO (só para saber para qual painel voltar) ---------- */
    function tipoDaConta() {
        for (const armazenamento of [localStorage, sessionStorage]) {
            for (const chave of ["usuario", "usuario_logado"]) {
                try {
                    const u = JSON.parse(armazenamento.getItem(chave));
                    if (u && typeof u === "object") {
                        const base = u.usuario && typeof u.usuario === "object" ? u.usuario : u;
                        return String(base.tipo || base.cargo || "individual").toLowerCase().trim();
                    }
                } catch { /* sessão ilegível: ignora */ }
            }
        }
        return null;
    }

    /* ---------- DADOS ---------- */
    function statusAnuncio(v) {
        const s = String(v.status_anuncio || v.status || "");
        if (/vend/i.test(s)) return { cls: "vendido", texto: "Vendido" };
        if (/paus|inativ/i.test(s)) return { cls: "pausado", texto: "Pausado" };
        return null;
    }

    function normalizarVeiculo(v) {
        const marca = String(v.marca_nome || v.marca || "").trim();
        const modelo = String(v.modelo_nome || v.modelo || "").trim();
        const versao = String(v.versao || "").trim();
        const anoFab = numero(v.ano_fabricacao), anoMod = numero(v.ano_modelo);
        return {
            id: String(v.id), marca, modelo, versao, anoFab, anoMod,
            km: numero(v.quilometragem), preco: numero(v.preco),
            imagem: urlImagem(v.imagem), status: statusAnuncio(v),
            texto: normalizar(`${marca} ${modelo} ${versao} ${anoMod ?? ""}`)
        };
    }

    async function buscarVeiculos() {
        const controle = new AbortController();
        const relogio = setTimeout(() => controle.abort(), TEMPO_REQUISICAO);
        try {
            const token = localStorage.getItem("token") || sessionStorage.getItem("token");
            const resp = await fetch(API_VEICULOS, {
                headers: { Accept: "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
                credentials: "same-origin",
                signal: controle.signal
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const dados = await resp.json();
            if (dados && dados.sucesso === false) throw new Error(dados.mensagem || "Erro no servidor");
            const lista = Array.isArray(dados) ? dados : dados && dados.veiculos;
            if (!Array.isArray(lista)) throw new Error("Resposta inválida do servidor");
            return lista;
        } finally {
            clearTimeout(relogio);
        }
    }

    /* ---------- ESTADO ---------- */
    const ORDENS = {
        recentes: (a, b) => b.pos - a.pos,
        menor: (a, b) => numAsc(a.preco, b.preco),
        maior: (a, b) => numDesc(a.preco, b.preco),
        novos: (a, b) => numDesc(a.anoMod ?? a.anoFab, b.anoMod ?? b.anoFab),
        km: (a, b) => numAsc(a.km, b.km),
        nome: (a, b) => `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`, "pt-BR")
    };
    function numAsc(x, y) { return x === y ? 0 : x == null ? 1 : y == null ? -1 : x - y; }     // sem valor vai para o fim
    function numDesc(x, y) { return x === y ? 0 : x == null ? 1 : y == null ? -1 : y - x; }

    const estado = {
        ids: [],                // favoritos (valores originais do localStorage)
        catalogo: new Map(),    // id (texto) -> veículo normalizado
        lista: [],              // favoritos que existem no sistema (com "pos" = ordem em que foram salvos)
        ausentes: [],           // favoritos que não existem mais
        erro: false,
        busca: "", marca: "", ordem: "recentes"
    };

    /* ---------- ELEMENTOS ---------- */
    const grid = $("gridFavoritos"), toolbar = $("toolbar"), resultado = $("resultado");
    const inputBusca = $("busca"), selMarca = $("filtroMarca"), selOrdem = $("ordem");
    const btnLimparFiltros = $("btnLimparFiltros"), btnLimparTudo = $("btnLimparTudo");
    const aviso = $("aviso"), stats = $("stats");

    /* ---------- AVISOS E CONFIRMAÇÃO ---------- */
    let toastTimer = 0;
    function toast(msg, tipo = "ok", opc = {}) {
        const area = $("toastArea");
        clearTimeout(toastTimer);
        area.replaceChildren();
        const t = el("div", `toast toast--${tipo}`);
        t.append(icone(tipo === "erro" ? "alert" : "check"), el("span", "toast__msg", msg));
        if (opc.acao) {
            const b = el("button", "toast__acao", opc.acao);
            b.type = "button";
            b.addEventListener("click", () => { clearTimeout(toastTimer); area.replaceChildren(); opc.aoClicar(); });
            t.append(b);
        }
        area.append(t);
        requestAnimationFrame(() => t.classList.add("on"));
        toastTimer = setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 300); }, opc.acao ? TEMPO_DESFAZER : 3800);
    }

    const modal = $("modalConfirma");
    let resolverConfirma = null, focoAnterior = null;
    function confirmar({ titulo, texto, botao }) {
        return new Promise((resolve) => {
            if (resolverConfirma) resolverConfirma(false);
            resolverConfirma = resolve;
            focoAnterior = document.activeElement;
            $("confirmaTitulo").textContent = titulo;
            $("confirmaTexto").textContent = texto;
            $("confirmaOk").textContent = botao;
            modal.hidden = false;
            document.body.classList.add("sem-scroll");
            $("confirmaCancelar").focus();
        });
    }
    function responderConfirma(resposta) {
        if (!resolverConfirma) return;
        const resolver = resolverConfirma;
        resolverConfirma = null;
        modal.hidden = true;
        document.body.classList.remove("sem-scroll");
        if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
        resolver(resposta);
    }
    $("confirmaOk").addEventListener("click", () => responderConfirma(true));
    $("confirmaCancelar").addEventListener("click", () => responderConfirma(false));
    modal.addEventListener("click", (e) => { if (e.target === modal) responderConfirma(false); });
    modal.addEventListener("keydown", (e) => {                 // mantém o foco dentro do modal
        if (e.key !== "Tab") return;
        const botoes = [$("confirmaCancelar"), $("confirmaOk")];
        const i = botoes.indexOf(document.activeElement);
        e.preventDefault();
        botoes[(i + (e.shiftKey ? -1 : 1) + botoes.length) % botoes.length].focus();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") responderConfirma(false); });

    /* ---------- RENDER ---------- */
    function cardVeiculo(v, indice) {
        const nome = `${v.marca} ${v.modelo}`.trim() || "Veículo";
        const art = el("article", "card");
        art.dataset.id = v.id;
        art.style.animationDelay = `${Math.min(indice, 12) * 30}ms`;
        if (v.status) art.classList.add(`card--${v.status.cls}`);
        const href = `${DETALHES}?id=${encodeURIComponent(v.id)}`;

        // foto
        const foto = el("a", "card__foto");
        foto.href = href; foto.tabIndex = -1; foto.setAttribute("aria-hidden", "true");
        const img = new Image();
        img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.referrerPolicy = "no-referrer";
        img.addEventListener("error", () => {
            if (img.dataset.fb) { img.remove(); foto.classList.add("card__foto--vazia"); foto.prepend(icone("car")); return; }
            img.dataset.fb = "1"; img.src = IMG_PADRAO;
        });
        img.src = v.imagem;
        foto.append(img);
        const ano = v.anoFab && v.anoMod && v.anoFab !== v.anoMod ? `${v.anoFab}/${v.anoMod}` : String(v.anoMod ?? v.anoFab ?? "");
        if (ano) foto.append(el("span", "card__ano", ano));
        if (v.status) foto.append(el("span", "card__status", v.status.texto));

        // botão de remover
        const fav = el("button", "card__fav");
        fav.type = "button"; fav.dataset.acao = "remover"; fav.dataset.id = v.id;
        fav.title = "Remover dos favoritos";
        fav.setAttribute("aria-label", `Remover ${nome} dos favoritos`);
        fav.append(icone("heart", "ic--fill"));

        // corpo
        const corpo = el("div", "card__corpo");
        if (v.marca) corpo.append(el("span", "card__marca", v.marca));
        corpo.append(el("h3", "card__titulo", v.modelo || nome), el("p", "card__versao", v.versao));
        const specs = el("ul", "card__specs");
        const spec = (nomeIcone, texto) => { const li = el("li"); li.append(icone(nomeIcone), el("span", "", texto)); specs.append(li); };
        if (ano) spec("calendar", ano);
        spec("gauge", v.km != null ? `${v.km.toLocaleString("pt-BR")} km` : "km não informado");
        corpo.append(specs);

        const rodape = el("div", "card__rodape");
        const preco = el("div", "card__preco");
        preco.append(el("small", "", "Valor"), el("strong", "", v.preco != null && v.preco > 0 ? brl(v.preco) : "Sob consulta"));
        const ver = el("a", "card__ver", "Ver detalhes");
        ver.href = href; ver.setAttribute("aria-label", `Ver detalhes de ${nome}`);
        ver.append(icone("arrow-right"));
        rodape.append(preco, ver);
        corpo.append(rodape);

        art.append(foto, fav, corpo);
        return art;
    }

    function desenhar(lista) {
        const frag = document.createDocumentFragment();
        lista.forEach((v, i) => frag.append(cardVeiculo(v, i)));
        grid.replaceChildren(frag);
        grid.setAttribute("aria-busy", "false");
    }

    function mostrarEstado({ icone: nomeIcone, titulo, texto, acoes = [] }) {
        const box = el("div", "estado");
        const ic = el("div", "estado__icone"); ic.append(icone(nomeIcone));
        box.append(ic, el("h3", "", titulo), el("p", "", texto));
        if (acoes.length) {
            const linha = el("div", "estado__acoes");
            for (const a of acoes) {
                const item = a.href ? el("a", `btn ${a.primario ? "btn--primario" : "btn--ghost"}`, a.texto) : el("button", `btn ${a.primario ? "btn--primario" : "btn--ghost"}`, a.texto);
                if (a.href) item.href = a.href; else { item.type = "button"; item.addEventListener("click", a.aoClicar); }
                linha.append(item);
            }
            box.append(linha);
        }
        grid.replaceChildren(box);
        grid.setAttribute("aria-busy", "false");
    }

    function mostrarSkeleton(n) {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < Math.min(Math.max(n, 3), 6); i++) {
            const c = el("div", "card card--skel");
            c.append(el("div", "skel skel--foto"), el("div", "skel skel--linha skel--curta"), el("div", "skel skel--linha"), el("div", "skel skel--linha skel--curta"));
            frag.append(c);
        }
        grid.replaceChildren(frag);
        grid.setAttribute("aria-busy", "true");
        toolbar.hidden = true; stats.hidden = true; aviso.hidden = true;
        resultado.textContent = "Carregando seus favoritos…";
    }

    function atualizarStats() {
        const precos = estado.lista.map((v) => v.preco).filter((p) => p != null && p > 0);
        $("statTotal").textContent = String(estado.lista.length);
        $("statTotalLabel").textContent = pluralVeiculos(estado.lista.length);
        $("statMin").textContent = precos.length ? brl(Math.min(...precos)) : "—";
        $("statMedia").textContent = precos.length ? brl(precos.reduce((a, b) => a + b, 0) / precos.length) : "—";
        stats.hidden = !estado.lista.length;
        document.title = `${estado.lista.length ? `Meus Favoritos (${estado.lista.length})` : "Meus Favoritos"} | MotorFlex`;
    }

    function atualizarAviso() {
        const n = estado.ausentes.length;
        aviso.hidden = !(n && estado.lista.length && !estado.erro);
        if (!aviso.hidden) $("avisoTexto").textContent = `${n} ${n === 1 ? "veículo favoritado não está mais disponível" : "veículos favoritados não estão mais disponíveis"} (vendido ou removido do sistema).`;
    }

    function atualizarMarcas() {
        const marcas = [...new Set(estado.lista.map((v) => v.marca).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        if (!marcas.includes(estado.marca)) estado.marca = "";
        const opcoes = [new Option("Todas as marcas", "")];
        marcas.forEach((m) => opcoes.push(new Option(m, m)));       // Option usa texto puro
        selMarca.replaceChildren(...opcoes);
        selMarca.value = estado.marca;
    }

    const filtrosAtivos = () => Boolean(estado.busca || estado.marca);

    function atualizarVista() {
        const q = normalizar(estado.busca);
        const filtrada = estado.lista
            .filter((v) => (!estado.marca || v.marca === estado.marca) && (!q || v.texto.includes(q)))
            .sort(ORDENS[estado.ordem] || ORDENS.recentes);
        btnLimparFiltros.hidden = !filtrosAtivos();

        if (!filtrada.length) {
            resultado.textContent = "Nenhum veículo encontrado.";
            mostrarEstado({
                icone: "search", titulo: "Nada encontrado",
                texto: "Nenhum favorito corresponde à sua busca ou ao filtro escolhido.",
                acoes: [{ texto: "Limpar filtros", primario: true, aoClicar: limparFiltros }]
            });
            return;
        }
        resultado.textContent = filtrada.length === estado.lista.length
            ? `${filtrada.length} ${pluralVeiculos(filtrada.length)} nos seus favoritos`
            : `Mostrando ${filtrada.length} de ${estado.lista.length} ${pluralVeiculos(estado.lista.length)}`;
        desenhar(filtrada);
    }

    function renderizar() {
        atualizarStats();
        atualizarAviso();

        if (estado.erro && !estado.catalogo.size) {
            toolbar.hidden = true; resultado.textContent = "";
            return mostrarEstado({
                icone: "alert", titulo: "Não foi possível carregar",
                texto: "Houve um problema de conexão ao buscar seus favoritos. Tente novamente.",
                acoes: [{ texto: "Tentar novamente", primario: true, aoClicar: carregar }]
            });
        }
        if (!estado.ids.length) {
            toolbar.hidden = true; resultado.textContent = "";
            return mostrarEstado({
                icone: "heart", titulo: "Nenhum favorito ainda",
                texto: "Toque no coração de um veículo no catálogo para salvá-lo aqui e acompanhar depois.",
                acoes: [{ texto: "Explorar catálogo", href: "/pages/catalogo.html", primario: true }]
            });
        }
        if (!estado.lista.length) {
            toolbar.hidden = true; resultado.textContent = "";
            return mostrarEstado({
                icone: "car", titulo: "Veículos indisponíveis",
                texto: "Os veículos que você favoritou não estão mais disponíveis no sistema.",
                acoes: [
                    { texto: "Limpar lista", primario: true, aoClicar: () => removerVarios(new Set(estado.ausentes.map(String)), "Lista atualizada.") },
                    { texto: "Ver catálogo", href: "/pages/catalogo.html" }
                ]
            });
        }
        toolbar.hidden = false;
        atualizarMarcas();
        atualizarVista();
    }

    /* ---------- AÇÕES ---------- */
    function recalcular() {
        estado.lista = []; estado.ausentes = [];
        estado.ids.forEach((id, pos) => {
            const v = estado.catalogo.get(String(id));
            if (v) estado.lista.push({ ...v, pos }); else estado.ausentes.push(id);
        });
    }

    async function carregar() {
        estado.ids = lerFavoritos();
        if (!estado.ids.length) { estado.catalogo = new Map(); estado.erro = false; recalcular(); return renderizar(); }
        mostrarSkeleton(estado.ids.length);
        try {
            const veiculos = await buscarVeiculos();
            const mapa = new Map();
            for (const v of veiculos) if (v && v.id != null) mapa.set(String(v.id), normalizarVeiculo(v));
            estado.catalogo = mapa;
            estado.erro = false;
        } catch (erro) {
            console.error("Erro ao carregar favoritos:", erro);
            estado.erro = true;
        }
        recalcular();
        renderizar();
    }

    // Remove vários ids de uma vez (um, os indisponíveis ou todos) e oferece "Desfazer".
    function removerVarios(idsTexto, mensagem, focoIndice = -1) {
        const antes = lerFavoritos();
        const removidos = [];
        const depois = antes.filter((x, i) => {
            if (!idsTexto.has(String(x))) return true;
            removidos.push({ valor: x, indice: i });
            return false;
        });
        if (!removidos.length) return;
        if (!salvarFavoritos(depois)) return toast("Não foi possível atualizar seus favoritos.", "erro");

        estado.ids = depois;
        recalcular();
        renderizar();
        if (focoIndice >= 0) {
            const botoes = grid.querySelectorAll(".card__fav");
            (botoes[Math.min(focoIndice, botoes.length - 1)] || inputBusca).focus();
        }
        toast(mensagem, "ok", { acao: "Desfazer", aoClicar: () => restaurar(removidos) });
    }

    function restaurar(itens) {
        const atual = lerFavoritos();
        for (const { valor, indice } of [...itens].sort((a, b) => a.indice - b.indice)) {
            if (!atual.some((x) => String(x) === String(valor))) atual.splice(Math.min(indice, atual.length), 0, valor);
        }
        if (!salvarFavoritos(atual)) return toast("Não foi possível restaurar.", "erro");
        estado.ids = atual;
        recalcular();
        renderizar();
        toast("Favorito restaurado.");
    }

    function removerUm(id) {
        const v = estado.catalogo.get(String(id));
        const nome = v ? `${v.marca} ${v.modelo}`.trim() : "Veículo";
        const cards = [...grid.querySelectorAll(".card")];
        const indice = cards.findIndex((c) => c.dataset.id === String(id));
        removerVarios(new Set([String(id)]), `${nome} removido dos favoritos.`, indice);
    }

    function limparFiltros() {
        estado.busca = ""; estado.marca = "";
        inputBusca.value = ""; selMarca.value = "";
        atualizarVista();
    }

    /* ---------- EVENTOS ---------- */
    grid.addEventListener("click", (e) => {
        const bt = e.target.closest('[data-acao="remover"]');
        if (bt) removerUm(bt.dataset.id);
    });
    inputBusca.addEventListener("input", debounce(() => { estado.busca = inputBusca.value.slice(0, 60); atualizarVista(); }, 120));
    selMarca.addEventListener("change", () => { estado.marca = selMarca.value; atualizarVista(); });
    selOrdem.addEventListener("change", () => {
        estado.ordem = Object.prototype.hasOwnProperty.call(ORDENS, selOrdem.value) ? selOrdem.value : "recentes";
        try { localStorage.setItem(CHAVE_ORDEM, estado.ordem); } catch { /* ignora */ }
        atualizarVista();
    });
    btnLimparFiltros.addEventListener("click", limparFiltros);
    btnLimparTudo.addEventListener("click", async () => {
        const total = estado.ids.length;
        if (!total) return;
        const ok = await confirmar({
            titulo: "Limpar favoritos?",
            texto: `Todos os ${total} ${total === 1 ? "favorito será removido" : "favoritos serão removidos"} da sua lista. Você poderá desfazer logo em seguida.`,
            botao: "Sim, limpar"
        });
        if (ok) removerVarios(new Set(estado.ids.map(String)), "Lista de favoritos limpa.");
    });
    $("btnLimparIndisponiveis").addEventListener("click", () => removerVarios(new Set(estado.ausentes.map(String)), "Indisponíveis removidos."));

    // Mantém tudo em dia: outra aba mudou os favoritos, ou voltou pelo botão "voltar" do navegador
    window.addEventListener("storage", (e) => { if (e.key === CHAVE_FAVORITOS || e.key === null) carregar(); });
    window.addEventListener("pageshow", (e) => { if (e.persisted) carregar(); });

    /* ---------- INIT ---------- */
    function iniciar() {
        // "Voltar" leva ao painel certo de cada tipo de conta
        const tipo = tipoDaConta();
        const voltar = $("voltar");
        if (tipo) voltar.href = PAINEIS[tipo] || PAINEL_PADRAO;
        else { voltar.href = PAGINA_INICIO; $("voltarTexto").textContent = "Início"; }

        // ordenação lembrada (validada contra a lista de ordens permitidas)
        try {
            const salva = localStorage.getItem(CHAVE_ORDEM);
            if (salva && Object.prototype.hasOwnProperty.call(ORDENS, salva)) estado.ordem = salva;
        } catch { /* ignora */ }
        selOrdem.value = estado.ordem;

        carregar();
    }
    iniciar();
})();