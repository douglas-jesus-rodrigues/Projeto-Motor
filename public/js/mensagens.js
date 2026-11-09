"use strict";

// ==========================================================
// CONFIGURAÇÕES E ESTADO GLOBAL
// ==========================================================
const API_URL = "/api/conversas";
const LOGIN_URL = "/pages/login.html";

// Emojis pré-definidos para o painel de emojis
const EMOJIS = ["👍", "👋", "🚗", "🤝", "💰", "🔑", "😃", "🤔", "✅", "🙏", "📲", "⚡"];

// Respostas rápidas padronizadas para negociações
const RESPOSTAS_RAPIDAS = [
    "Olá! O veículo ainda está disponível?",
    "Aceita troca?",
    "Qual o menor valor à vista?",
    "Podemos agendar uma visita/test drive?",
    "Onde o veículo está localizado?"
];

let conversaAtivaId = null;
let meuUsuarioId = null;
let listaConversasGlobal = [];
let intervaloPolling = null;
let filtroAtual = "todas";
let termoBusca = "";

// Função utilitária para pegar elementos por ID
const $ = (id) => document.getElementById(id);

// ==========================================================
// SESSÃO E NAVEGAÇÃO
// ==========================================================
function obterSessao() {
    const bruto =
        localStorage.getItem("usuario") || localStorage.getItem("usuario_logado") ||
        sessionStorage.getItem("usuario") || sessionStorage.getItem("usuario_logado");
    try { return bruto ? JSON.parse(bruto) : null; } catch { return null; }
}

function obterToken() {
    return localStorage.getItem("token") || sessionStorage.getItem("token");
}

function configurarNavegacao(sessao) {
    const btnVoltar = $("btnVoltar");
    const btnTexto = $("btnVoltarTexto");
    
    if (!btnVoltar) return;

    // 1. Volta exatamente para a página anterior que o utilizador estava
    btnVoltar.addEventListener("click", (evt) => {
        if (document.referrer && document.referrer.includes(window.location.host)) {
            evt.preventDefault();
            window.history.back();
        }
    });

    // 2. Fallback caso não exista histórico anterior (ex: abriu o link diretamente numa nova aba)
    const tipo = String(sessao?.tipo || "individual").toLowerCase();
    if (tipo === "admin") {
        btnVoltar.href = "/pages/painel-admin.html";
        if (btnTexto) btnTexto.textContent = "Painel Admin";
    } else if (tipo === "empresa") {
        btnVoltar.href = "/pages/painel-empresa.html";
        if (btnTexto) btnTexto.textContent = "Painel Empresa";
    } else {
        btnVoltar.href = "/pages/catalogo.html";
        if (btnTexto) btnTexto.textContent = "Voltar";
    }
}

// ==========================================================
// SERVIÇOS DE API
// ==========================================================
async function requisitarApi(caminho, opcoes = {}) {
    const token = obterToken();
    const headers = {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...opcoes.headers
    };

    const resp = await fetch(`${API_URL}${caminho}`, { ...opcoes, headers });
    
    if (resp.status === 401) {
        localStorage.removeItem("token");
        sessionStorage.clear();
        window.location.href = LOGIN_URL;
        throw new Error("Sessão expirada");
    }

    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(dados.erro || dados.mensagem || `Erro ${resp.status}`);
    return dados;
}

// ==========================================================
// AVISOS (TOASTS)
// ==========================================================
function exibirToast(msg, tipo = "ok") {
    const area = $("toastArea");
    if (!area) return;

    const toast = document.createElement("div");
    toast.className = `toast ${tipo === "erro" ? "erro" : ""}`;
    toast.innerHTML = `<div><b>MotorFlex</b><span>${esc(msg)}</span></div>`;
    area.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("on"));
    setTimeout(() => {
        toast.classList.remove("on");
        setTimeout(() => toast.remove(), 200);
    }, 3500);
}

