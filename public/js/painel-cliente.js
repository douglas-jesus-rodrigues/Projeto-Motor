"use strict";
/* ==========================================================================
   MOTORFLEX — PAINEL DO CLIENTE
   Mantém: sessão, foto de perfil (recorte + remover), menu, logout.
   Novo: resumo real (anúncios, visualizações, mensagens, favoritos), listas recentes,
         completar perfil, sincronização entre abas.
   ========================================================================== */
(() => {
    const LOGIN = "/pages/login.html";
    const PAINEIS = { admin: "/pages/painel-admin.html", empresa: "/pages/painel-empresa.html" };
    // Se sua API de favoritos existir, informe a rota (ex.: "/api/favoritos/usuario/"); ela deve devolver
    // uma lista (ou { favoritos: [...] }). Com null o card mostra "—".
    const API_FAVORITOS = null;

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s ?? "").replace(/[&<>'"]/g, (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[t]));

    // ------------------------------------------------------------------ SESSÃO
    function lerSessao() {
        for (const storage of [localStorage, sessionStorage]) {
            for (const chave of ["usuario", "usuario_logado"]) {
                const bruto = storage.getItem(chave);
                if (!bruto) continue;
                try {
                    const dados = JSON.parse(bruto);
                    if (dados && typeof dados === "object") return { dados, storage, chave };
                } catch { /* tenta a próxima */ }
            }
        }
        return null;
    }
    const sessao = lerSessao();
    if (!sessao) { location.replace(LOGIN); return; }
    const usuario = sessao.dados;
    const uid = usuario.id ?? usuario._id;

    // Cada tipo de conta tem o seu painel
    const tipo = String(usuario.tipo || "individual").toLowerCase();
    if (PAINEIS[tipo]) { location.replace(PAINEIS[tipo]); return; }

    const token = () => localStorage.getItem("token") || sessionStorage.getItem("token");
    const authHeaders = () => (token() ? { Authorization: `Bearer ${token()}` } : {});
    const salvarSessao = () => { try { sessao.storage.setItem(sessao.chave, JSON.stringify(usuario)); } catch { /* cheio */ } };
    async function get(url) {
        const r = await fetch(url, { headers: { "Content-Type": "application/json", ...authHeaders() } });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.sucesso === false) throw new Error(d.mensagem || `HTTP ${r.status}`);
        return d;
    }

    // ------------------------------------------------------------------- TOAST
    function toast(msg, tipoMsg = "ok") {
        const t = document.createElement("div");
        t.className = `toast ${tipoMsg === "erro" ? "erro" : ""}`;
        t.textContent = msg;
        $("toastArea").appendChild(t);
        requestAnimationFrame(() => t.classList.add("on"));
        setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 300); }, 3500);
    }

    // ------------------------------------------------------------------ MODAIS
    const modais = ["modalSairContainer", "modalRemoverFoto", "modalRecorte"];
    function abrirModal(id) { $(id).classList.add("mostrar-modal"); document.body.classList.add("travado"); }
    function fecharModal(id) {
        $(id).classList.remove("mostrar-modal");
        if (!modais.some((m) => $(m).classList.contains("mostrar-modal"))) document.body.classList.remove("travado");
    }
    modais.forEach((id) => $(id).addEventListener("click", (e) => { if (e.target.id === id && id !== "modalRecorte") fecharModal(id); }));
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        modais.forEach((id) => { if ($(id).classList.contains("mostrar-modal")) id === "modalRecorte" ? cancelarRecorte() : fecharModal(id); });
        fecharMenu();
    });

    // -------------------------------------------------------------- FOTO / AVATAR
    const imgSrc = (s) => (typeof s === "string" && s ? (/^(\/|https?:|blob:|data:)/.test(s) ? s : `/uploads/${s}`) : "");
    const avatarPadrao = (nome) => `https://ui-avatars.com/api/?name=${encodeURIComponent(nome || "Cliente")}&background=181824&color=ff1e27&size=150`;

    function definirFoto(url) {
        const src = imgSrc(url) || avatarPadrao(usuario.nome);
        $("imgPerfil").src = src;
        $("miniAvatar").src = src;
        $("btnRemoverFoto").style.display = url ? "grid" : "none";
    }
    ["imgPerfil", "miniAvatar"].forEach((id) => $(id).addEventListener("error", (e) => {
        if (!e.target.src.includes("ui-avatars.com")) { e.target.src = avatarPadrao(usuario.nome); if (id === "imgPerfil") $("btnRemoverFoto").style.display = "none"; }
    }));

    // ------------------------------------------------------------- CABEÇALHO/HERO
    function preencherPerfil() {
        const primeiro = String(usuario.nome || "Cliente").trim();
        $("nomeUsuario").textContent = `${primeiro} ${usuario.sobrenome || ""}`.trim();
        $("miniNome").textContent = primeiro.split(/\s+/)[0];
        const h = new Date().getHours();
        $("saudacao").textContent = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
        const desde = new Date(usuario.criado_em);
        if (usuario.criado_em && !isNaN(desde)) { $("tagDesde").textContent = `Membro desde ${desde.getFullYear()}`; $("tagDesde").hidden = false; }
        definirFoto(usuario.fotoUrl || usuario.foto_perfil);
        montarChecklist();
    }

    // ---------------------------------------------------------------- MENU / SAIR
    const btnConfig = $("btnConfig"), menuConfig = $("menuConfig");
    function fecharMenu() { menuConfig.classList.remove("mostrar"); btnConfig.setAttribute("aria-expanded", "false"); }
    btnConfig.addEventListener("click", (e) => {
        e.stopPropagation();
        btnConfig.setAttribute("aria-expanded", String(menuConfig.classList.toggle("mostrar")));
    });
    document.addEventListener("click", (e) => { if (!menuConfig.contains(e.target) && !btnConfig.contains(e.target)) fecharMenu(); });

    $("gatilhoSair").addEventListener("click", (e) => { e.preventDefault(); fecharMenu(); abrirModal("modalSairContainer"); });
    $("btnCancelarSair").addEventListener("click", () => fecharModal("modalSairContainer"));
    $("btnSair").addEventListener("click", () => {
        ["usuario", "usuario_logado", "token"].forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
        location.replace(LOGIN);
    });

    // ------------------------------------------------------- FOTO: RECORTE E ENVIO
    const inputFoto = $("inputFotoPerfil");
    let cropper = null;

    function cancelarRecorte() {
        fecharModal("modalRecorte");
        if (cropper) { cropper.destroy(); cropper = null; }
        inputFoto.value = "";
    }

    inputFoto.addEventListener("change", (e) => {
        const arquivo = e.target.files[0];
        if (!arquivo) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) { toast("Selecione uma imagem JPEG, PNG ou WEBP.", "erro"); inputFoto.value = ""; return; }
        if (arquivo.size > 5 * 1024 * 1024) { toast("A foto deve ter no máximo 5MB.", "erro"); inputFoto.value = ""; return; }

        const leitor = new FileReader();
        leitor.onload = (ev) => {
            const img = $("imagemParaCortar");
            img.src = ev.target.result;
            abrirModal("modalRecorte");
            if (cropper) cropper.destroy();
            cropper = new Cropper(img, {
                aspectRatio: 1, viewMode: 1, dragMode: "move", autoCropArea: 0.8, restore: false, guides: true, center: true,
                highlight: false, cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false,
                minCropBoxWidth: 120, minCropBoxHeight: 120
            });
        };
        leitor.readAsDataURL(arquivo);
    });
    $("btnCancelarRecorte").addEventListener("click", cancelarRecorte);

    $("btnConfirmarRecorte").addEventListener("click", () => {
        if (!cropper) return;
        const btn = $("btnConfirmarRecorte"), textoOriginal = btn.textContent;
        btn.disabled = true; btn.textContent = "Salvando...";

        cropper.getCroppedCanvas({ width: 400, height: 400 }).toBlob(async (blob) => {
            if (!blob) { toast("Não foi possível processar a imagem.", "erro"); btn.disabled = false; btn.textContent = textoOriginal; return; }
            fecharModal("modalRecorte");
            const arquivo = new File([blob], "foto-perfil.png", { type: "image/png" });
            const previa = URL.createObjectURL(arquivo);
            const anterior = usuario.fotoUrl || usuario.foto_perfil || "";
            definirFoto(previa);

            const fd = new FormData();
            fd.append("fotoPerfil", arquivo);
            fd.append("usuarioId", uid);
            try {
                const r = await fetch("/api/perfil/upload-foto", { method: "POST", headers: authHeaders(), body: fd });
                const d = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(d.mensagem || d.erro || "Erro no servidor ao salvar a imagem.");
                const nova = d.fotoUrl || d.foto_perfil;
                if (nova) {
                    usuario.fotoUrl = usuario.foto_perfil = nova;
                    salvarSessao(); definirFoto(nova); montarChecklist();
                }
                toast("✨ Foto de perfil atualizada!");
            } catch (erro) {
                console.error("Falha no upload:", erro);
                toast(erro.message || "Não foi possível salvar a nova foto.", "erro");
                definirFoto(anterior);
            } finally {
                URL.revokeObjectURL(previa);
                if (cropper) { cropper.destroy(); cropper = null; }
                inputFoto.value = "";
                btn.disabled = false; btn.textContent = textoOriginal;
            }
        }, "image/png");
    });

    // ------------------------------------------------------ FOTO: REMOVER
    $("btnRemoverFoto").addEventListener("click", () => abrirModal("modalRemoverFoto"));
    $("btnNaoRemover").addEventListener("click", () => fecharModal("modalRemoverFoto"));
    $("btnSimRemover").addEventListener("click", async () => {
        const btn = $("btnSimRemover");
        btn.disabled = true;
        try {
            const r = await fetch("/api/perfil/remover-foto", {
                method: "DELETE", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ usuarioId: uid })
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok || d.sucesso === false) throw new Error(d.mensagem || "Não foi possível remover a foto.");
            usuario.fotoUrl = usuario.foto_perfil = null;
            salvarSessao(); definirFoto(null); montarChecklist();
            toast("🗑️ Foto de perfil removida.");
        } catch (erro) {
            console.error("Erro ao remover foto:", erro);
            toast(erro.message || "Erro de conexão ao remover a foto.", "erro");
        } finally { btn.disabled = false; fecharModal("modalRemoverFoto"); }
    });

    // ----------------------------------------------------------------- RESUMO
    const estado = { anuncios: null, conversas: null };
    const LIDAS_KEY = `mf_lidas_${uid}`;
    let lidas = {};
    try { lidas = JSON.parse(localStorage.getItem(LIDAS_KEY)) || {}; } catch { lidas = {}; }

    function animarNumero(el, alvo) {
        if (!el) return;
        if (typeof alvo !== "number") { el.textContent = "—"; return; }
        const ini = performance.now(), dur = 700;
        (function passo(t) {
            const p = Math.min(1, (t - ini) / dur);
            el.textContent = Math.round(alvo * (1 - Math.pow(1 - p, 3))).toLocaleString("pt-BR");
            if (p < 1) requestAnimationFrame(passo);
        })(ini);
    }
    const stat = (nome, valor) => animarNumero(document.querySelector(`[data-stat="${nome}"]`), valor);

    const brl = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    const vazio = (icone, texto, link) => `<div class="vazio"><svg class="i"><use href="#${icone}"/></svg>${texto}${link ? `<br><a href="${link[0]}">${link[1]}</a>` : ""}</div>`;

    function renderAnuncios(lista) {
        const el = $("listaAnuncios");
        if (!lista.length) { el.innerHTML = vazio("i-car", "Você ainda não anunciou nenhum veículo.", ["/pages/catalogo.html?tab=cadastrar", "Anunciar meu primeiro carro"]); return; }
        el.innerHTML = [...lista].sort((a, b) => b.id - a.id).slice(0, 3).map((v) => {
            const foto = imgSrc(v.imagem);
            const ano = v.ano_fabricacao && v.ano_modelo ? `${v.ano_fabricacao}/${v.ano_modelo}` : (v.ano_fabricacao || "");
            return `<a class="item" href="/pages/editar-anuncio.html?id=${encodeURIComponent(v.id)}">
                ${foto ? `<img class="item-foto" src="${esc(foto)}" alt="" loading="lazy">` : `<span class="item-foto vazia"><svg class="i"><use href="#i-car"/></svg></span>`}
                <div class="item-info"><h4>${esc(v.marca)} ${esc(v.modelo)}</h4><p>${esc([v.versao, ano].filter(Boolean).join(" · "))}</p></div>
                <div class="item-meta"><strong>${brl(v.preco)}</strong><span class="views"><svg class="i"><use href="#i-eye"/></svg>${Number(v.total_visualizacoes || 0)}</span></div>
            </a>`;
        }).join("");
    }

    function naoLidas(c) {
        if (c.nao_lidas != null) return Number(c.nao_lidas) || 0;
        if (c.ultimo_remetente_id != null && String(c.ultimo_remetente_id) === String(uid)) return 0;
        const v = lidas[c.id];
        if (v == null) return 0;
        const tot = Number(c.total_mensagens);
        if (!isNaN(tot) && !isNaN(Number(v))) return Math.max(0, tot - Number(v));
        return String(v) !== String(c.total_mensagens ?? c.ultima_mensagem ?? "") ? 1 : 0;
    }
    function horaCurta(x) {
        const d = new Date(x); if (isNaN(d)) return "";
        const hoje = new Date();
        if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        if (d.toDateString() === new Date(Date.now() - 864e5).toDateString()) return "Ontem";
        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    }
    function avatarConversa(nome, foto) {
        const n = String(nome || "?").trim(), p = n.split(/\s+/);
        let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) % 360;
        const src = imgSrc(foto);
        return `<span class="av" style="background:linear-gradient(135deg,hsl(${h} 45% 28%),hsl(${(h + 40) % 360} 50% 20%))">${esc(((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase())}${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>`;
    }
    function renderConversas(lista) {
        const el = $("listaConversas");
        if (!lista.length) { el.innerHTML = vazio("i-chat", "Nenhuma conversa por enquanto.<br>Fale com um vendedor pelo anúncio.", ["/pages/catalogo.html", "Explorar catálogo"]); return; }
        const ord = [...lista].sort((a, b) => (new Date(b.ultimo_envio).getTime() || 0) - (new Date(a.ultimo_envio).getTime() || 0)).slice(0, 4);
        el.innerHTML = ord.map((c) => {
            const n = naoLidas(c);
            return `<a class="item ${n ? "tem-nova" : ""}" href="/pages/mensagens.html?conversa=${encodeURIComponent(c.id)}">
                ${avatarConversa(c.outro_usuario_nome, c.outro_usuario_foto)}
                <div class="item-info"><h4>${esc(c.outro_usuario_nome || "Usuário")}</h4><p>${esc(c.ultima_mensagem || "Inicie a conversa...")}${c.veiculo_nome ? ` · ${esc(c.veiculo_nome)}` : ""}</p></div>
                <div class="item-meta"><span>${esc(horaCurta(c.ultimo_envio))}</span>${n ? `<span class="nova-badge">${n > 99 ? "99+" : n}</span>` : ""}</div>
            </a>`;
        }).join("");
    }

    async function carregarResumo() {
        const [v, c, f] = await Promise.allSettled([
            get(`/api/veiculos/usuario/${encodeURIComponent(uid)}`),
            get(`/api/mensagens/conversas?usuarioId=${encodeURIComponent(uid)}`),
            API_FAVORITOS ? get(API_FAVORITOS + encodeURIComponent(uid)) : Promise.reject(new Error("sem-api"))
        ]);

        if (v.status === "fulfilled") {
            const lista = Array.isArray(v.value.veiculos) ? v.value.veiculos : [];
            estado.anuncios = lista;
            stat("anuncios", lista.length);
            stat("views", lista.reduce((s, x) => s + Number(x.total_visualizacoes || 0), 0));
            renderAnuncios(lista);
        } else {
            stat("anuncios"); stat("views");
            $("listaAnuncios").innerHTML = vazio("i-alert", "Não foi possível carregar seus anúncios.");
        }

        if (c.status === "fulfilled") {
            const lista = Array.isArray(c.value.conversas) ? c.value.conversas : [];
            estado.conversas = lista;
            const total = lista.reduce((s, x) => s + naoLidas(x), 0);
            stat("naolidas", total);
            $("pontoMsg").hidden = !total; $("pontoMsg").textContent = total > 99 ? "99+" : total;
            renderConversas(lista);
        } else {
            stat("naolidas");
            $("listaConversas").innerHTML = vazio("i-alert", "Não foi possível carregar suas conversas.");
        }

        if (f.status === "fulfilled") {
            const d = f.value, lista = Array.isArray(d) ? d : (d.favoritos || d.dados || []);
            stat("favoritos", lista.length);
        } else stat("favoritos");

        montarChecklist();
    }

    // --------------------------------------------------------- COMPLETAR PERFIL
    function montarChecklist() {
        const itens = [
            { ok: !!(usuario.fotoUrl || usuario.foto_perfil), txt: "Adicionar foto de perfil", acao: "foto" },
            { ok: !!String(usuario.telefone || "").trim(), txt: "Cadastrar telefone de contato", href: "/pages/perfil.html" },
            { ok: !!(estado.anuncios && estado.anuncios.length), txt: "Publicar o primeiro anúncio", href: "/pages/catalogo.html?tab=cadastrar" },
            { ok: !!(estado.conversas && estado.conversas.length), txt: "Iniciar uma conversa", href: "/pages/catalogo.html" }
        ];
        const feitos = itens.filter((i) => i.ok).length, pct = Math.round((feitos / itens.length) * 100);
        $("percentual").textContent = `${pct}%`;
        $("barraProgresso").style.width = `${pct}%`;
        $("checklist").innerHTML = itens.map((i) => {
            const marca = `<span class="check"><svg class="i"><use href="#i-check"/></svg></span>`;
            const corpo = i.ok ? `<span>${marca}${esc(i.txt)}</span>`
                : `<a href="${i.href || "#"}" ${i.acao ? `data-acao="${i.acao}"` : ""}>${marca}${esc(i.txt)}</a>`;
            return `<li class="${i.ok ? "feito" : ""}">${corpo}</li>`;
        }).join("");
    }
    $("checklist").addEventListener("click", (e) => {
        const a = e.target.closest('[data-acao="foto"]');
        if (a) { e.preventDefault(); inputFoto.click(); }
    });

    // Atualiza os dados da conta com o servidor (foto, telefone, membro desde)
    async function sincronizarConta() {
        try {
            const d = await get(`/api/perfil/meu-perfil?id=${encodeURIComponent(uid)}`);
            if (!d.usuario) return;
            const { senha, ...novo } = d.usuario;
            Object.assign(usuario, novo); delete usuario.senha;
            if (novo.foto_perfil) usuario.fotoUrl = novo.foto_perfil;
            salvarSessao(); preencherPerfil();
        } catch { /* usa o que já está salvo */ }
    }

    // ---------------------------------------------------- SINCRONIZAÇÃO ENTRE ABAS
    addEventListener("storage", (e) => {
        if (e.key !== "usuario" && e.key !== "usuario_logado" && e.key !== null) return;
        const s = lerSessao();
        if (!s) location.replace(LOGIN);
        else if (String(s.dados.id ?? s.dados._id) !== String(uid)) location.reload();
    });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) carregarResumo(); });

    // -------------------------------------------------------------------- INIT
    preencherPerfil();
    carregarResumo();
    sincronizarConta();
})();