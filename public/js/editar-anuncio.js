"use strict";
/* ==========================================================================
   MOTORFLEX — EDITAR ANÚNCIO (dados + troca de foto)
   Envia um único PUT multipart para /api/veiculos/:id (campos + imagem opcional).
   ========================================================================== */
(() => {
    const LOGIN = "/pages/login.html";
    const LISTA = "/pages/meus-anuncios.html";
    const MAX_FOTO_BYTES = 5 * 1024 * 1024;
    const FOTO_MAX_LADO = 1600;

    const $ = (id) => document.getElementById(id);
    const ANO_MAX = new Date().getFullYear() + 1;
    const CAMPOS = ["marca", "modelo", "versao", "ano_fabricacao", "ano_modelo", "combustivel", "cambio", "carroceria", "portas", "cor", "quilometragem", "preco", "descricao"];

    let me = null, veiculoId = null;
    let original = "", fotoOriginal = "", fotoArquivo = null, fotoBlobUrl = "";
    let salvando = false, salvo = false;

    // ------------------------------------------------------------------ SESSÃO
    function lerUsuario() {
        for (const st of [localStorage, sessionStorage]) {
            for (const k of ["usuario", "usuario_logado"]) {
                try {
                    const u = JSON.parse(st.getItem(k));
                    const b = u && typeof u.usuario === "object" ? u.usuario : u;
                    if (b && b.id != null) return { ...b, tipo: String(b.tipo || "individual").toLowerCase() };
                } catch { /* tenta a próxima */ }
            }
        }
        return null;
    }
    const token = () => localStorage.getItem("token") || sessionStorage.getItem("token");
    const authHeaders = () => (token() ? { Authorization: `Bearer ${token()}` } : {});

    // ------------------------------------------------------------------- TOAST
    function toast(msg, tipo = "ok") {
        const t = document.createElement("div");
        t.className = `toast ${tipo === "erro" ? "erro" : ""}`;
        t.textContent = (tipo === "erro" ? "⚠️ " : "✨ ") + msg;
        $("toastArea").appendChild(t);
        requestAnimationFrame(() => t.classList.add("on"));
        setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 300); }, 3600);
    }

    // ---------------------------------------------------------------- HELPERS
    const soDigitos = (s) => String(s ?? "").replace(/\D/g, "");
    const milhar = (n) => (n === "" || n == null ? "" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."));
    const valor = (id) => ($(id)?.value ?? "").trim();
    const brl = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    const urlFoto = (f) => (f ? (/^(\/|https?:)/.test(f) ? f : `/uploads/${f}`) : "");

    function setSelect(id, v) {
        const el = $(id);
        if (!el || v == null || v === "") return;
        if (![...el.options].some((o) => o.value === String(v))) {           // valor fora da lista: cria a opção
            const o = document.createElement("option"); o.value = o.textContent = String(v); el.appendChild(o);
        }
        el.value = String(v);
    }

    const snapshot = () => JSON.stringify(CAMPOS.map(valor));
    const sujo = () => snapshot() !== original || !!fotoArquivo;

    function atualizarEstado() {
        const s = $("estadoSalvo"), d = sujo();
        s.textContent = d ? "Alterações não salvas" : "Sem alterações";
        s.classList.toggle("sujo", d);
    }

    function atualizarResumo() {
        const titulo = `${valor("marca")} ${valor("modelo")}`.trim();
        $("resumoTitulo").textContent = titulo || "—";
        $("resumoVersao").textContent = valor("versao");
        $("resumoPreco").textContent = brl(soDigitos(valor("preco")));
        const chips = [];
        const af = valor("ano_fabricacao"), am = valor("ano_modelo");
        if (af) chips.push(am && am !== af ? `${af}/${am}` : af);
        const km = soDigitos(valor("quilometragem")); if (km) chips.push(`${milhar(km)} km`);
        const comb = $("combustivel").selectedOptions[0]; if (comb && comb.value) chips.push(comb.textContent);
        const cam = $("cambio").selectedOptions[0]; if (cam && cam.value) chips.push(cam.textContent);
        if (valor("carroceria")) chips.push(valor("carroceria"));
        if (valor("cor")) chips.push(valor("cor"));
        $("resumoChips").innerHTML = "";
        chips.forEach((c) => { const s = document.createElement("span"); s.className = "chip"; s.textContent = c; $("resumoChips").appendChild(s); });
    }

    // ------------------------------------------------------------- VALIDAÇÃO
    function erro(id, msg) {
        const g = $(id).closest(".input-group");
        g.classList.toggle("invalido", !!msg);
        g.querySelector(".msg-erro")?.remove();
        if (msg) { const p = document.createElement("p"); p.className = "msg-erro"; p.textContent = msg; g.appendChild(p); }
    }
    function validar() {
        const e = {};
        if (!valor("marca")) e.marca = "Informe a marca.";
        if (!valor("modelo")) e.modelo = "Informe o modelo.";
        const af = Number(valor("ano_fabricacao")), am = Number(valor("ano_modelo"));
        if (!af || af < 1900 || af > ANO_MAX) e.ano_fabricacao = `Ano entre 1900 e ${ANO_MAX}.`;
        if (!am || am < 1900 || am > ANO_MAX + 1) e.ano_modelo = `Ano entre 1900 e ${ANO_MAX + 1}.`;
        else if (af && (am < af || am > af + 1)) e.ano_modelo = "O ano do modelo é igual ou 1 ano maior que o de fabricação.";
        if (!valor("combustivel")) e.combustivel = "Selecione o combustível.";
        if (!valor("cambio")) e.cambio = "Selecione o câmbio.";
        if (!Number(soDigitos(valor("preco")))) e.preco = "Informe um valor maior que zero.";
        CAMPOS.forEach((id) => erro(id, e[id]));
        const primeiro = Object.keys(e)[0];
        if (primeiro) { $(primeiro).focus(); $(primeiro).scrollIntoView({ block: "center", behavior: "smooth" }); }
        return !primeiro;
    }

    // ----------------------------------------------------------------- MÁSCARAS
    function mascaras() {
        ["ano_fabricacao", "ano_modelo"].forEach((id) => $(id).addEventListener("input", (e) => { e.target.value = soDigitos(e.target.value).slice(0, 4); }));
        ["preco", "quilometragem"].forEach((id) => $(id).addEventListener("input", (e) => {
            const d = soDigitos(e.target.value).replace(/^0+(?=\d)/, "");
            e.target.value = milhar(d);
        }));
        $("descricao").addEventListener("input", () => { $("contadorDescricao").textContent = `${$("descricao").value.length} / 1000`; });

        document.querySelector("form").addEventListener("click", (e) => {
            const b = e.target.closest(".btn-step");
            if (!b) return;
            const input = $(b.dataset.alvo), passo = Number(b.dataset.passo), min = Number(b.dataset.min);
            const base = Number(soDigitos(input.value)) || (min === 1900 ? new Date().getFullYear() : 0);
            const max = b.dataset.alvo.startsWith("ano") ? ANO_MAX + 1 : Infinity;
            const novo = Math.min(max, Math.max(min, base + passo));
            input.value = b.dataset.alvo === "quilometragem" ? milhar(novo) : String(novo);
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });
    }

    // -------------------------------------------------------------------- DADOS
    async function carregarOpcoes() {
        const preencher = async (url, id, rotulo) => {
            const sel = $(id);
            try {
                const r = await fetch(url);
                if (!r.ok) throw new Error(r.status);
                const j = await r.json();
                const lista = Array.isArray(j) ? j : (j.combustiveis || j.cambios || j.dados || []);
                sel.innerHTML = `<option value="">${rotulo}</option>` + lista.map((o) => `<option value="${o.id}">${o.nome}</option>`).join("");
            } catch (e) { console.error("Erro ao carregar", url, e); sel.innerHTML = `<option value="">Erro ao carregar</option>`; }
        };
        await Promise.all([
            preencher("/api/combustiveis", "combustivel", "Selecione o combustível..."),
            preencher("/api/cambios", "cambio", "Selecione o câmbio...")
        ]);
    }

    function mostrarFoto(src, novo) {
        const img = $("fotoPreview");
        if (src) { img.src = src; img.hidden = false; } else { img.removeAttribute("src"); img.hidden = true; }
        $("fotoVazia").hidden = !!src;
        $("fotoBadge").hidden = !novo;
        $("btnDesfazerFoto").hidden = !novo;
        $("btnTrocarFoto").textContent = src ? "Trocar foto" : "Adicionar foto";
    }

    async function carregarVeiculo() {
        try {
            const r = await fetch(`/api/veiculos/${encodeURIComponent(veiculoId)}`, { headers: authHeaders() });
            const j = await r.json().catch(() => ({}));
            const v = j.veiculo || null;
            if (!r.ok || !v) throw new Error(j.mensagem || "Veículo não encontrado.");

            if (v.usuario_id != null && String(v.usuario_id) !== String(me.id) && me.tipo !== "admin") {
                toast("Você não tem permissão para editar este anúncio.", "erro");
                setTimeout(() => location.replace(LISTA), 1500);
                return false;
            }

            $("veiculo-id").value = v.id;
            $("marca").value = v.marca || v.marca_nome || "";
            $("modelo").value = v.modelo || v.modelo_nome || "";
            $("versao").value = v.versao || "";
            $("ano_fabricacao").value = v.ano_fabricacao || v.ano || "";
            $("ano_modelo").value = v.ano_modelo || "";
            $("quilometragem").value = milhar(v.quilometragem ?? "");
            $("preco").value = milhar(Math.round(Number(v.preco) || 0) || "");
            $("cor").value = v.cor || "";
            $("descricao").value = v.descricao || "";
            setSelect("combustivel", v.tipo_combustivel_id);
            setSelect("cambio", v.tipo_transmissao_id);
            setSelect("carroceria", v.carroceria);
            setSelect("portas", v.portas);

            fotoOriginal = urlFoto(v.imagem);
            mostrarFoto(fotoOriginal, false);
            $("contadorDescricao").textContent = `${$("descricao").value.length} / 1000`;
            return true;
        } catch (e) {
            console.error("Erro ao carregar veículo:", e);
            toast(e.message || "Erro ao carregar o anúncio.", "erro");
            setTimeout(() => location.replace(LISTA), 1800);
            return false;
        }
    }

    // --------------------------------------------------------------------- FOTO
    // Reduz fotos grandes (lado máx. 1600px, JPEG) para caber no limite de 5MB e enviar mais rápido
    function comprimir(file) {
        return new Promise((resolve) => {
            if (file.size < 700 * 1024 && /jpe?g|webp/.test(file.type)) return resolve(file);
            const url = URL.createObjectURL(file), img = new Image();
            img.onload = () => {
                const esc = Math.min(1, FOTO_MAX_LADO / Math.max(img.width, img.height));
                const c = document.createElement("canvas");
                c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
                const ctx = c.getContext("2d");
                ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);       // PNG transparente → fundo branco
                ctx.drawImage(img, 0, 0, c.width, c.height);
                URL.revokeObjectURL(url);
                c.toBlob((b) => resolve(b ? new File([b], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file), "image/jpeg", 0.86);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
            img.src = url;
        });
    }

    async function escolherFoto(file) {
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast("Use uma imagem JPG, PNG ou WebP.", "erro");
        const pronto = await comprimir(file);
        if (pronto.size > MAX_FOTO_BYTES) return toast("A imagem continua acima de 5MB. Escolha outra.", "erro");
        if (fotoBlobUrl) URL.revokeObjectURL(fotoBlobUrl);
        fotoArquivo = pronto;
        fotoBlobUrl = URL.createObjectURL(pronto);
        mostrarFoto(fotoBlobUrl, true);
        atualizarEstado();
    }
    function desfazerFoto() {
        fotoArquivo = null;
        if (fotoBlobUrl) { URL.revokeObjectURL(fotoBlobUrl); fotoBlobUrl = ""; }
        $("inputFoto").value = "";
        mostrarFoto(fotoOriginal, false);
        atualizarEstado();
    }

    function eventosFoto() {
        const dz = $("dropzone"), input = $("inputFoto");
        const abrir = () => input.click();
        dz.addEventListener("click", abrir);
        dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } });
        $("btnTrocarFoto").addEventListener("click", abrir);
        $("btnDesfazerFoto").addEventListener("click", desfazerFoto);
        input.addEventListener("change", () => escolherFoto(input.files[0]));
        ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("arrastando"); }));
        ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("arrastando"); }));
        dz.addEventListener("drop", (e) => escolherFoto(e.dataTransfer.files[0]));
    }

    // ------------------------------------------------------------------- SALVAR
    function botao(carregando) {
        const b = $("btnSalvar");
        b.disabled = carregando;
        b.querySelector(".spinner").hidden = !carregando;
        b.querySelector(".txt").textContent = carregando ? "Salvando..." : "Salvar alterações";
    }

    async function salvar() {
        if (salvando) return;
        if (!lerUsuario() || String(lerUsuario().id) !== String(me.id)) { location.replace(LOGIN); return; }
        if (!validar()) return;

        salvando = true; botao(true);
        const fd = new FormData();
        fd.append("usuario_id", me.id);
        fd.append("marca", valor("marca")); fd.append("modelo", valor("modelo")); fd.append("versao", valor("versao"));
        fd.append("ano_fabricacao", valor("ano_fabricacao")); fd.append("ano_modelo", valor("ano_modelo"));
        fd.append("combustivel", valor("combustivel")); fd.append("cambio", valor("cambio"));
        fd.append("carroceria", valor("carroceria")); fd.append("portas", valor("portas")); fd.append("cor", valor("cor"));
        fd.append("quilometragem", soDigitos(valor("quilometragem")) || "0");
        fd.append("preco", soDigitos(valor("preco")));
        fd.append("descricao", valor("descricao"));
        if (fotoArquivo) fd.append("imagem", fotoArquivo, fotoArquivo.name);

        try {
            const r = await fetch(`/api/veiculos/${encodeURIComponent(veiculoId)}`, { method: "PUT", headers: authHeaders(), body: fd });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || j.sucesso === false) throw new Error(j.mensagem || "Erro ao atualizar o anúncio.");

            salvo = true;
            toast("Anúncio atualizado com sucesso!");
            setTimeout(() => location.href = LISTA, 1200);
        } catch (e) {
            console.error("Erro ao salvar:", e);
            toast(e.message || "Erro de conexão.", "erro");
            botao(false);
        } finally { salvando = false; }
    }

    // --------------------------------------------------------------------- INIT
    document.addEventListener("DOMContentLoaded", async () => {
        me = lerUsuario();
        if (!me) { location.replace(LOGIN); return; }

        veiculoId = new URLSearchParams(location.search).get("id");
        if (!veiculoId) { toast("ID do veículo não encontrado!", "erro"); setTimeout(() => location.replace(LISTA), 1500); return; }

        mascaras();
        eventosFoto();

        await carregarOpcoes();
        if (!(await carregarVeiculo())) return;

        original = snapshot();
        atualizarResumo(); atualizarEstado();
        $("form-editar-anuncio").classList.remove("carregando");

        const form = $("form-editar-anuncio");
        form.addEventListener("input", (e) => {
            if (e.target.closest(".input-group.invalido")) erro(e.target.id, "");
            atualizarResumo(); atualizarEstado();
        });
        form.addEventListener("change", () => { atualizarResumo(); atualizarEstado(); });
        form.addEventListener("submit", (e) => { e.preventDefault(); salvar(); });

        // Ctrl/Cmd + S salva
        document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); form.requestSubmit(); } });

        // Confirma antes de sair com alterações pendentes
        window.addEventListener("beforeunload", (e) => { if (!salvo && sujo()) { e.preventDefault(); e.returnValue = ""; } });
        const sair = (e) => { if (sujo() && !confirm("Você tem alterações não salvas. Deseja sair mesmo assim?")) e.preventDefault(); else salvo = true; };
        $("btnCancelar").addEventListener("click", sair);
        $("linkVoltar").addEventListener("click", sair);
    });
})();