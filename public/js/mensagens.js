document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. VERIFICAÇÃO DE SESSÃO DO USUÁRIO ---
    const usuarioLogadoStr = localStorage.getItem("usuario");
    if (!usuarioLogadoStr || usuarioLogadoStr === "undefined" || usuarioLogadoStr === "null") {
        window.location.replace("/pages/login.html");
        return;
    }

    let usuarioAtual;
    try {
        usuarioAtual = JSON.parse(usuarioLogadoStr);
    } catch (e) {
        localStorage.removeItem("usuario");
        window.location.replace("/pages/login.html");
        return;
    }

    // Elementos do DOM
    const conversasList = document.getElementById("conversasList");
    const chatEmptyState = document.getElementById("chatEmptyState");
    const chatActiveBox = document.getElementById("chatActiveBox");
    const chatDestinatarioNome = document.getElementById("chatDestinatarioNome");
    const chatDestinatarioFoto = document.getElementById("chatDestinatarioFoto");
    const chatVeiculoRef = document.getElementById("chatVeiculoRef");
    const chatMessagesScroll = document.getElementById("chatMessagesScroll");
    const chatForm = document.getElementById("chatForm");
    const inputMensagem = document.getElementById("inputMensagem");
    const totalConversas = document.getElementById("totalConversas");
    const inputPesquisaConversa = document.getElementById("inputPesquisaConversa");

    let conversaAtivaId = null;
    let destinatarioAtualId = null;
    let listaConversasCache = [];

    // Função auxiliar para sanitizar caminhos de imagens do servidor
    function sanitizarSrcImagem(src) {
        if (typeof src !== "string" || !src) return "/imagens/sem-foto.jpg";
        if (src.startsWith("/") || src.startsWith("https://") || src.startsWith("http://")) return src;
        return `/uploads/${src}`;
    }

    // --- 2. CARREGAR CONVERSAS DA API / BANCO DE DADOS ---
    async function carregarConversas() {
        try {
            const resposta = await fetch(`/api/mensagens/conversas?usuarioId=${usuarioAtual.id}`);
            if (resposta.ok) {
                const dados = await resposta.json();
                if (dados.sucesso && Array.isArray(dados.conversas)) {
                    listaConversasCache = dados.conversas;
                    renderizarConversas(listaConversasCache);
                } else {
                    conversasList.innerHTML = `<div class="chat-loading" style="padding:20px;text-align:center;color:var(--text-faint);">Nenhuma conversa encontrada.</div>`;
                }
            }
        } catch (erro) {
            console.error("Erro ao comunicar com a API de mensagens:", erro);
            conversasList.innerHTML = `<div class="chat-loading" style="padding:20px;text-align:center;color:var(--danger);">Erro ao carregar conversas.</div>`;
        }
    }

    // --- 3. RENDERIZAR LISTA DE CONVERSAS NA SIDEBAR ---
    function renderizarConversas(conversas) {
        if (totalConversas) totalConversas.textContent = conversas.length;

        if (conversas.length === 0) {
            conversasList.innerHTML = `<div class="chat-loading" style="padding:20px;text-align:center;color:var(--text-faint);">Sem conversas ativas.</div>`;
            return;
        }

        conversasList.innerHTML = conversas.map(c => `
            <div class="conversa-item ${String(c.id) === String(conversaAtivaId) ? 'ativo' : ''}" 
                 data-id="${c.id}" 
                 data-destinatario="${c.outro_usuario_id}" 
                 data-veiculo="${escapeHTML(c.veiculo_nome || 'Veículo MotorFlex')}">
                <img src="${sanitizarSrcImagem(c.outro_usuario_foto)}" alt="Avatar" onerror="this.src='/imagens/sem-foto.jpg'">
                <div class="conversa-info">
                    <h4>${escapeHTML(c.outro_usuario_nome || 'Utilizador')}</h4>
                    <p>${escapeHTML(c.ultima_mensagem || 'Inicie a conversa...')}</p>
                </div>
            </div>
        `).join("");
    }

    // Filtro em tempo real na barra de pesquisa de conversas
    inputPesquisaConversa?.addEventListener("input", (e) => {
        const termo = e.target.value.trim().toLowerCase();
        const filtradas = listaConversasCache.filter(c => {
            const nome = (c.outro_usuario_nome || "").toLowerCase();
            const veiculo = (c.veiculo_nome || "").toLowerCase();
            return nome.includes(termo) || veiculo.includes(termo);
        });
        renderizarConversas(filtradas);
    });

    // --- 4. SELECIONAR UMA CONVERSA ESPECÍFICA ---
    conversasList?.addEventListener("click", (e) => {
        const item = e.target.closest(".conversa-item");
        if (!item) return;

        document.querySelectorAll(".conversa-item").forEach(el => el.classList.remove("ativo"));
        item.classList.add("ativo");

        conversaAtivaId = item.getAttribute("data-id");
        destinatarioAtualId = item.getAttribute("data-destinatario");
        const veiculoNome = item.getAttribute("data-veiculo");
        const nomeOutro = item.querySelector("h4").textContent;
        const fotoOutro = item.querySelector("img").src;

        // Revela a área ativa do chat
        if (chatEmptyState) chatEmptyState.style.display = "none";
        if (chatActiveBox) chatActiveBox.style.display = "flex";
        
        if (chatDestinatarioNome) chatDestinatarioNome.textContent = nomeOutro;
        if (chatDestinatarioFoto) chatDestinatarioFoto.src = fotoOutro;
        if (chatVeiculoRef) chatVeiculoRef.textContent = `Negociação: ${veiculoNome}`;

        carregarMensagens(conversaAtivaId);
    });

    // --- 5. CARREGAR MENSAGENS DA TABELA `mensagens` ---
    async function carregarMensagens(conversaId) {
        try {
            const resposta = await fetch(`/api/mensagens?conversaId=${conversaId}`);
            if (resposta.ok) {
                const dados = await resposta.json();
                if (dados.sucesso && Array.isArray(dados.mensagens)) {
                    chatMessagesScroll.innerHTML = dados.mensagens.map(m => {
                        // Compara o remetente da mensagem com o ID do usuário logado no BD
                        const ehMinha = Number(m.remetente_id) === Number(usuarioAtual.id);
                        return `
                            <div class="msg-bubble ${ehMinha ? 'enviada' : 'recebida'}">
                                ${escapeHTML(m.texto)}
                            </div>
                        `;
                    }).join("");
                    chatMessagesScroll.scrollTop = chatMessagesScroll.scrollHeight;
                }
            }
        } catch (e) {
            console.error("Erro ao carregar mensagens do banco de dados:", e);
        }
    }

    // --- 6. ENVIAR NOVA MENSAGEM (PERSISTÊNCIA NO BD) ---
    chatForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const texto = inputMensagem.value.trim();
        if (!texto || !conversaAtivaId) return;

        inputMensagem.value = "";

        // Adiciona instantaneamente no DOM (Optimistic UI para máxima fluidez)
        chatMessagesScroll.innerHTML += `
            <div class="msg-bubble enviada">${escapeHTML(texto)}</div>
        `;
        chatMessagesScroll.scrollTop = chatMessagesScroll.scrollHeight;

        try {
            await fetch("/api/mensagens", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    conversa_id: conversaAtivaId,
                    remetente_id: usuarioAtual.id,
                    destinatario_id: destinatarioAtualId,
                    texto: texto
                })
            });
        } catch (erro) {
            console.error("Erro ao persistir mensagem no banco de dados:", erro);
        }
    });

    // Função de segurança contra Injeção HTML (XSS)
    function escapeHTML(str) {
        if (!typeof str === "string") return "";
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // Inicialização automática ao entrar na página
    carregarConversas();
});