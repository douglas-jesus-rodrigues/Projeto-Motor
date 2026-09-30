"use strict";
/* ==========================================================================
   MOTORFLEX — MENSAGENS (estilo WhatsApp)
   Usa as mesmas rotas de antes:
     GET  /api/mensagens/conversas?usuarioId=ID
     GET  /api/mensagens?conversaId=ID
     POST /api/mensagens  { conversa_id, remetente_id, destinatario_id, texto }
   Campos opcionais que, se existirem, são aproveitados:
     conversa: ultimo_envio, total_mensagens, nao_lidas, ultimo_remetente_id, veiculo_nome
     mensagem: criado_em / enviado_em / data_envio / created_at
   ========================================================================== */
(() => {
    const LOGIN = "/pages/login.html";
    const PAINEIS = { admin: "/pages/painel-admin.html", empresa: "/pages/painel-empresa.html", individual: "/pages/painel-cliente.html" };
    const PAGINAS_BLOQUEADAS = ["login.html", "cadastro.html", "esqueci-senha.html", "redefinir-senha.html", "mensagens.html"];
    const POLL_LISTA_MS = 6000, POLL_CHAT_MS = 3000;
    const RAPIDAS = ["Olá! Ainda está disponível?", "Qual o menor valor à vista?", "Aceita troca?", "Posso agendar um test drive?", "Pode enviar mais fotos?", "Qual o histórico de manutenção?"];
    const EMOJIS = "😀 😁 😂 😊 😍 😎 🤝 👍 👏 🙏 🔥 🚗 🏎️ 🚙 🔑 💰 📅 📍 ✅ ❌ 👀 🤔 😉 🙌".split(" ");

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s ?? "").replace(/[&<>'"]/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[t]));

    // ------------------------------------------------------------------ SESSÃO
    function lerUsuario() {
        try {
            const u = JSON.parse(localStorage.getItem("usuario"));
            const b = u && typeof u.usuario === "object" ? u.usuario : u;
            if (!b || b.id == null) return null;
            return { ...b, tipo: String(b.tipo || b.cargo || "individual").toLowerCase() };
        } catch { return null; }
    }

    const me = lerUsuario();
    if (!me) { location.replace(LOGIN); return; }

    // Confere a cada ação se a conta logada ainda é a mesma (evita usar a conta errada em outra aba)
    function garantirSessao() {
        const u = lerUsuario();
        if (!u) { location.replace(LOGIN); return false; }
        if (String(u.id) !== String(me.id)) { location.reload(); return false; }
        return true;
    }
    const token = () => localStorage.getItem("token") || sessionStorage.getItem("token");
    async function api(url, opts = {}) {
        const t = token();
        const r = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", ...(t && { Authorization: `Bearer ${t}` }), ...opts.headers } });
        if (r.status === 401) { location.replace(LOGIN); throw new Error("401"); }
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.sucesso === false) throw new Error(d.mensagem || `HTTP ${r.status}`);
        return d;
    }

    // ------------------------------------------------------- BOTÃO VOLTAR (inteligente)
    // Volta para a página de onde a pessoa veio; nunca para login/cadastro nem para o painel de OUTRO tipo de conta.
    function destinoVoltar() {
        const meuPainel = PAINEIS[me.tipo] || PAINEIS.individual;
        let ref = sessionStorage.getItem("mf_msg_voltar") || "";
        try {
            const u = new URL(document.referrer);
            if (u.origin === location.origin) {
                const arq = u.pathname.split("/").pop();
                if (!PAGINAS_BLOQUEADAS.includes(arq)) { ref = u.pathname + u.search; sessionStorage.setItem("mf_msg_voltar", ref); }
            }
        } catch { /* sem referrer */ }
        const path = ref.split("?")[0];
        const painelAlheio = Object.values(PAINEIS).includes(path) && path !== meuPainel;
        return !ref || painelAlheio ? meuPainel : ref;
    }
    function configurarVoltar() {
        const dest = destinoVoltar(), a = $("btnVoltar");
        a.href = dest;
        $("btnVoltarTexto").textContent = /catalogo/.test(dest) ? "Voltar ao Catálogo" : /painel/.test(dest) ? "Voltar ao Painel" : "Voltar";
        a.addEventListener("click", (e) => { e.preventDefault(); if (garantirSessao()) location.href = destinoVoltar(); });
    }

    // ------------------------------------------------------------------ ESTADO
    let conversas = [], ativaId = null, msgsSig = "";
    let filtro = "todas", busca = "", pendentes = [], novasAbaixo = 0, tituloBase = document.title;
    const LIDAS_KEY = `mf_lidas_${me.id}`;
    let lidas = {};
    try { lidas = JSON.parse(localStorage.getItem(LIDAS_KEY)) || {}; } catch { lidas = {}; }
    const salvarLidas = () => { try { localStorage.setItem(LIDAS_KEY, JSON.stringify(lidas)); } catch { /* cheio */ } };

    // ---------------------------------------------------------------- HELPERS
    const assinatura = (c) => String(c.total_mensagens ?? c.ultima_mensagem ?? "");
    const souEu = (id) => id != null && String(id) === String(me.id);

    function naoLidas(c) {
        if (String(c.id) === String(ativaId) && !document.hidden) return 0;
        if (c.nao_lidas != null) return Number(c.nao_lidas) || 0;
        if (souEu(c.ultimo_remetente_id)) return 0;
        const v = lidas[c.id];
        if (v == null) return 0;
        const tot = Number(c.total_mensagens);
        if (!isNaN(tot) && !isNaN(Number(v))) return Math.max(0, tot - Number(v));
        return String(v) !== assinatura(c) ? 1 : 0;
    }
    const marcarLida = (c) => { lidas[c.id] = assinatura(c); salvarLidas(); };

    function tempo(x) { const d = new Date(x); return isNaN(d) ? null : d; }
    const mesmoDia = (a, b) => a.toDateString() === b.toDateString();
    function horaLista(x) {
        const d = tempo(x); if (!d) return "";
        const hoje = new Date(), ontem = new Date(Date.now() - 864e5);
        if (mesmoDia(d, hoje)) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        if (mesmoDia(d, ontem)) return "Ontem";
        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
    }
    const horaMsg = (x) => { const d = tempo(x); return d ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""; };
    function rotuloDia(d) {
        if (mesmoDia(d, new Date())) return "Hoje";
        if (mesmoDia(d, new Date(Date.now() - 864e5))) return "Ontem";
        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    }
    const dataMsg = (m) => m.criado_em || m.enviado_em || m.data_envio || m.created_at || m.data || null;

    // Avatar: iniciais coloridas por baixo; a foto (se existir) cobre por cima
    function imgSrc(s) { return typeof s === "string" && s ? (/^(\/|https?:)/.test(s) ? s : `/uploads/${s}`) : ""; }
    function avatar(nome, foto, tam = "md") {
        const n = String(nome || "?").trim(), p = n.split(/\s+/);
        const ini = ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
        let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) % 360;
        const src = imgSrc(foto);
        return `<span class="av av-${tam}" style="background:linear-gradient(135deg,hsl(${h} 45% 28%),hsl(${(h + 40) % 360} 50% 20%))">${esc(ini)}${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : ""}</span>`;
    }
    document.addEventListener("error", (e) => { if (e.target.tagName === "IMG" && e.target.closest(".av")) e.target.remove(); }, true);

    // ------------------------------------------------------------------ TOAST
    function toast(titulo, texto, tipo = "", aoClicar) {
        const t = document.createElement("div");
        t.className = `toast ${tipo}`;
        t.innerHTML = `<div><b>${esc(titulo)}</b>${texto ? `<span>${esc(texto)}</span>` : ""}</div>`;
        if (aoClicar) t.addEventListener("click", () => { aoClicar(); t.remove(); });
        $("toastArea").appendChild(t);
        requestAnimationFrame(() => t.classList.add("on"));
        setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 300); }, 4500);
    }

    // ------------------------------------------------------------ LISTA DE CONVERSAS
    async function carregarConversas(silencioso = false) {
        if (!garantirSessao()) return;
        try {
            const d = await api(`/api/mensagens/conversas?usuarioId=${encodeURIComponent(me.id)}`);
            const novas = Array.isArray(d.conversas) ? d.conversas : [];
            const antes = Object.fromEntries(conversas.map((c) => [c.id, naoLidas(c)]));

            // primeira vez que vemos uma conversa: considera já lida (evita "enxurrada" de não lidas)
            novas.forEach((c) => { if (lidas[c.id] == null) lidas[c.id] = assinatura(c); });
            salvarLidas();
            novas.sort((a, b) => (tempo(b.ultimo_envio)?.getTime() || 0) - (tempo(a.ultimo_envio)?.getTime() || 0));
            conversas = novas;

            if (silencioso) {
                conversas.forEach((c) => {
                    const n = naoLidas(c);
                    if (n > (antes[c.id] || 0) && String(c.id) !== String(ativaId)) {
                        toast(c.outro_usuario_nome || "Nova mensagem", c.ultima_mensagem, "", () => selecionar(c.id));
                    }
                });
            }
            renderLista();
            if (!silencioso) abrirPorURL();
        } catch (e) {
            if (!silencioso) $("conversasList").innerHTML = `<div class="lista-vazia"><i class="fa-solid fa-triangle-exclamation"></i>Erro ao carregar conversas.</div>`;
            console.error("Erro ao carregar conversas:", e);
        }
    }

    function renderLista() {
        const total = conversas.reduce((s, c) => s + (naoLidas(c) > 0 ? naoLidas(c) : 0), 0);
        $("totalConversas").textContent = conversas.length;
        const bn = $("totalNaoLidas");
        bn.hidden = !total; bn.textContent = total;
        document.title = total ? `(${total}) ${tituloBase}` : tituloBase;

        const q = busca.toLowerCase();
        const lista = conversas.filter((c) =>
            (filtro === "todas" || naoLidas(c) > 0) &&
            (!q || `${c.outro_usuario_nome || ""} ${c.veiculo_nome || ""}`.toLowerCase().includes(q)));

        if (!lista.length) {
            $("conversasList").innerHTML = `<div class="lista-vazia"><i class="fa-regular fa-comments"></i>${
                conversas.length ? "Nenhuma conversa encontrada." : "Você ainda não tem conversas.<br>Fale com um vendedor pelo anúncio."}</div>`;
            return;
        }
        $("conversasList").innerHTML = lista.map((c) => {
            const n = naoLidas(c);
            return `<div class="conversa-item ${String(c.id) === String(ativaId) ? "ativo" : ""} ${n ? "tem-nova" : ""}" data-id="${esc(c.id)}" role="button" tabindex="0">
                ${avatar(c.outro_usuario_nome, c.outro_usuario_foto, "lg")}
                <div class="conversa-info">
                    <div class="conversa-linha"><h4>${esc(c.outro_usuario_nome || "Usuário")}</h4><span class="conversa-hora">${esc(horaLista(c.ultimo_envio))}</span></div>
                    <div class="conversa-linha"><p>${esc(c.ultima_mensagem || "Inicie a conversa...")}</p>${n ? `<span class="badge-nova">${n > 99 ? "99+" : n}</span>` : ""}</div>
                    ${c.veiculo_nome ? `<span class="conversa-veic"><i class="fa-solid fa-car-side"></i> ${esc(c.veiculo_nome)}</span>` : ""}
                </div></div>`;
        }).join("");
    }

    // ------------------------------------------------------------- CONVERSA ATIVA
    const conversaAtiva = () => conversas.find((c) => String(c.id) === String(ativaId));

    function selecionar(id) {
        const c = conversas.find((x) => String(x.id) === String(id));
        if (!c) return;
        ativaId = c.id; msgsSig = ""; ultimasMsgs = []; pendentes = []; novasAbaixo = 0;
        marcarLida(c);

        $("chatEmptyState").hidden = true;
        $("chatActiveBox").hidden = false;
        $("chatWrapper").classList.add("em-conversa");
        $("chatAvatar").outerHTML = avatar(c.outro_usuario_nome, c.outro_usuario_foto, "md").replace('class="av', 'id="chatAvatar" class="av');
        $("chatDestinatarioNome").textContent = c.outro_usuario_nome || "Usuário";
        $("chatVeiculoRef").innerHTML = `<i class="fa-solid fa-car-side"></i> ${esc(c.veiculo_nome || "Veículo MotorFlex")}`;
        $("respostasRapidas").hidden = true; $("emojiPanel").hidden = true;
        try { history.replaceState(null, "", `?conversa=${encodeURIComponent(c.id)}`); } catch { /* ok */ }

        renderLista();
        carregarMensagens(true);
        if (window.innerWidth > 820) $("inputMensagem").focus();
    }

    function voltarParaLista() {
        ativaId = null;
        $("chatWrapper").classList.remove("em-conversa");
        $("chatActiveBox").hidden = true;
        $("chatEmptyState").hidden = false;
        try { history.replaceState(null, "", location.pathname); } catch { /* ok */ }
        renderLista();
    }

    function abrirPorURL() {
        const id = new URLSearchParams(location.search).get("conversa");
        if (id && !ativaId) selecionar(id);
    }

    // -------------------------------------------------------------------- MENSAGENS
    const scroller = () => $("chatMessagesScroll");
    const pertoDoFim = () => { const s = scroller(); return s.scrollHeight - s.scrollTop - s.clientHeight < 90; };
    function irAoFim(suave = false) {
        const s = scroller();
        s.scrollTo({ top: s.scrollHeight, behavior: suave ? "smooth" : "auto" });
        novasAbaixo = 0; atualizarBotaoBaixo();
    }
    function atualizarBotaoBaixo() {
        const longe = !pertoDoFim();
        $("btnBaixo").hidden = !longe;
        const ct = $("baixoContador");
        ct.hidden = !novasAbaixo; ct.textContent = novasAbaixo;
    }

    let ultimasMsgs = [];
    function renderMensagens(msgs) {
        let html = "", diaAnt = "", remAnt = null;
        const bolha = (m, extra = "") => {
            const ehMinha = extra ? true : souEu(m.remetente_id);
            const d = tempo(dataMsg(m));
            const dia = d ? d.toDateString() : "";
            let sep = "";
            if (dia && dia !== diaAnt) { sep = `<div class="dia-sep">${esc(rotuloDia(d))}</div>`; diaAnt = dia; remAnt = null; }
            const agrupada = remAnt === (ehMinha ? "eu" : "outro") ? "agrupada" : "";
            remAnt = ehMinha ? "eu" : "outro";
            const hora = extra === "falhou" ? "não enviada · tocar para reenviar" : extra === "enviando" ? "" : horaMsg(dataMsg(m));
            return `${sep}<div class="msg-bubble ${ehMinha ? "enviada" : "recebida"} ${agrupada} ${extra}" ${m.tmp ? `data-tmp="${m.tmp}"` : ""}>${esc(m.texto)}${hora ? `<span class="hora">${esc(hora)}</span>` : ""}</div>`;
        };
        msgs.forEach((m) => { html += bolha(m); });
        pendentes.filter((p) => String(p.conversa) === String(ativaId)).forEach((p) => { html += bolha({ ...p, remetente_id: me.id }, p.status); });
        scroller().innerHTML = html || `<div class="dia-sep">Diga olá 👋</div>`;
    }

    async function carregarMensagens(forcar = false) {
        if (!ativaId || !garantirSessao()) return;
        const id = ativaId;
        try {
            const d = await api(`/api/mensagens?conversaId=${encodeURIComponent(id)}`);
            if (id !== ativaId) return;                         // trocou de conversa durante a requisição
            const msgs = Array.isArray(d.mensagens) ? d.mensagens : [];
            const ult = msgs[msgs.length - 1];
            const sig = `${msgs.length}|${ult?.id ?? ""}|${ult?.texto ?? ""}`;
            if (!forcar && sig === msgsSig) return;

            const eraFim = pertoDoFim();
            const antes = ultimasMsgs.length;
            const chegouDoOutro = !forcar && msgs.length > antes && !souEu(ult?.remetente_id);
            ultimasMsgs = msgs; msgsSig = sig;
            renderMensagens(msgs);

            const c = conversaAtiva(); if (c && !document.hidden) { marcarLida(c); }
            if (forcar || eraFim || !chegouDoOutro) irAoFim();
            else { novasAbaixo += msgs.length - antes; atualizarBotaoBaixo(); }
            if (!forcar && chegouDoOutro && eraFim) renderLista();
        } catch (e) { console.error("Erro ao carregar mensagens:", e); }
    }

    // ---------------------------------------------------------------------- ENVIO
    async function enviar(texto, tmpExistente) {
        const c = conversaAtiva();
        if (!c || !garantirSessao()) return;
        let p = pendentes.find((x) => x.tmp === tmpExistente);
        if (!p) { p = { tmp: `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`, texto, conversa: c.id, status: "enviando" }; pendentes.push(p); }
        p.status = "enviando";
        renderMensagens(ultimasMsgs); irAoFim(true);

        try {
            await api("/api/mensagens", {
                method: "POST",
                body: JSON.stringify({ conversa_id: c.id, remetente_id: me.id, destinatario_id: c.outro_usuario_id, texto: p.texto })
            });
            pendentes = pendentes.filter((x) => x.tmp !== p.tmp);
            c.ultima_mensagem = p.texto; c.ultimo_envio = new Date().toISOString();
            if (c.total_mensagens != null) c.total_mensagens = Number(c.total_mensagens) + 1;
            c.ultimo_remetente_id = me.id;
            marcarLida(c);
            await carregarMensagens(true);
            carregarConversas(true);
        } catch (e) {
            console.error("Erro ao enviar mensagem:", e);
            p.status = "falhou";
            renderMensagens(ultimasMsgs); irAoFim();
            toast("Mensagem não enviada", "Toque na mensagem para tentar de novo.", "erro");
        }
    }

    // --------------------------------------------------------------- COMPOSER / UI
    function ajustarTextarea() {
        const t = $("inputMensagem");
        t.style.height = "auto";
        t.style.height = Math.min(t.scrollHeight, 130) + "px";
        $("btnEnviarMensagem").disabled = !t.value.trim();
    }
    function inserirNoTexto(txt) {
        const t = $("inputMensagem"), a = t.selectionStart ?? t.value.length, b = t.selectionEnd ?? a;
        t.value = t.value.slice(0, a) + txt + t.value.slice(b);
        t.focus(); t.selectionStart = t.selectionEnd = a + txt.length;
        ajustarTextarea();
    }
    function alternarPainel(qual) {
        const r = $("respostasRapidas"), e = $("emojiPanel");
        const abrir = qual === "r" ? r.hidden : e.hidden;
        r.hidden = e.hidden = true;
        if (abrir) (qual === "r" ? r : e).hidden = false;
        $("btnRapidas").classList.toggle("ativo", qual === "r" && abrir);
        $("btnEmoji").classList.toggle("ativo", qual === "e" && abrir);
    }

    function configurarEventos() {
        $("conversasList").addEventListener("click", (e) => { const i = e.target.closest(".conversa-item"); if (i) selecionar(i.dataset.id); });
        $("conversasList").addEventListener("keydown", (e) => {
            if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("conversa-item")) { e.preventDefault(); selecionar(e.target.dataset.id); }
        });
        $("inputPesquisaConversa").addEventListener("input", (e) => { busca = e.target.value.trim(); renderLista(); });
        document.querySelectorAll(".filtro").forEach((b) => b.addEventListener("click", () => {
            filtro = b.dataset.filtro;
            document.querySelectorAll(".filtro").forEach((x) => x.classList.toggle("ativo", x === b));
            renderLista();
        }));

        $("btnListaVoltar").addEventListener("click", voltarParaLista);
        $("btnBaixo").addEventListener("click", () => irAoFim(true));
        scroller().addEventListener("scroll", () => { if (pertoDoFim()) novasAbaixo = 0; atualizarBotaoBaixo(); }, { passive: true });
        scroller().addEventListener("click", (e) => {
            const b = e.target.closest(".msg-bubble.falhou");
            if (b) enviar(null, b.dataset.tmp);
        });

        const ta = $("inputMensagem");
        ta.addEventListener("input", ajustarTextarea);
        ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("chatForm").requestSubmit(); } });
        $("chatForm").addEventListener("submit", (e) => {
            e.preventDefault();
            const texto = ta.value.trim();
            if (!texto || !ativaId) return;
            ta.value = ""; ajustarTextarea();
            $("respostasRapidas").hidden = $("emojiPanel").hidden = true;
            $("btnRapidas").classList.remove("ativo"); $("btnEmoji").classList.remove("ativo");
            enviar(texto);
        });

        $("respostasRapidas").innerHTML = RAPIDAS.map((r) => `<button type="button" class="resposta-chip">${esc(r)}</button>`).join("");
        $("respostasRapidas").addEventListener("click", (e) => { const b = e.target.closest(".resposta-chip"); if (b) { inserirNoTexto(b.textContent); alternarPainel("r"); } });
        $("emojiPanel").innerHTML = EMOJIS.map((m) => `<button type="button">${m}</button>`).join("");
        $("emojiPanel").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) inserirNoTexto(b.textContent); });
        $("btnRapidas").addEventListener("click", () => alternarPainel("r"));
        $("btnEmoji").addEventListener("click", () => alternarPainel("e"));

        document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ativaId && innerWidth <= 820) voltarParaLista(); });

        // atualização ao vivo + verificação de login sempre que voltar à aba / mudar o storage
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) return;
            if (garantirSessao()) { carregarConversas(true); carregarMensagens(); const c = conversaAtiva(); if (c) marcarLida(c); }
        });
        addEventListener("storage", (e) => { if (e.key === "usuario" || e.key === null) garantirSessao(); });
        setInterval(() => { if (!document.hidden) carregarConversas(true); }, POLL_LISTA_MS);
        setInterval(() => { if (!document.hidden && ativaId) carregarMensagens(); }, POLL_CHAT_MS);
    }

    // ------------------------------------------------------------------------ INIT
    configurarVoltar();
    configurarEventos();
    carregarConversas(false);
})();