function esc(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

// ==========================================================
// RENDERIZAÇÃO DA SIDEBAR (LISTA DE CONVERSAS)
// ==========================================================
async function carregarConversas(silencioso = false) {
    try {
        const dados = await requisitarApi("/");
        listaConversasGlobal = dados.conversas || [];

        if ($("totalConversas")) $("totalConversas").textContent = listaConversasGlobal.length;

        aplicarFiltrosEBusca();
    } catch (erro) {
        if (!silencioso) {
            console.error("Erro ao carregar conversas:", erro);
            const container = $("conversasList");
            if (container) container.innerHTML = `<div class="chat-loading">Erro ao carregar conversas.</div>`;
        }
    }
}

function aplicarFiltrosEBusca() {
    const termo = termoBusca.toLowerCase().trim();

    const filtradas = listaConversasGlobal.filter((c) => {
        const nomeOutro = (c.outro_usuario_nome || "").toLowerCase();
        const modeloVeic = (c.veiculo_modelo || "").toLowerCase();
        const marcaVeic = (c.veiculo_marca || "").toLowerCase();

        const bateBusca = !termo || nomeOutro.includes(termo) || modeloVeic.includes(termo) || marcaVeic.includes(termo);

        if (filtroAtual === "nao-lidas") {
            return bateBusca && c.tem_nova; 
        }
        return bateBusca;
    });

    renderizarListaSidebar(filtradas);
}

function renderizarListaSidebar(conversas) {
    const container = $("conversasList");
    if (!container) return;

    if (!conversas.length) {
        container.innerHTML = `
            <div class="lista-vazia">
                <i class="fa-regular fa-comments"></i>
                Nenhuma conversa encontrada.
            </div>`;
        return;
    }

    container.innerHTML = conversas.map((c) => {
        const ativaClass = c.id === conversaAtivaId ? "ativo" : "";
        const novaClass = c.tem_nova ? "tem-nova" : "";
        const iniciais = (c.outro_usuario_nome || "U").substring(0, 2).toUpperCase();
        
        let horaFormatada = "";
        if (c.ultimo_envio || c.criado_em) {
            const data = new Date(c.ultimo_envio || c.criado_em);
            horaFormatada = data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        const veiculoTxt = c.veiculo_modelo ? `${c.veiculo_marca || ""} ${c.veiculo_modelo}` : "Negociação Geral";

        return `
            <div class="conversa-item ${ativaClass} ${novaClass}" data-id="${c.id}" tabindex="0">
                <div class="av av-md">
                    ${c.foto_perfil ? `<img src="${esc(c.foto_perfil)}" alt="Foto">` : iniciais}
                </div>
                <div class="conversa-info">
                    <div class="conversa-linha">
                        <h4>${esc(c.outro_usuario_nome || "Usuário")}</h4>
                        <span class="conversa-hora">${horaFormatada}</span>
                    </div>
                    <div class="conversa-linha">
                        <p>${esc(c.ultima_mensagem || "Conversa iniciada")}</p>
                    </div>
                    <span class="conversa-veic"><i class="fa-solid fa-car-side"></i> ${esc(veiculoTxt)}</span>
                </div>
            </div>`;
    }).join("");
}

// ==========================================================
// CHAT ATIVO E MENSAGENS
// ==========================================================
async function abrirConversa(conversaId) {
    conversaAtivaId = Number(conversaId);

    // Ajusta visual no mobile
    const wrapper = $("chatWrapper");
    if (wrapper) wrapper.classList.add("em-conversa");

    // Mostra área do chat e esconde o empty state
    if ($("chatEmptyState")) $("chatEmptyState").hidden = true;
    if ($("chatActiveBox")) $("chatActiveBox").hidden = false;

    // Atualiza a seleção ativa na lista
    document.querySelectorAll(".conversa-item").forEach((el) => {
        el.classList.toggle("ativo", Number(el.dataset.id) === conversaAtivaId);
    });

    const conversa = listaConversasGlobal.find((c) => c.id === conversaAtivaId);
    if (conversa) {
        if ($("chatDestinatarioNome")) $("chatDestinatarioNome").textContent = conversa.outro_usuario_nome || "Usuário";
        
        const veicText = conversa.veiculo_modelo ? `${conversa.veiculo_marca || ""} ${conversa.veiculo_modelo}` : "Veículo";
        if ($("chatVeiculoRef")) $("chatVeiculoRef").innerHTML = `<i class="fa-solid fa-car-side"></i> ${esc(veicText)}`;
        
        const avatarEl = $("chatAvatar");
        if (avatarEl) {
            const iniciais = (conversa.outro_usuario_nome || "U").substring(0, 2).toUpperCase();
            avatarEl.innerHTML = conversa.foto_perfil ? `<img src="${esc(conversa.foto_perfil)}" alt="Foto">` : iniciais;
        }
    }

    renderizarHistoricoMensagens(conversa);
}

function renderizarHistoricoMensagens(conversa) {
    const scrollArea = $("chatMessagesScroll");
    if (!scrollArea) return;

    if (!conversa || !conversa.ultima_mensagem) {
        scrollArea.innerHTML = `
            <div class="dia-sep">Início da negociação</div>
            <div class="msg-bubble recebida">
                Olá! Como posso ajudar em relação a este veículo?
                <span class="hora">Agora</span>
            </div>`;
        return;
    }

    const hora = conversa.ultimo_envio ? new Date(conversa.ultimo_envio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Agora";

    scrollArea.innerHTML = `
        <div class="dia-sep">Última atualização</div>
        <div class="msg-bubble enviada">
            ${esc(conversa.ultima_mensagem)}
            <span class="hora">${hora}</span>
        </div>`;
    
    scrollArea.scrollTop = scrollArea.scrollHeight;
}

// ==========================================================
// ENVIO DE MENSAGENS
// ==========================================================
async function enviarMensagem(evt) {
    if (evt) evt.preventDefault();
    const input = $("inputMensagem");
    if (!input || !conversaAtivaId) return;

    const texto = input.value.trim();
    if (!texto) return;

    input.value = "";
    input.style.height = "auto";
    const btnEnviar = $("btnEnviarMensagem");
    if (btnEnviar) btnEnviar.disabled = true;

    try {
        await requisitarApi(`/${conversaAtivaId}/mensagem`, {
            method: "POST",
            body: JSON.stringify({ texto })
        });

        // Recarrega conversas para trazer a versão atualizada
        await carregarConversas(true);
        const conversaAtualizada = listaConversasGlobal.find(c => c.id === conversaAtivaId);
        renderizarHistoricoMensagens(conversaAtualizada);

    } catch (erro) {
        console.error("Erro ao enviar mensagem:", erro);
        exibirToast("Erro ao enviar mensagem.", "erro");
    }
}

// ==========================================================
// PAINÉIS DE EMOJIS E RESPOSTAS RÁPIDAS
// ==========================================================
function inicializarPaineisAuxiliares() {
    const emojiPanel = $("emojiPanel");
    if (emojiPanel) {
        emojiPanel.innerHTML = EMOJIS.map(e => `<button type="button">${e}</button>`).join("");
        emojiPanel.addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON") {
                const input = $("inputMensagem");
                if (input) {
                    input.value += e.target.textContent;
                    input.dispatchEvent(new Event("input"));
                    input.focus();
                }
            }
        });
    }

    const respostasRapidas = $("respostasRapidas");
    if (respostasRapidas) {
        respostasRapidas.innerHTML = RESPOSTAS_RAPIDAS.map(r => `<button type="button" class="resposta-chip">${esc(r)}</button>`).join("");
        respostasRapidas.addEventListener("click", (e) => {
            if (e.target.classList.contains("resposta-chip")) {
                const input = $("inputMensagem");
                if (input) {
                    input.value = e.target.textContent;
                    input.dispatchEvent(new Event("input"));
                    input.focus();
                }
            }
        });
    }

    // Toggle Botão Emojis
    $("btnEmoji")?.addEventListener("click", () => {
        if (emojiPanel) emojiPanel.hidden = !emojiPanel.hidden;
        if (respostasRapidas) respostasRapidas.hidden = true;
    });

    // Toggle Botão Respostas Rápidas
    $("btnRapidas")?.addEventListener("click", () => {
        if (respostasRapidas) respostasRapidas.hidden = !respostasRapidas.hidden;
        if (emojiPanel) emojiPanel.hidden = true;
    });
}

