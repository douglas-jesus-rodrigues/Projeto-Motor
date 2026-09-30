"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const LOGIN_URL = "/pages/login.html";
    const PAINEL_CLIENTE = "/pages/painel-cliente.html";
    const TAMANHO_MAX_FOTO = 5 * 1024 * 1024;
    const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
    const $ = (id) => document.getElementById(id);

    // ==========================================
    // 1. SESSÃO (mesmas chaves dos outros painéis)
    // ==========================================
    function obterSessao() {
        for (const storage of [localStorage, sessionStorage]) {
            for (const chave of ["usuario", "usuario_logado"]) {
                const bruto = storage.getItem(chave);
                if (!bruto) continue;
                try {
                    const dados = JSON.parse(bruto);
                    if (dados && typeof dados === "object") return { dados, storage, chave };
                } catch {
                    storage.removeItem(chave);      // sessão corrompida: remove só ela e tenta a próxima
                }
            }
        }
        return null;
    }

    const sessao = obterSessao();
    if (!sessao) { window.location.replace(LOGIN_URL); return; }

    const usuario = sessao.dados;
    const tipo = String(usuario.tipo || "").toLowerCase().trim();
    if (tipo !== "empresa" && tipo !== "admin") { window.location.replace(PAINEL_CLIENTE); return; }

    const usuarioId = usuario.id ?? usuario._id ?? null;
    if (usuarioId === null) { window.location.replace(LOGIN_URL); return; }

    const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");
    const authHeaders = () => {
        const token = getToken();
        return { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) };
    };
    const salvarSessao = () => {
        try { sessao.storage.setItem(sessao.chave, JSON.stringify(usuario)); } catch { /* armazenamento cheio/bloqueado: ignora */ }
    };

    // ==========================================
    // 2. UTILITÁRIOS
    // ==========================================
    function toast(msg, tipoToast = "ok") {
        const t = document.createElement("div");
        t.className = `toast toast--${tipoToast}`;
        t.innerHTML = `<i class="fa-solid ${tipoToast === "erro" ? "fa-circle-exclamation" : "fa-circle-check"}"></i><span></span>`;
        t.querySelector("span").textContent = msg;
        $("toastArea").appendChild(t);
        requestAnimationFrame(() => t.classList.add("visivel"));
        setTimeout(() => { t.classList.remove("visivel"); setTimeout(() => t.remove(), 300); }, 3800);
    }

    function sessaoExpirada() {
        toast("Sessão expirada. Faça login novamente.", "erro");
        setTimeout(() => {
            [localStorage, sessionStorage].forEach((s) => ["usuario", "usuario_logado", "token"].forEach((k) => s.removeItem(k)));
            window.location.replace(LOGIN_URL);
        }, 1600);
    }

    // fetch com tempo limite, JSON seguro e tratamento de sessão expirada
    async function requisitar(url, opcoes = {}, tempoMs = 15000) {
        const controle = new AbortController();
        const relogio = setTimeout(() => controle.abort(), tempoMs);
        try {
            const resp = await fetch(url, { ...opcoes, signal: controle.signal });
            const dados = await resp.json().catch(() => ({}));
            if (resp.status === 401) { sessaoExpirada(); throw new Error("Sessão expirada. Faça login novamente."); }
            return { resp, dados };
        } catch (erro) {
            if (erro.name === "AbortError") throw new Error("O servidor demorou para responder. Tente novamente.");
            if (erro instanceof TypeError) throw new Error("Erro de conexão. Verifique sua internet e tente de novo.");
            throw erro;
        } finally {
            clearTimeout(relogio);
        }
    }

    // ==========================================
    // 3. MODAIS (um controle só: rolagem, foco, Esc)
    // ==========================================
    let modaisAbertos = 0;
    function abrirModal(el) {
        if (!el.hidden) return;
        el.hidden = false;
        modaisAbertos++;
        document.body.classList.add("sem-scroll");
    }
    function fecharModal(el) {
        if (el.hidden) return;
        el.hidden = true;
        modaisAbertos = Math.max(0, modaisAbertos - 1);
        if (!modaisAbertos) document.body.classList.remove("sem-scroll");
    }

    const modalConfirma = $("modalConfirma");
    let resolverConfirma = null, focoAnterior = null;

    function confirmar({ titulo, texto, botao = "Confirmar", perigo = true }) {
        return new Promise((resolve) => {
            if (resolverConfirma) resolverConfirma(false);          // nunca deixa uma confirmação pendurada
            resolverConfirma = resolve;
            focoAnterior = document.activeElement;
            $("confirmaTitulo").textContent = titulo;
            $("confirmaTexto").textContent = texto;
            $("confirmaOk").textContent = botao;
            abrirModal(modalConfirma);
            (perigo ? $("confirmaCancelar") : $("confirmaOk")).focus();
        });
    }
    function responderConfirma(resposta) {
        if (!resolverConfirma) return;
        const resolver = resolverConfirma;
        resolverConfirma = null;
        fecharModal(modalConfirma);
        if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
        resolver(resposta);
    }
    $("confirmaOk").addEventListener("click", () => responderConfirma(true));
    $("confirmaCancelar").addEventListener("click", () => responderConfirma(false));
    modalConfirma.addEventListener("click", (e) => { if (e.target === modalConfirma) responderConfirma(false); });

    // ==========================================
    // 4. CABEÇALHO DA EMPRESA
    // ==========================================
    // Os dados cadastrais ficam na página "Meus Dados" (/pages/perfil.html); aqui só o nome.
    const emp = usuario.empresa || {};
    const nomeEmpresa = emp.nome_empresa || usuario.nome_empresa || usuario.nome || "Empresa";
    $("nomeEmpresa").textContent = nomeEmpresa;
    document.title = `${nomeEmpresa} | Painel da Empresa | MotorFlex`;

    // ==========================================
    // 5. FOTO (com iniciais como reserva: sem serviço externo)
    // ==========================================
    const imgPerfil = $("imgPerfil");
    const iniciaisEl = $("avatarIniciais");
    const btnRemoverFoto = $("btnRemoverFoto");
    const inputFoto = $("inputFotoPerfil");
    const avatarWrapper = $("avatarWrapper");
    let fotoAtual = null;           // URL (sem cache-buster) da foto que está valendo
    let enviando = false;

    const partesNome = nomeEmpresa.split(/\s+/).filter(Boolean);
    iniciaisEl.textContent = partesNome.length ? (partesNome[0][0] + (partesNome[1] ? partesNome[1][0] : "")).toUpperCase() : "E";

    const resolverUrlFoto = (f) => (/^(https?:\/\/|\/)/.test(f) ? f : `/uploads/${f}`);
    const comCacheBuster = (url) => `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;

    function mostrarIniciais() {
        imgPerfil.onload = imgPerfil.onerror = null;
        imgPerfil.hidden = true;
        imgPerfil.removeAttribute("src");
        iniciaisEl.hidden = false;
        btnRemoverFoto.hidden = true;
    }

    function mostrarFoto(url, mostrarRemover = true) {
        imgPerfil.onload = () => { imgPerfil.hidden = false; iniciaisEl.hidden = true; btnRemoverFoto.hidden = !mostrarRemover; };
        imgPerfil.onerror = () => { fotoAtual = null; mostrarIniciais(); };     // imagem quebrada → iniciais
        imgPerfil.src = url;
    }

    function restaurarFoto() {
        if (fotoAtual) mostrarFoto(fotoAtual); else mostrarIniciais();
    }

    function setEnviando(sim) {
        enviando = sim;
        avatarWrapper.classList.toggle("enviando", sim);
        $("btnConfirmarRecorte").disabled = sim;
    }

    const fotoSalva = usuario.fotoUrl || usuario.foto_perfil;
    if (fotoSalva) { fotoAtual = resolverUrlFoto(fotoSalva); mostrarFoto(fotoAtual); }
    else mostrarIniciais();

    // ==========================================
    // 6. MENU DE CONFIGURAÇÕES E SAÍDA
    // ==========================================
    const btnConfig = $("btnConfig");
    const menuConfig = $("menuConfig");

    function fecharMenu() {
        menuConfig.classList.remove("mostrar");
        btnConfig.setAttribute("aria-expanded", "false");
    }
    btnConfig.addEventListener("click", (e) => {
        e.stopPropagation();
        btnConfig.setAttribute("aria-expanded", String(menuConfig.classList.toggle("mostrar")));
    });
    document.addEventListener("click", (e) => {
        if (!menuConfig.contains(e.target) && !btnConfig.contains(e.target)) fecharMenu();
    });

    function sair() {
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace(LOGIN_URL);
    }
    $("gatilhoSair").addEventListener("click", async (e) => {
        e.preventDefault();
        fecharMenu();
        const ok = await confirmar({
            titulo: "Confirmar saída",
            texto: "Tem certeza que deseja encerrar sua sessão na MotorFlex?",
            botao: "Sim, sair"
        });
        if (ok) sair();
    });

    // ==========================================
    // 7. UPLOAD COM RECORTE (CROPPER.JS)
    // ==========================================
    const modalRecorte = $("modalRecorte");
    const imagemParaCortar = $("imagemParaCortar");
    let cropper = null;

    function fecharRecorte() {
        fecharModal(modalRecorte);
        if (cropper) { cropper.destroy(); cropper = null; }
        imagemParaCortar.removeAttribute("src");
        inputFoto.value = "";
    }

    $("btnTrocarFoto").addEventListener("click", () => { if (!enviando) inputFoto.click(); });

    inputFoto.addEventListener("change", (e) => {
        const arquivo = e.target.files[0];
        if (!arquivo) return;

        // Se a biblioteca de recorte não carregou (CDN fora do ar), avisa em vez de quebrar
        if (typeof Cropper === "undefined") {
            toast("O editor de imagem não carregou. Verifique sua conexão e recarregue a página.", "erro");
            inputFoto.value = "";
            return;
        }
        if (!TIPOS_FOTO.includes(arquivo.type)) {
            toast("Envie uma imagem JPEG, PNG ou WEBP.", "erro");
            inputFoto.value = "";
            return;
        }
        if (arquivo.size > TAMANHO_MAX_FOTO) {
            toast("A foto deve ter no máximo 5MB.", "erro");
            inputFoto.value = "";
            return;
        }

        const leitor = new FileReader();
        leitor.onload = (ev) => {
            imagemParaCortar.src = ev.target.result;
            abrirModal(modalRecorte);
            if (cropper) cropper.destroy();
            cropper = new Cropper(imagemParaCortar, {
                aspectRatio: 1, viewMode: 1, dragMode: "move", autoCropArea: 0.8,
                guides: false, responsive: true, toggleDragModeOnDblclick: false
            });
        };
        leitor.onerror = () => { toast("Não foi possível ler a imagem.", "erro"); inputFoto.value = ""; };
        leitor.readAsDataURL(arquivo);
    });

    $("btnCancelarRecorte").addEventListener("click", fecharRecorte);
    modalRecorte.addEventListener("click", (e) => { if (e.target === modalRecorte) fecharRecorte(); });

    $("btnConfirmarRecorte").addEventListener("click", () => {
        if (!cropper || enviando) return;

        const canvas = cropper.getCroppedCanvas({ width: 400, height: 400, imageSmoothingQuality: "high" });
        if (!canvas) { toast("Não foi possível recortar a imagem.", "erro"); return; }

        setEnviando(true);
        canvas.toBlob(async (blob) => {
            if (!blob) { toast("Não foi possível processar a imagem.", "erro"); setEnviando(false); return; }

            const arquivo = new File([blob], "foto-perfil.png", { type: "image/png" });
            const preview = URL.createObjectURL(arquivo);
            fecharRecorte();
            mostrarFoto(preview, false);                // prévia imediata enquanto envia

            const formData = new FormData();
            formData.append("fotoPerfil", arquivo);
            formData.append("usuarioId", usuarioId);

            try {
                const token = getToken();
                const { resp, dados } = await requisitar("/api/perfil/upload-foto", {
                    method: "POST",
                    headers: token ? { Authorization: `Bearer ${token}` } : {},   // sem Content-Type: o navegador define o multipart
                    body: formData
                }, 30000);

                if (!resp.ok || dados.sucesso === false) throw new Error(dados.mensagem || "Erro no servidor ao salvar a imagem.");

                const nova = dados.fotoUrl || dados.foto_perfil;
                if (!nova) throw new Error("A foto foi enviada, mas o servidor não informou o novo endereço. Recarregue a página.");

                fotoAtual = resolverUrlFoto(nova);
                usuario.fotoUrl = nova;
                usuario.foto_perfil = nova;
                salvarSessao();
                mostrarFoto(comCacheBuster(fotoAtual));  // evita mostrar a versão antiga em cache
                toast("Foto atualizada com sucesso!");
            } catch (erro) {
                console.error("Falha no upload:", erro);
                toast(erro.message || "Não foi possível salvar a foto.", "erro");
                restaurarFoto();
            } finally {
                URL.revokeObjectURL(preview);
                setEnviando(false);
            }
        }, "image/png");
    });

    btnRemoverFoto.addEventListener("click", async () => {
        if (enviando) return;
        const ok = await confirmar({
            titulo: "Remover foto?",
            texto: "A foto da empresa será removida e o painel voltará a mostrar as iniciais.",
            botao: "Sim, remover"
        });
        if (!ok) return;

        setEnviando(true);
        try {
            const { resp, dados } = await requisitar("/api/perfil/remover-foto", {
                method: "DELETE",
                headers: authHeaders(),
                body: JSON.stringify({ usuarioId })
            });
            if (!resp.ok || dados.sucesso === false) throw new Error(dados.mensagem || "Não foi possível remover a foto.");

            fotoAtual = null;
            usuario.fotoUrl = null;
            usuario.foto_perfil = null;
            salvarSessao();
            mostrarIniciais();
            toast("Foto removida com sucesso!");
        } catch (erro) {
            console.error("Falha ao remover foto:", erro);
            toast(erro.message || "Erro de conexão ao remover a foto.", "erro");
        } finally {
            setEnviando(false);
        }
    });

    // Esc fecha o que estiver aberto (do mais "em cima" para o mais "embaixo")
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (!modalConfirma.hidden) responderConfirma(false);
        else if (!modalRecorte.hidden) fecharRecorte();
        else fecharMenu();
    });

    // ==========================================
    // 8. RESUMO (a lista completa fica em /pages/meus-anuncios.html)
    // ==========================================
    const formatarNumero = (n) => Number(n).toLocaleString("pt-BR");

    async function carregarResumo() {
        const elVeiculos = $("totalVeiculos"), elVisualizacoes = $("totalVisualizacoes");
        try {
            const { resp, dados } = await requisitar("/api/veiculos");
            if (!resp.ok || !dados.sucesso || !Array.isArray(dados.veiculos)) throw new Error("Resposta inválida do servidor.");

            const meus = dados.veiculos.filter((v) => String(v.usuario_id) === String(usuarioId));
            elVeiculos.textContent = formatarNumero(meus.length);

            // Só soma visualizações se o servidor realmente enviar esse campo
            const contaViews = (v) => v.visualizacoes ?? v.views;
            elVisualizacoes.textContent = meus.some((v) => contaViews(v) != null)
                ? formatarNumero(meus.reduce((soma, v) => soma + (Number(contaViews(v)) || 0), 0))
                : "–";
        } catch (erro) {
            console.error("Erro ao carregar resumo:", erro);
            elVeiculos.textContent = "–";
            elVisualizacoes.textContent = "–";
        } finally {
            $("stats").classList.remove("carregando");
            // "Conversas" ainda não tem endpoint neste painel: continua "–" em vez de mostrar um 0 enganoso.
        }
    }

    carregarResumo();
});