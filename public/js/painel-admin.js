/* =========================================================================
   MOTORFLEX — PAINEL ADMINISTRATIVO
   Consome GET /api/admin/resumo (adminRoutes.js) e monta todo o dashboard:
   KPIs, gráfico, pendências, tipos de conta e listas recentes.
   ========================================================================= */
   (() => {
    "use strict";

    // ------------------------------------------------------------------
    // Constantes e utilitários
    // ------------------------------------------------------------------
    const CHAVES_SESSAO = ["usuario", "usuario_logado"];
    const CHAVE_TEMA = "mf_admin_tema";
    const CHAVE_AUTO = "mf_admin_auto";
    const INTERVALO_AUTO = 60000;   // 60 s
    const TIMEOUT_REQ = 15000;      // 15 s
    const ROTA_LOGIN = "/pages/login.html";

    const $ = (id) => document.getElementById(id);
    const fmt = new Intl.NumberFormat("pt-BR");
    const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
    const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    const normalizar = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const brl = (v) => {
        const n = Number(v);
        return isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—";
    };

    function tempoRelativo(valor) {
        const t = Date.parse(valor);
        if (!t) return "";
        const s = Math.round((t - Date.now()) / 1000);
        const abs = Math.abs(s);
        if (abs < 60) return "agora";
        if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
        if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
        if (abs < 2592000) return rtf.format(Math.round(s / 86400), "day");
        return new Date(t).toLocaleDateString("pt-BR");
    }

    function normalizarUrlFoto(valor) {
        if (typeof valor !== "string") return null;
        let src = valor.trim();
        if (!src || ["null", "undefined", "false", "0", "nan"].includes(src.toLowerCase())) return null;
        if (/^(data:image\/|blob:|https?:\/\/|\/\/)/i.test(src)) return src;
        src = src.replace(/\\/g, "/").replace(/^\.\//, "");
        if (src.startsWith("/")) return src;
        if (src.startsWith("uploads/")) return `/${src}`;
        return `/uploads/${encodeURIComponent(src)}`;
    }

    function corDoNome(nome) {
        let h = 0;
        for (const ch of String(nome)) h = (h * 31 + ch.charCodeAt(0)) % 360;
        return `hsl(${h} 55% 42%)`;
    }

    const iniciais = (nome) =>
        String(nome || "?").trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join("").toUpperCase() || "?";

    const icone = (id) => `<svg class="i"><use href="#${id}"/></svg>`;

    // ------------------------------------------------------------------
    // Sessão
    // ------------------------------------------------------------------
    function lerUsuario() {
        for (const store of [localStorage, sessionStorage]) {
            for (const chave of CHAVES_SESSAO) {
                const bruto = store.getItem(chave);
                if (!bruto || bruto === "undefined" || bruto === "null") continue;
                try {
                    const obj = JSON.parse(bruto);
                    if (obj && typeof obj === "object") return obj;
                } catch { /* tenta a próxima chave */ }
            }
        }
        return null;
    }

    const ehAdmin = (u) => ["admin", "super_admin"].includes(u?.tipo) || u?.cargo === "admin";
    const rotaDoPerfil = (u) => (u?.tipo === "empresa" ? "/pages/painel-empresa.html" : "/pages/painel-cliente.html");

    function limparSessao() {
        [...CHAVES_SESSAO, "token"].forEach((k) => {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        });
    }

    function pegarToken() {
        return localStorage.getItem("token") || sessionStorage.getItem("token");
    }

    // ------------------------------------------------------------------
    // Toasts
    // ------------------------------------------------------------------
    function toast(mensagem, tipo = "ok") {
        const area = $("toastArea");
        if (!area) return;
        while (area.children.length >= 3) area.firstElementChild.remove();

        const el = document.createElement("div");
        el.className = `toast${tipo === "ok" ? "" : ` ${tipo}`}`;
        el.textContent = mensagem;
        area.appendChild(el);
        requestAnimationFrame(() => el.classList.add("on"));
        setTimeout(() => {
            el.classList.remove("on");
            setTimeout(() => el.remove(), 300);
        }, 3200);
    }

    // ------------------------------------------------------------------
    // Modais (paleta e confirmação de saída)
    // ------------------------------------------------------------------
    const modaisAbertos = [];

    function abrirModal(el) {
        if (!el || el.classList.contains("mostrar-modal")) return;
        el._foco = document.activeElement;
        el.classList.add("mostrar-modal");
        modaisAbertos.push(el);
        document.body.classList.add("travado");
    }

    function fecharModal(el) {
        if (!el || !el.classList.contains("mostrar-modal")) return;
        el.classList.remove("mostrar-modal");
        const i = modaisAbertos.indexOf(el);
        if (i >= 0) modaisAbertos.splice(i, 1);
        if (!modaisAbertos.length) document.body.classList.remove("travado");
        if (el._foco && el._foco.focus) el._foco.focus();
    }

    // ------------------------------------------------------------------
    // Estado
    // ------------------------------------------------------------------
    let carregando = false;
    let temDados = false;
    let ultimaAtualizacao = 0;
    let timerAuto = null;

    // ==================================================================
    // INICIALIZAÇÃO
    // ==================================================================
    function iniciar() {
        const usuario = lerUsuario();

        if (!usuario) {
            window.location.replace(ROTA_LOGIN);
            return;
        }
        if (!ehAdmin(usuario)) {
            window.location.replace(rotaDoPerfil(usuario));
            return;
        }

        montarCabecalho(usuario);
        configurarTema();
        configurarMenuUsuario();
        configurarSaida();
        configurarPaleta();
        configurarAtualizacao();
        configurarEventosGlobais();

        atualizar();
    }

    // ------------------------------------------------------------------
    // Cabeçalho e saudação
    // ------------------------------------------------------------------
    function montarCabecalho(usuario) {
        const nomeCompleto = [usuario.nome, usuario.sobrenome].filter(Boolean).join(" ") || "Administrador";
        const primeiroNome = String(usuario.nome || "Administrador").trim().split(/\s+/)[0];

        const hora = new Date().getHours();
        const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
        const data = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

        if ($("saudacao")) $("saudacao").textContent = `${saudacao} · ${data}`;
        if ($("nomeAdmin")) $("nomeAdmin").innerHTML = `Olá, <span class="nome-destaque">${esc(primeiroNome)}</span>`;
        if ($("miniNome")) $("miniNome").textContent = primeiroNome;
        if ($("ddNome")) $("ddNome").textContent = nomeCompleto;
        if ($("ddEmail")) $("ddEmail").textContent = usuario.email || "";

        // Avatar: foto (se carregar) ou inicial
        const av = $("avatarMini");
        if (av) {
            av.textContent = primeiroNome.charAt(0).toUpperCase();
            const foto = normalizarUrlFoto(usuario.fotoUrl) || normalizarUrlFoto(usuario.foto_perfil);
            if (foto) {
                const img = new Image();
                img.alt = "";
                img.addEventListener("load", () => av.appendChild(img));
                img.src = foto;
            }
        }
    }

    // ------------------------------------------------------------------
    // Tema claro/escuro
    // ------------------------------------------------------------------
    function temaAtual() {
        return document.documentElement.dataset.tema === "claro" ? "claro" : "escuro";
    }

    function aplicarTema(tema) {
        document.documentElement.dataset.tema = tema;
        try { localStorage.setItem(CHAVE_TEMA, tema); } catch { /* modo privado */ }
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", tema === "claro" ? "#f3f5f8" : "#08080a");
    }

    function alternarTema() {
        const novo = temaAtual() === "claro" ? "escuro" : "claro";
        aplicarTema(novo);
        toast(`Tema ${novo} ativado`, "info");
    }

    function configurarTema() {
        aplicarTema(temaAtual());
        $("btnTema")?.addEventListener("click", alternarTema);
    }

    // ------------------------------------------------------------------
    // Menu do usuário
    // ------------------------------------------------------------------
    function configurarMenuUsuario() {
        const btn = $("btnConfig");
        const menu = $("menuConfig");
        if (!btn || !menu) return;

        const alternar = (abrir) => {
            const aberto = abrir ?? !menu.classList.contains("mostrar");
            menu.classList.toggle("mostrar", aberto);
            btn.setAttribute("aria-expanded", String(aberto));
        };

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            alternar();
        });

        document.addEventListener("click", (e) => {
            if (!menu.contains(e.target) && !btn.contains(e.target)) alternar(false);
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && menu.classList.contains("mostrar")) {
                alternar(false);
                btn.focus();
            }
        });

        $("gatilhoSair")?.addEventListener("click", (e) => {
            e.preventDefault();
            alternar(false);
            abrirModal($("modalSairContainer"));
            $("btnCancelarSair")?.focus();
        });
    }

    // ------------------------------------------------------------------
    // Confirmação de saída
    // ------------------------------------------------------------------
    function configurarSaida() {
        const modal = $("modalSairContainer");
        if (!modal) return;

        $("btnCancelarSair")?.addEventListener("click", () => fecharModal(modal));
        modal.addEventListener("mousedown", (e) => { if (e.target === modal) fecharModal(modal); });

        $("btnSair")?.addEventListener("click", () => {
            limparSessao();
            window.location.replace(ROTA_LOGIN);
        });
    }

    // ------------------------------------------------------------------
    // Busca rápida (Ctrl/Cmd + K)
    // ------------------------------------------------------------------
    let paletaItens = [];
    let paletaSel = 0;

    function comandos() {
        const irPara = (url) => () => { window.location.href = url; };
        return [
            { grupo: "Ir para", icone: "i-shield", titulo: "Painel administrativo", dica: "Início", chaves: "inicio dashboard resumo home", acao: irPara("/pages/painel-admin.html") },
            { grupo: "Ir para", icone: "i-users", titulo: "Usuários", dica: "Contas e bloqueios", chaves: "contas clientes empresas bloquear", acao: irPara("/pages/usuarios.html") },
            { grupo: "Ir para", icone: "i-check", titulo: "Moderação", dica: "Anúncios e denúncias", chaves: "anuncios denuncias revisar remover", acao: irPara("/pages/moderacao.html") },
            { grupo: "Ir para", icone: "i-car", titulo: "Catálogo", dica: "Visão do público", chaves: "veiculos carros", acao: irPara("/pages/catalogo.html") },
            { grupo: "Ir para", icone: "i-user", titulo: "Minha conta", dica: "Dados do administrador", chaves: "perfil informacoes", acao: irPara("/pages/perfil.html") },
            { grupo: "Ir para", icone: "i-home", titulo: "Ver o site", dica: "Página inicial", chaves: "index home site publico", acao: irPara("/pages/index.html") },
            { grupo: "Ações", icone: "i-refresh", titulo: "Atualizar dados", dica: "Recarrega o resumo", chaves: "recarregar refresh", acao: () => atualizar(true) },
            { grupo: "Ações", icone: temaAtual() === "claro" ? "i-moon" : "i-sun", titulo: "Alternar tema", dica: "Claro / escuro", chaves: "tema escuro claro dark light", acao: alternarTema },
            { grupo: "Ações", icone: "i-logout", titulo: "Sair", dica: "Encerrar sessão", chaves: "logout deslogar", acao: () => { abrirModal($("modalSairContainer")); $("btnCancelarSair")?.focus(); } }
        ];
    }

    function renderPaleta() {
        const lista = $("paletaLista");
        const valor = $("paletaInput").value;
        const termos = normalizar(valor).split(/\s+/).filter(Boolean);

        paletaItens = comandos().filter((c) =>
            termos.every((t) => normalizar(`${c.titulo} ${c.chaves} ${c.grupo}`).includes(t)));

        if (!paletaItens.length) {
            lista.innerHTML = `<li class="paleta-vazia">Nada encontrado para “${esc(valor)}”</li>`;
            return;
        }

        paletaSel = Math.min(paletaSel, paletaItens.length - 1);

        let html = "";
        let grupoAtual = "";
        paletaItens.forEach((c, i) => {
            if (c.grupo !== grupoAtual) {
                grupoAtual = c.grupo;
                html += `<li class="paleta-grupo" role="presentation">${esc(grupoAtual)}</li>`;
            }
            html += `<li role="option" data-i="${i}" class="${i === paletaSel ? "sel" : ""}" aria-selected="${i === paletaSel}">
                        ${icone(c.icone)}<span>${esc(c.titulo)}</span>${c.dica ? `<small>${esc(c.dica)}</small>` : ""}
                     </li>`;
        });
        lista.innerHTML = html;
    }

    function marcarSelecao(rolar = true) {
        const itens = $("paletaLista").querySelectorAll("li[data-i]");
        itens.forEach((li) => {
            const ativo = Number(li.dataset.i) === paletaSel;
            li.classList.toggle("sel", ativo);
            li.setAttribute("aria-selected", String(ativo));
            if (ativo && rolar) li.scrollIntoView({ block: "nearest" });
        });
    }

    function executarComando(i) {
        const cmd = paletaItens[i];
        if (!cmd) return;
        fecharModal($("paleta"));
        setTimeout(cmd.acao, 60);
    }

    function abrirPaleta() {
        const modal = $("paleta");
        if (!modal) return;
        $("paletaInput").value = "";
        paletaSel = 0;
        renderPaleta();
        abrirModal(modal);
        setTimeout(() => $("paletaInput").focus(), 40);
    }

    function configurarPaleta() {
        const modal = $("paleta");
        const input = $("paletaInput");
        const lista = $("paletaLista");
        if (!modal || !input || !lista) return;

        $("btnPaleta")?.addEventListener("click", abrirPaleta);
        modal.addEventListener("mousedown", (e) => { if (e.target === modal) fecharModal(modal); });

        input.addEventListener("input", () => { paletaSel = 0; renderPaleta(); });

        input.addEventListener("keydown", (e) => {
            if (!paletaItens.length) return;
            if (e.key === "ArrowDown") {
                e.preventDefault();
                paletaSel = (paletaSel + 1) % paletaItens.length;
                marcarSelecao();
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                paletaSel = (paletaSel - 1 + paletaItens.length) % paletaItens.length;
                marcarSelecao();
            } else if (e.key === "Enter") {
                e.preventDefault();
                executarComando(paletaSel);
            }
        });

        lista.addEventListener("mousemove", (e) => {
            const li = e.target.closest("li[data-i]");
            if (li && Number(li.dataset.i) !== paletaSel) {
                paletaSel = Number(li.dataset.i);
                marcarSelecao(false);
            }
        });

        lista.addEventListener("click", (e) => {
            const li = e.target.closest("li[data-i]");
            if (li) executarComando(Number(li.dataset.i));
        });
    }

    // ------------------------------------------------------------------
    // Atualização (botão, automática e por aba visível)
    // ------------------------------------------------------------------
    function configurarAtualizacao() {
        $("btnAtualizar")?.addEventListener("click", () => atualizar(true));
        $("btnTentar")?.addEventListener("click", () => atualizar(true));

        const chk = $("autoAtualizar");
        if (chk) {
            chk.checked = localStorage.getItem(CHAVE_AUTO) === "1";

            const aplicar = () => {
                clearInterval(timerAuto);
                timerAuto = null;
                if (chk.checked) {
                    timerAuto = setInterval(() => { if (!document.hidden) atualizar(); }, INTERVALO_AUTO);
                }
            };

            chk.addEventListener("change", () => {
                try { localStorage.setItem(CHAVE_AUTO, chk.checked ? "1" : "0"); } catch { /* ignore */ }
                aplicar();
                toast(chk.checked ? "Atualização automática ligada (60 s)" : "Atualização automática desligada", "info");
            });

            aplicar();
        }

        // Voltou para a aba e os dados estão velhos: atualiza
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden && $("autoAtualizar")?.checked && Date.now() - ultimaAtualizacao > INTERVALO_AUTO) {
                atualizar();
            }
        });
    }

    // ------------------------------------------------------------------
    // Eventos globais (atalhos, scroll, sessão)
    // ------------------------------------------------------------------
    function configurarEventosGlobais() {
        // Ctrl/Cmd + K abre a busca rápida; Esc fecha o modal do topo
        document.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                const paleta = $("paleta");
                if (paleta?.classList.contains("mostrar-modal")) fecharModal(paleta);
                else abrirPaleta();
            } else if (e.key === "Escape" && modaisAbertos.length) {
                fecharModal(modaisAbertos[modaisAbertos.length - 1]);
            }
        });

        // Sombra na barra superior ao rolar
        const topbar = document.querySelector(".topbar");
        const atualizarTopbar = () => topbar?.classList.toggle("rolou", window.scrollY > 8);
        window.addEventListener("scroll", atualizarTopbar, { passive: true });
        atualizarTopbar();

        // Sessão encerrada/alterada em outra aba
        window.addEventListener("storage", (e) => {
            if (e.key === null || CHAVES_SESSAO.includes(e.key)) {
                const u = lerUsuario();
                if (!u) window.location.replace(ROTA_LOGIN);
                else if (!ehAdmin(u)) window.location.replace(rotaDoPerfil(u));
            }
        });

        // Botão "voltar" do navegador (bfcache): revalida sessão e dados
        window.addEventListener("pageshow", (e) => {
            if (!e.persisted) return;
            if (!lerUsuario()) window.location.replace(ROTA_LOGIN);
            else atualizar();
        });
    }

    // ==================================================================
    // DADOS
    // ==================================================================
    class ErroApi extends Error {
        constructor(mensagem, status = 0) {
            super(mensagem);
            this.status = status;
        }
    }

    async function buscarResumo() {
        const controle = new AbortController();
        const limite = setTimeout(() => controle.abort(), TIMEOUT_REQ);

        try {
            const headers = { Accept: "application/json" };
            const token = pegarToken();
            if (token) headers.Authorization = `Bearer ${token}`;

            const resposta = await fetch("/api/admin/resumo", {
                headers,
                credentials: "same-origin",
                cache: "no-store",
                signal: controle.signal
            });

            let corpo = null;
            try { corpo = await resposta.json(); } catch { /* resposta sem JSON */ }

            if (!resposta.ok || !corpo || corpo.sucesso === false) {
                throw new ErroApi(
                    corpo?.mensagem || `Não foi possível carregar o resumo (HTTP ${resposta.status}).`,
                    resposta.status
                );
            }
            return corpo;

        } catch (erro) {
            if (erro instanceof ErroApi) throw erro;
            if (erro.name === "AbortError") throw new ErroApi("O servidor demorou demais para responder.");
            throw new ErroApi("Sem conexão com o servidor. Verifique sua internet e tente de novo.");
        } finally {
            clearTimeout(limite);
        }
    }

    function indicador(estado, texto) {
        const el = $("atualizadoEm");
        if (!el) return;
        el.textContent = texto;
        el.classList.toggle("carregando", estado === "carregando");
        el.classList.toggle("erro", estado === "erro");
    }

    function mostrarErro(mensagem) {
        const aviso = $("avisoErro");
        if ($("avisoErroTexto")) $("avisoErroTexto").textContent = mensagem;
        if (aviso) aviso.hidden = false;
    }

    const ocultarErro = () => { if ($("avisoErro")) $("avisoErro").hidden = true; };

    function falhaNosPaineis() {
        const msg = `<div class="vazio-lista falha">Não foi possível carregar.</div>`;
        ["grafico", "pendencias", "donut", "listaUsuarios", "listaAnuncios"].forEach((id) => {
            if ($(id)) $(id).innerHTML = msg;
        });
        document.querySelectorAll("[data-kpi]").forEach((el) => { el.textContent = "—"; });
    }

    async function atualizar(manual = false) {
        if (carregando) return;
        carregando = true;

        const btn = $("btnAtualizar");
        if (btn) { btn.disabled = true; btn.classList.add("girando"); }
        indicador("carregando", "Atualizando...");

        try {
            const dados = await buscarResumo();
            ocultarErro();
            renderizar(dados);
            temDados = true;
            ultimaAtualizacao = Date.now();

            const quando = dados.gerado_em ? new Date(dados.gerado_em) : new Date();
            indicador("ok", `Atualizado às ${quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
            if (manual) toast("Dados atualizados");

        } catch (erro) {
            indicador("erro", "Falha ao atualizar");

            if (erro.status === 401) {
                // NÃO apaga a sessão nem redireciona: isso causava um "loop" de login quando
                // o servidor não reconhece a sessão. Só avisa e deixa o usuário decidir.
                mostrarErro("O servidor não reconheceu a sua sessão (401). Se você acabou de entrar, o login do servidor precisa guardar o usuário na sessão (ou enviar o token). Você também pode tentar sair e entrar de novo.");
                if (!temDados) falhaNosPaineis();
            } else if (erro.status === 403) {
                mostrarErro(erro.message && erro.message !== `Não foi possível carregar o resumo (HTTP 403).` ? erro.message + " Se você é administrador, saia e entre novamente." : "Você não tem permissão de administrador para ver estes dados.");
                if (!temDados) falhaNosPaineis();
            } else {
                mostrarErro(erro.message);
                if (!temDados) falhaNosPaineis();
                if (manual) toast("Não foi possível atualizar", "erro");
            }

        } finally {
            carregando = false;
            if (btn) { btn.disabled = false; btn.classList.remove("girando"); }
        }
    }

    // ==================================================================
    // RENDERIZAÇÃO
    // ==================================================================
    function renderizar(d) {
        renderKpis(d);
        renderGrafico(Array.isArray(d.serie) ? d.serie : []);
        renderPendencias(d);
        renderDonut(d.usuarios || {});
        renderUsuarios(d.recentes?.usuarios || []);
        renderAnuncios(d.recentes?.anuncios || []);
    }

    // ---------- KPIs ----------
    function contar(el, alvo) {
        if (!el) return;
        const inicio = Number(el.dataset.valor) || 0;
        el.dataset.valor = String(alvo);
        cancelAnimationFrame(el._raf);

        if (reduzMovimento || inicio === alvo) {
            el.textContent = fmt.format(alvo);
            return;
        }

        const dur = 700;
        const t0 = performance.now();
        const passo = (t) => {
            const p = Math.min(1, (t - t0) / dur);
            const suave = 1 - Math.pow(1 - p, 3);
            el.textContent = fmt.format(Math.round(inicio + (alvo - inicio) * suave));
            if (p < 1) el._raf = requestAnimationFrame(passo);
        };
        el._raf = requestAnimationFrame(passo);
    }

    const subKpi = (n, sufixo) =>
        `<b class="${n > 0 ? "up" : "zero"}">${n > 0 ? "+" : ""}${fmt.format(n)}</b> ${sufixo}`;

    function renderKpis(d) {
        const u = d.usuarios || {};
        const a = d.anuncios || {};

        contar(document.querySelector('[data-kpi="usuarios"]'), Number(u.total) || 0);
        contar(document.querySelector('[data-kpi="anuncios"]'), Number(a.total) || 0);
        contar(document.querySelector('[data-kpi="views"]'), Number(a.visualizacoes) || 0);
        contar(document.querySelector('[data-kpi="conversas"]'), Number(d.conversas?.total) || 0);

        if ($("kpiUsuariosSub")) $("kpiUsuariosSub").innerHTML = subKpi(Number(u.novos_30d) || 0, "nos últimos 30 dias");
        if ($("kpiAnunciosSub")) $("kpiAnunciosSub").innerHTML = subKpi(Number(a.novos_30d) || 0, "nos últimos 30 dias");
    }

    // ---------- Gráfico de barras (SVG) ----------
    function rotuloMes(ym) {
        const [ano, mes] = String(ym).split("-").map(Number);
        const nome = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
        return `${nome}/${String(ano).slice(2)}`;
    }

    function nomeMesLongo(ym) {
        const [ano, mes] = String(ym).split("-").map(Number);
        return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    }

    function passoBonito(x) {
        const potencia = Math.pow(10, Math.floor(Math.log10(x)));
        const f = x / potencia;
        const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
        return Math.max(1, n * potencia);
    }

    function renderGrafico(serie) {
        const alvo = $("grafico");
        if (!alvo) return;

        if (!serie.length) {
            alvo.innerHTML = `<div class="vazio-lista">Sem dados no período.</div>`;
            return;
        }

        const W = 640, H = 270;
        const m = { t: 24, r: 14, b: 34, l: 40 };
        const iw = W - m.l - m.r;
        const ih = H - m.t - m.b;

        const maximo = Math.max(1, ...serie.flatMap((s) => [Number(s.usuarios) || 0, Number(s.anuncios) || 0]));
        const passo = passoBonito(maximo / 4);
        const topo = passo * Math.ceil(maximo / passo);
        const y = (v) => m.t + ih - (v / topo) * ih;

        let grade = "";
        for (let v = 0; v <= topo; v += passo) {
            grade += `<line class="grade-y" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>
                      <text x="${m.l - 10}" y="${y(v) + 4}" text-anchor="end">${fmt.format(v)}</text>`;
        }

        const gw = iw / serie.length;
        const larg = Math.min(26, gw * 0.28);
        const folga = 6;

        const grupos = serie.map((s, i) => {
            const u = Number(s.usuarios) || 0;
            const a = Number(s.anuncios) || 0;
            const cx = m.l + gw * i + gw / 2;
            const xU = cx - folga / 2 - larg;
            const xA = cx + folga / 2;
            const hU = (u / topo) * ih;
            const hA = (a / topo) * ih;
            const atraso = i * 60;

            const barra = (classe, x, valor, altura) => valor > 0 ? `
                <rect class="${classe}" x="${x}" y="${y(valor)}" width="${larg}" height="${altura}" rx="4" style="animation-delay:${atraso}ms"/>
                <text class="val" x="${x + larg / 2}" y="${y(valor) - 6}" text-anchor="middle">${fmt.format(valor)}</text>` : "";

            return `<g class="grupo">
                <title>${esc(nomeMesLongo(s.mes))}: ${fmt.format(u)} usuário(s) e ${fmt.format(a)} anúncio(s)</title>
                <rect class="col" x="${m.l + gw * i + 4}" y="${m.t}" width="${gw - 8}" height="${ih}" rx="10"/>
                ${barra("barra-u", xU, u, hU)}
                ${barra("barra-a", xA, a, hA)}
                <text class="eixo-x" x="${cx}" y="${H - 12}" text-anchor="middle">${esc(rotuloMes(s.mes))}</text>
            </g>`;
        }).join("");

        const totalU = serie.reduce((s, x) => s + (Number(x.usuarios) || 0), 0);
        const totalA = serie.reduce((s, x) => s + (Number(x.anuncios) || 0), 0);

        alvo.innerHTML = `
            <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Novos usuários e anúncios por mês nos últimos 6 meses">
                ${grade}${grupos}
            </svg>
            <div class="grafico-resumo">
                <span><b>${fmt.format(totalU)}</b> novos usuários</span>
                <span><b>${fmt.format(totalA)}</b> novos anúncios</span>
                <span>no período de 6 meses</span>
            </div>`;
    }

    // ---------- Pendências ----------
    function itemPendencia({ n, nivel, icone: ic, titulo, desc, href }) {
        const total = Number(n) || 0;
        const classe = [nivel, total === 0 ? "zerado" : ""].filter(Boolean).join(" ");
        return `<a class="pend ${classe}" href="${esc(href)}">
                    <span class="pend-icone">${icone(ic)}</span>
                    <span class="pend-txt"><strong>${esc(titulo)}</strong><small>${esc(desc)}</small></span>
                    <span class="pend-n">${fmt.format(total)}</span>
                </a>`;
    }

    function renderPendencias(d) {
        const alvo = $("pendencias");
        if (!alvo) return;

        const p = d.pendencias || {};
        const a = d.anuncios || {};
        const u = d.usuarios || {};

        const atencao = [
            { n: p.denuncias_pendentes, nivel: "critico", icone: "i-flag", titulo: "Denúncias pendentes", desc: "Anúncios denunciados por usuários", href: "/pages/moderacao.html" },
            { n: p.empresas_pendentes, nivel: "alerta", icone: "i-building", titulo: "Empresas aguardando verificação", desc: "Aprove ou recuse os cadastros", href: "/pages/moderacao.html" },
            { n: a.sem_foto, nivel: "alerta", icone: "i-image", titulo: "Anúncios sem foto", desc: "Costumam receber menos contatos", href: "/pages/moderacao.html" }
        ].filter((i) => Number(i.n) > 0);

        const informativo = [
            { n: u.bloqueados, nivel: "info", icone: "i-ban", titulo: "Usuários bloqueados", desc: "Contas com acesso suspenso", href: "/pages/usuarios.html" },
            { n: u.inativos, nivel: "info", icone: "i-user", titulo: "Contas inativas", desc: "Sem acessar há bastante tempo", href: "/pages/usuarios.html" }
        ];

        const totalAtencao = atencao.reduce((s, i) => s + Number(i.n), 0);

        const blocoAtencao = atencao.length
            ? atencao.map(itemPendencia).join("")
            : `<div class="tudo-certo">${icone("i-check")}<span>Tudo certo por aqui.<br>Nenhuma pendência para revisar.</span></div>`;

        alvo.innerHTML = `${blocoAtencao}
            <div class="pend-titulo">Informativo</div>
            ${informativo.map(itemPendencia).join("")}`;

        const contador = $("contadorPend");
        if (contador) {
            contador.textContent = fmt.format(totalAtencao);
            contador.hidden = totalAtencao === 0;
        }
        document.title = `${totalAtencao > 0 ? `(${totalAtencao}) ` : ""}Painel Administrativo | MotorFlex`;
    }

    // ---------- Tipos de conta (donut) ----------
    function renderDonut(u) {
        const alvo = $("donut");
        if (!alvo) return;

        const tipos = [
            { chave: "individual", rotulo: "Pessoa física", cor: "var(--ok)" },
            { chave: "empresa", rotulo: "Empresas", cor: "var(--purple)" },
            { chave: "admin", rotulo: "Administradores", cor: "var(--info)" }
        ];

        const valores = tipos.map((t) => Number(u[t.chave]) || 0);
        const total = valores.reduce((s, v) => s + v, 0);
        const R = 52;
        const C = 2 * Math.PI * R;
        const segmentosAtivos = valores.filter((v) => v > 0).length;

        let acumulado = 0;
        const alvos = [];

        const circulos = tipos.map((t, i) => {
            const comprimento = total ? (valores[i] / total) * C : 0;
            const visivel = Math.max(0, comprimento - (segmentosAtivos > 1 ? 2 : 0));
            const c = `<circle class="seg" cx="70" cy="70" r="${R}" stroke="${t.cor}"
                        style="stroke-dasharray:0 ${C};stroke-dashoffset:${-acumulado}"/>`;
            alvos.push(`${visivel} ${C}`);
            acumulado += comprimento;
            return c;
        }).join("");

        const legenda = tipos.map((t, i) => {
            const pct = total ? Math.round((valores[i] / total) * 100) : 0;
            return `<div><i style="background:${t.cor}"></i>${esc(t.rotulo)}<b>${fmt.format(valores[i])}</b><small>${pct}%</small></div>`;
        }).join("");

        alvo.innerHTML = `
            <div class="donut">
                <svg viewBox="0 0 140 140" role="img" aria-label="Distribuição das contas por tipo">
                    <circle class="fundo" cx="70" cy="70" r="${R}"/>${circulos}
                </svg>
                <div class="donut-centro"><strong>${fmt.format(total)}</strong><small>contas</small></div>
            </div>
            <div class="donut-leg">${legenda}</div>`;

        // duas frames para a transição do traço ser animada
        requestAnimationFrame(() => requestAnimationFrame(() => {
            alvo.querySelectorAll(".seg").forEach((c, i) => { c.style.strokeDasharray = alvos[i]; });
        }));
    }

    // ---------- Listas recentes ----------
    function rotuloTipo(tipo) {
        return { individual: "Pessoa física", empresa: "Empresa", admin: "Admin" }[tipo] || tipo || "—";
    }

    function selo(u) {
        if (u.status === "bloqueado") return `<span class="badge bloqueado">Bloqueado</span>`;
        if (["inativo", "inactive_warning", "inactive_expired"].includes(u.status)) return `<span class="badge inativo">Inativo</span>`;
        return `<span class="badge ${esc(u.tipo)}">${esc(rotuloTipo(u.tipo))}</span>`;
    }

    function tratarImagensQuebradas(container) {
        container.querySelectorAll("img[data-fb]").forEach((img) => {
            img.addEventListener("error", () => {
                if (img.dataset.fb === "thumb") {
                    const vazio = document.createElement("span");
                    vazio.className = "thumb vazia";
                    vazio.innerHTML = icone("i-image");
                    img.replaceWith(vazio);
                } else {
                    img.remove();
                }
            }, { once: true });
        });
    }

    function renderUsuarios(lista) {
        const alvo = $("listaUsuarios");
        if (!alvo) return;

        if (!lista.length) {
            alvo.innerHTML = `<div class="vazio-lista">Nenhum usuário cadastrado ainda.</div>`;
            return;
        }

        alvo.innerHTML = lista.map((u) => {
            const nome = [u.nome, u.sobrenome].filter(Boolean).join(" ") || "Sem nome";
            const foto = normalizarUrlFoto(u.foto_perfil);
            return `<div class="item">
                <span class="av" style="background:${corDoNome(nome)}">${esc(iniciais(nome))}${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" data-fb="av">` : ""}</span>
                <div class="item-info"><strong>${esc(nome)}</strong><small>${esc(u.email)}</small></div>
                <div class="item-meta">${selo(u)}<span>${esc(tempoRelativo(u.criado_em))}</span></div>
            </div>`;
        }).join("");

        tratarImagensQuebradas(alvo);
    }

    function renderAnuncios(lista) {
        const alvo = $("listaAnuncios");
        if (!alvo) return;

        if (!lista.length) {
            alvo.innerHTML = `<div class="vazio-lista">Nenhum anúncio cadastrado ainda.</div>`;
            return;
        }

        alvo.innerHTML = lista.map((v) => {
            const titulo = [v.marca, v.modelo].filter(Boolean).join(" ") || "Veículo";
            const ano = v.ano_modelo || v.ano_fabricacao;
            const foto = normalizarUrlFoto(v.imagem);
            const miniatura = foto
                ? `<img class="thumb" src="${esc(foto)}" alt="" loading="lazy" data-fb="thumb">`
                : `<span class="thumb vazia">${icone("i-image")}</span>`;
            const detalhe = [ano, v.dono].filter(Boolean).join(" • ");

            return `<a class="item" href="/pages/detalhes-veiculo.html?id=${encodeURIComponent(v.id)}" title="Abrir anúncio">
                ${miniatura}
                <div class="item-info"><strong>${esc(titulo)}</strong><small>${esc(detalhe || "—")}</small></div>
                <div class="item-meta"><b>${esc(brl(v.preco))}</b><span>${fmt.format(Number(v.visualizacoes) || 0)} vis. · ${esc(tempoRelativo(v.criado_em))}</span></div>
            </a>`;
        }).join("");

        tratarImagensQuebradas(alvo);
    }

    // ------------------------------------------------------------------
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