// ==========================================================
// INICIALIZAÇÃO DA PÁGINA
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
    const sessao = obterSessao();
    if (!sessao) {
        window.location.replace(LOGIN_URL);
        return;
    }

    meuUsuarioId = sessao.id || sessao._id;
    configurarNavegacao(sessao);
    inicializarPaineisAuxiliares();

    // Eventos da busca e filtros na sidebar
    $("inputPesquisaConversa")?.addEventListener("input", (e) => {
        termoBusca = e.target.value;
        aplicarFiltrosEBusca();
    });

    document.querySelectorAll(".filtro").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filtro").forEach(b => b.classList.remove("ativo"));
            btn.classList.add("ativo");
            filtroAtual = btn.dataset.filtro;
            aplicarFiltrosEBusca();
        });
    });

    // Clique na conversa na lista
    $("conversasList")?.addEventListener("click", (e) => {
        const item = e.target.closest(".conversa-item");
        if (item) {
            abrirConversa(item.dataset.id);
        }
    });

    // Botão Voltar no Mobile
    $("btnListaVoltar")?.addEventListener("click", () => {
        const wrapper = $("chatWrapper");
        if (wrapper) wrapper.classList.remove("em-conversa");
    });

    // Form de Envio e Input auto-expand
    const inputMsg = $("inputMensagem");
    const btnEnviar = $("btnEnviarMensagem");

    if (inputMsg) {
        inputMsg.addEventListener("input", () => {
            inputMsg.style.height = "auto";
            inputMsg.style.height = `${Math.min(inputMsg.scrollHeight, 130)}px`;
            if (btnEnviar) btnEnviar.disabled = !inputMsg.value.trim();
        });

        inputMsg.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviarMensagem();
            }
        });
    }

    $("chatForm")?.addEventListener("submit", enviarMensagem);

    // Carregamento inicial e polling a cada 5 segundos
    carregarConversas();
    intervaloPolling = setInterval(() => carregarConversas(true), 5000);
});