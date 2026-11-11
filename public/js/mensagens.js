"use strict";

// ==========================================================
// CONFIGURAÇÕES E ESTADO
// ==========================================================
const API_URL = "/api/conversas";
const LOGIN_URL = "/pages/login.html";
const MAX_MENSAGENS_GLOBAIS = 200;

const EMOJIS = [
    "👍", "👋", "🚗", "🤝", "💰", "🔑",
    "😃", "🤔", "✅", "🙏", "📲", "⚡"
];

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
let mensagensGlobais = [];
let socketGlobal = null;
let modoAtivo = "nenhum";
let intervaloPolling = null;
let filtroAtual = "todas";
let termoBusca = "";
let mensagemSelecionadaId = null;
let novasMensagensAbaixoCount = 0;
let totalGlobalOnline = 0;

const $ = (id) => document.getElementById(id);

// ==========================================================
// SESSÃO
// ==========================================================
function obterSessao() {
    const bruto =
        localStorage.getItem("usuario") ||
        localStorage.getItem("usuario_logado") ||
        sessionStorage.getItem("usuario") ||
        sessionStorage.getItem("usuario_logado");

    try {
        return bruto ? JSON.parse(bruto) : null;
    } catch {
        return null;
    }
}

function obterToken() {
    return (
        localStorage.getItem("token") ||
        sessionStorage.getItem("token")
    );
}

function configurarNavegacao(sessao) {
    const btnVoltar = $("btnVoltar");
    const btnTexto = $("btnVoltarTexto");

    if (!btnVoltar) return;

    btnVoltar.addEventListener("click", (evento) => {
        if (
            document.referrer &&
            document.referrer.includes(window.location.host)
        ) {
            evento.preventDefault();
            window.history.back();
        }
    });

    const tipo = String(
        sessao?.tipo || "individual"
    ).toLowerCase();

    if (tipo === "admin") {
        btnVoltar.href = "/pages/painel-admin.html";

        if (btnTexto) {
            btnTexto.textContent = "Painel Admin";
        }
    } else if (tipo === "empresa") {
        btnVoltar.href = "/pages/painel-empresa.html";

        if (btnTexto) {
            btnTexto.textContent = "Painel Empresa";
        }
    } else {
        btnVoltar.href = "/pages/catalogo.html";

        if (btnTexto) {
            btnTexto.textContent = "Voltar";
        }
    }
}

// ==========================================================
// API DAS CONVERSAS PRIVADAS
// ==========================================================
async function requisitarApi(caminho, opcoes = {}) {
    const token = obterToken();

    const headers = {
        "Content-Type": "application/json",

        ...(token && {
            Authorization: `Bearer ${token}`
        }),

        ...opcoes.headers
    };

    const resposta = await fetch(
        `${API_URL}${caminho}`,
        {
            ...opcoes,
            headers
        }
    );

    if (resposta.status === 401) {
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");

        window.location.replace(LOGIN_URL);

        throw new Error("Sessão expirada");
    }

    const dados = await resposta
        .json()
        .catch(() => ({}));

    if (!resposta.ok) {
        throw new Error(
            dados.erro ||
            dados.mensagem ||
            `Erro ${resposta.status}`
        );
    }

    return dados;
}

// ==========================================================
// AVISOS
// ==========================================================
function exibirToast(mensagem, tipo = "ok") {
    const area = $("toastArea");

    if (!area) return;

    const toast = document.createElement("div");
    toast.className =
        `toast ${tipo === "erro" ? "erro" : ""}`;

    const conteudo = document.createElement("div");
    const titulo = document.createElement("b");
    const texto = document.createElement("span");

    titulo.textContent = "MotorFlex";
    texto.textContent = String(mensagem || "");

    conteudo.append(titulo, texto);
    toast.appendChild(conteudo);
    area.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("on");
    });

    setTimeout(() => {
        toast.classList.remove("on");

        setTimeout(() => {
            toast.remove();
        }, 200);
    }, 3500);
}

function esc(valor) {
    return String(valor ?? "").replace(
        /[&<>"']/g,
        (caractere) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[caractere])
    );
}

function mostrarFeedback(texto = "", erro = false) {
    const elemento = $("chatFeedback");

    if (!elemento) return;

    elemento.textContent = texto;
    elemento.classList.toggle("erro", erro);
}

// ==========================================================
// SOCKET.IO — CHAT GLOBAL
// ==========================================================
function inicializarSocketGlobal() {
    const token = obterToken();

    if (!token) {
        window.location.replace(LOGIN_URL);
        return;
    }

    if (typeof window.io !== "function") {
        atualizarStatusGlobal(
            false,
            "Socket.IO indisponível"
        );

        exibirToast(
            "Não foi possível carregar o Socket.IO.",
            "erro"
        );

        return;
    }

    socketGlobal = window.io({
        auth: {
            token
        },

        transports: [
            "websocket",
            "polling"
        ]
    });

    socketGlobal.on("connect", () => {
        atualizarStatusGlobal(
            true,
            "Conectado"
        );

        mostrarFeedback("");
        atualizarEstadoDoFormulario();
    });

    socketGlobal.on("disconnect", () => {
        atualizarStatusGlobal(
            false,
            "Reconectando..."
        );

        atualizarEstadoDoFormulario();
    });

    socketGlobal.on(
        "connect_error",
        (erro) => {
            const mensagem =
                erro?.message ||
                "Não foi possível conectar ao Chat Global.";

            atualizarStatusGlobal(
                false,
                "Desconectado"
            );

            if (modoAtivo === "global") {
                mostrarFeedback(
                    mensagem,
                    true
                );
            }

            console.error(
                "Erro no Chat Global:",
                mensagem
            );
        }
    );

    socketGlobal.on(
        "chat:presenca",
        (dados) => {
            totalGlobalOnline =
                Number(dados?.online) || 0;

            const contador =
                $("globalOnlineCount");

            if (contador) {
                contador.textContent =
                    totalGlobalOnline;
            }

            if (modoAtivo === "global") {
                atualizarCabecalhoGlobal();
            }
        }
    );

    socketGlobal.on(
        "chat:mensagem",
        (mensagem) => {
            if (
                !mensagem ||
                typeof mensagem.texto !== "string" ||
                !mensagem.usuario
            ) {
                return;
            }

            mensagensGlobais.push(mensagem);

            if (
                mensagensGlobais.length >
                MAX_MENSAGENS_GLOBAIS
            ) {
                mensagensGlobais =
                    mensagensGlobais.slice(
                        -MAX_MENSAGENS_GLOBAIS
                    );
            }

            if (modoAtivo === "global") {
                adicionarMensagemGlobal(
                    mensagem
                );
            }
        }
    );
}

function atualizarStatusGlobal(
    conectado,
    texto
) {
    const ponto = $("globalStatusDot");
    const status = $("globalStatusTexto");

    if (ponto) {
        ponto.classList.toggle(
            "conectado",
            conectado
        );
    }

    if (status) {
        status.textContent = texto;
    }
}

function abrirChatGlobal() {
    modoAtivo = "global";
    conversaAtivaId = null;

    const wrapper = $("chatWrapper");

    if (wrapper) {
        wrapper.classList.add(
            "em-conversa"
        );
    }

    if ($("chatEmptyState")) {
        $("chatEmptyState").hidden = true;
    }

    if ($("chatActiveBox")) {
        $("chatActiveBox").hidden = false;
    }

    const btnGlobal = $("btnChatGlobal");

    if (btnGlobal) {
        btnGlobal.classList.add("ativo");
    }

    document
        .querySelectorAll(".conversa-item")
        .forEach((item) => {
            item.classList.remove("ativo");
        });

    atualizarCabecalhoGlobal();
    configurarFormularioParaModo();
    renderizarMensagensGlobais();

    if (socketGlobal?.connected) {
        mostrarFeedback("");
    } else {
        mostrarFeedback(
            "Aguardando conexão com o Chat Global...",
            true
        );
    }
}

function atualizarCabecalhoGlobal() {
    const avatar = $("chatAvatar");
    const nome = $("chatDestinatarioNome");
    const referencia = $("chatVeiculoRef");

    if (avatar) {
        avatar.innerHTML =
            '<i class="fa-solid fa-earth-americas"></i>';
    }

    if (nome) {
        nome.textContent = "Chat Global";
    }

    if (referencia) {
        referencia.innerHTML = `
            <i class="fa-solid fa-user-group"></i>
            ${totalGlobalOnline} online · mensagens temporárias
        `;
    }
}

function configurarFormularioParaModo() {
    const input = $("inputMensagem");
    const btnRapidas = $("btnRapidas");
    const respostas = $("respostasRapidas");

    if (input) {
        input.value = "";
        input.style.height = "auto";

        if (modoAtivo === "global") {
            input.maxLength = 500;
            input.placeholder =
                "Escreva no Chat Global...";
        } else {
            input.maxLength = 1000;
            input.placeholder =
                "Escreva sua mensagem...";
        }
    }

    if (btnRapidas) {
        btnRapidas.hidden =
            modoAtivo === "global";
    }

    if (
        respostas &&
        modoAtivo === "global"
    ) {
        respostas.hidden = true;
    }

    atualizarEstadoDoFormulario();
}

function atualizarEstadoDoFormulario() {
    const input = $("inputMensagem");
    const botao = $("btnEnviarMensagem");

    if (!input || !botao) return;

    let destinoDisponivel = false;

    if (modoAtivo === "global") {
        destinoDisponivel =
            Boolean(socketGlobal?.connected);
    }

    if (modoAtivo === "privado") {
        destinoDisponivel =
            Boolean(conversaAtivaId);
    }

    input.disabled = !destinoDisponivel;

    botao.disabled =
        !destinoDisponivel ||
        !input.value.trim();
}

function renderizarMensagensGlobais() {
    const container =
        $("chatMessagesScroll");

    if (!container) return;

    container.replaceChildren();

    const aviso =
        document.createElement("div");

    aviso.className = "msg-sistema";
    aviso.textContent =
        "Mensagens temporárias — nenhum conteúdo é salvo no banco";

    container.appendChild(aviso);

    if (!mensagensGlobais.length) {
        const inicio =
            document.createElement("div");

        inicio.className = "msg-sistema";
        inicio.textContent =
            "A conversa começa aqui";

        container.appendChild(inicio);
    } else {
        mensagensGlobais.forEach(
            (mensagem) => {
                adicionarMensagemGlobal(
                    mensagem,
                    false
                );
            }
        );
    }

    container.scrollTop =
        container.scrollHeight;
}

function adicionarMensagemGlobal(
    mensagem,
    rolar = true
) {
    const container =
        $("chatMessagesScroll");

    if (
        !container ||
        modoAtivo !== "global"
    ) {
        return;
    }

    const minha =
        Number(mensagem.usuario?.id) ===
        Number(meuUsuarioId);

    const bolha =
        document.createElement("article");

    bolha.className =
        `msg-bubble ${
            minha
                ? "enviada"
                : "recebida"
        }`;

    if (mensagem.id) {
        bolha.dataset.id =
            mensagem.id;
    }

    const autor =
        document.createElement("strong");

    autor.className = "autor-msg";

    autor.textContent = minha
        ? "Você"
        : (
            mensagem.usuario?.nome ||
            "Usuário"
        );

    const conteudo =
        document.createElement("span");

    conteudo.className =
        "conteudo-texto";

    conteudo.textContent =
        mensagem.texto;

    const rodape =
        document.createElement("span");

    rodape.className = "rodape-msg";

    const hora =
        document.createElement("time");

    hora.className = "hora";

    const data =
        new Date(mensagem.enviadaEm);

    hora.textContent =
        Number.isNaN(data.getTime())
            ? "Agora"
            : data.toLocaleTimeString(
                "pt-BR",
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

    rodape.appendChild(hora);

    bolha.append(
        autor,
        conteudo,
        rodape
    );

    container.appendChild(bolha);

    if (!rolar) return;

    const pertoDoFim =
        container.scrollHeight -
        container.scrollTop <=
        container.clientHeight + 180;

    if (pertoDoFim) {
        container.scrollTop =
            container.scrollHeight;
    } else {
        novasMensagensAbaixoCount++;

        atualizarBotaoBaixoScroll();
    }
}

function enviarMensagemGlobal(texto) {
    return new Promise(
        (resolve, reject) => {
            if (!socketGlobal?.connected) {
                reject(
                    new Error(
                        "O Chat Global está desconectado."
                    )
                );

                return;
            }

            socketGlobal
                .timeout(5000)
                .emit(
                    "chat:mensagem",
                    { texto },
                    (
                        erroTimeout,
                        resposta
                    ) => {
                        if (erroTimeout) {
                            reject(
                                new Error(
                                    "O servidor não respondeu. Tente novamente."
                                )
                            );

                            return;
                        }

                        if (!resposta?.sucesso) {
                            reject(
                                new Error(
                                    resposta?.erro ||
                                    "Não foi possível enviar a mensagem."
                                )
                            );

                            return;
                        }

                        resolve(resposta);
                    }
                );
        }
    );
}

// ==========================================================
// LISTA DE CONVERSAS PRIVADAS
// ==========================================================
async function carregarConversas(
    silencioso = false
) {
    try {
        const dados =
            await requisitarApi("/");

        listaConversasGlobal =
            Array.isArray(dados.conversas)
                ? dados.conversas
                : [];

        const total =
            $("totalConversas");

        if (total) {
            total.textContent =
                listaConversasGlobal.length;
        }

        aplicarFiltrosEBusca();

        if (
            modoAtivo === "privado" &&
            conversaAtivaId
        ) {
            await carregarMensagens(
                conversaAtivaId,
                true
            );
        }
    } catch (erro) {
        if (!silencioso) {
            console.error(
                "Erro ao carregar conversas:",
                erro
            );

            const container =
                $("conversasList");

            if (container) {
                container.innerHTML = `
                    <div class="chat-loading">
                        Erro ao carregar conversas.
                    </div>
                `;
            }
        }
    }
}

function aplicarFiltrosEBusca() {
    const termo =
        termoBusca.toLowerCase().trim();

    const filtradas =
        listaConversasGlobal.filter(
            (conversa) => {
                const nome = String(
                    conversa.outro_usuario_nome ||
                    ""
                ).toLowerCase();

                const modelo = String(
                    conversa.veiculo_modelo ||
                    ""
                ).toLowerCase();

                const marca = String(
                    conversa.veiculo_marca ||
                    ""
                ).toLowerCase();

                const corresponde =
                    !termo ||
                    nome.includes(termo) ||
                    modelo.includes(termo) ||
                    marca.includes(termo);

                if (
                    filtroAtual ===
                    "nao-lidas"
                ) {
                    return (
                        corresponde &&
                        conversa.tem_nova
                    );
                }

                return corresponde;
            }
        );

    renderizarListaSidebar(filtradas);
}

function renderizarListaSidebar(conversas) {
    const container =
        $("conversasList");

    if (!container) return;

    if (!conversas.length) {
        container.innerHTML = `
            <div class="lista-vazia">
                <i class="fa-regular fa-comments"></i>
                Nenhuma conversa encontrada.
            </div>
        `;

        return;
    }

    container.innerHTML =
        conversas.map((conversa) => {
            const ativa =
                modoAtivo === "privado" &&
                Number(conversa.id) ===
                Number(conversaAtivaId)
                    ? "ativo"
                    : "";

            const nova =
                conversa.tem_nova
                    ? "tem-nova"
                    : "";

            const nome =
                conversa.outro_usuario_nome ||
                "Usuário";

            const iniciais =
                nome
                    .substring(0, 2)
                    .toUpperCase();

            const data =
                conversa.ultimo_envio ||
                conversa.criado_em;

            let hora = "";

            if (data) {
                const dataFormatada =
                    new Date(data);

                if (
                    !Number.isNaN(
                        dataFormatada.getTime()
                    )
                ) {
                    hora =
                        dataFormatada
                            .toLocaleTimeString(
                                "pt-BR",
                                {
                                    hour: "2-digit",
                                    minute: "2-digit"
                                }
                            );
                }
            }

            const veiculo =
                conversa.veiculo_modelo
                    ? `${
                        conversa.veiculo_marca ||
                        ""
                    } ${
                        conversa.veiculo_modelo
                    }`.trim()
                    : "Negociação geral";

            return `
                <div
                    class="conversa-item ${ativa} ${nova}"
                    data-id="${Number(conversa.id)}"
                    tabindex="0"
                    role="button"
                >
                    <div class="av av-md">
                        ${
                            conversa.foto_perfil
                                ? `
                                    <img
                                        src="${esc(conversa.foto_perfil)}"
                                        alt="Foto de ${esc(nome)}"
                                    >
                                `
                                : esc(iniciais)
                        }
                    </div>

                    <div class="conversa-info">
                        <div class="conversa-linha">
                            <h4>${esc(nome)}</h4>

                            <span class="conversa-hora">
                                ${esc(hora)}
                            </span>
                        </div>

                        <div class="conversa-linha">
                            <p>
                                ${esc(
                                    conversa.ultima_mensagem ||
                                    "Conversa iniciada"
                                )}
                            </p>
                        </div>

                        <span class="conversa-veic">
                            <i class="fa-solid fa-car-side"></i>
                            ${esc(veiculo)}
                        </span>
                    </div>
                </div>
            `;
        }).join("");
}

// ==========================================================
// CONVERSA PRIVADA
// ==========================================================
async function abrirConversa(conversaId) {
    const id = Number(conversaId);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        return;
    }

    modoAtivo = "privado";
    conversaAtivaId = id;

    const btnGlobal =
        $("btnChatGlobal");

    if (btnGlobal) {
        btnGlobal.classList.remove(
            "ativo"
        );
    }

    const wrapper =
        $("chatWrapper");

    if (wrapper) {
        wrapper.classList.add(
            "em-conversa"
        );
    }

    if ($("chatEmptyState")) {
        $("chatEmptyState").hidden = true;
    }

    if ($("chatActiveBox")) {
        $("chatActiveBox").hidden = false;
    }

    document
        .querySelectorAll(".conversa-item")
        .forEach((item) => {
            item.classList.toggle(
                "ativo",
                Number(item.dataset.id) === id
            );
        });

    const conversa =
        listaConversasGlobal.find(
            (item) =>
                Number(item.id) === id
        );

    if (conversa) {
        const nome =
            conversa.outro_usuario_nome ||
            "Usuário";

        const titulo =
            $("chatDestinatarioNome");

        if (titulo) {
            titulo.textContent = nome;
        }

        const veiculo =
            conversa.veiculo_modelo
                ? `${
                    conversa.veiculo_marca ||
                    ""
                } ${
                    conversa.veiculo_modelo
                }`.trim()
                : "Veículo em negociação";

        const referencia =
            $("chatVeiculoRef");

        if (referencia) {
            referencia.innerHTML = `
                <i class="fa-solid fa-car-side"></i>
                ${esc(veiculo)}
            `;
        }

        const avatar =
            $("chatAvatar");

        if (avatar) {
            if (conversa.foto_perfil) {
                avatar.innerHTML = `
                    <img
                        src="${esc(conversa.foto_perfil)}"
                        alt="Foto de ${esc(nome)}"
                    >
                `;
            } else {
                avatar.textContent =
                    nome
                        .substring(0, 2)
                        .toUpperCase();
            }
        }
    }

    configurarFormularioParaModo();
    mostrarFeedback("");

    novasMensagensAbaixoCount = 0;
    atualizarBotaoBaixoScroll();

    await carregarMensagens(id);
}

async function carregarMensagens(
    conversaId,
    silencioso = false
) {
    const container =
        $("chatMessagesScroll");

    if (
        !container ||
        !conversaId ||
        modoAtivo !== "privado"
    ) {
        return;
    }

    try {
        const dados =
            await requisitarApi(
                `/${conversaId}/mensagens`
            );

        if (
            Array.isArray(
                dados.mensagens
            )
        ) {
            renderizarListaMensagens(
                dados.mensagens,
                container
            );
        }
    } catch (erro) {
        if (!silencioso) {
            console.error(
                "Erro ao buscar mensagens:",
                erro
            );

            container.innerHTML = `
                <div class="chat-loading">
                    Erro ao carregar mensagens.
                </div>
            `;
        }
    }
}

function renderizarListaMensagens(
    mensagens,
    container
) {
    if (modoAtivo !== "privado") {
        return;
    }

    if (!mensagens.length) {
        container.innerHTML = `
            <div class="dia-sep">
                Início da negociação
            </div>
        `;

        return;
    }

    const estavaNoFim =
        container.scrollHeight -
        container.scrollTop <=
        container.clientHeight + 100;

    const elementos =
        mensagens.map((mensagem) => {
            const minha =
                mensagem.enviada_por_mim ||
                Number(
                    mensagem.remetente_id
                ) === Number(meuUsuarioId);

            const data =
                new Date(
                    mensagem.criado_em
                );

            const hora =
                Number.isNaN(data.getTime())
                    ? "Agora"
                    : data.toLocaleTimeString(
                        "pt-BR",
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    );

            return `
                <div
                    class="msg-bubble ${
                        minha
                            ? "enviada"
                            : "recebida"
                    }"
                    data-id="${Number(mensagem.id)}"
                >
                    <span class="conteudo-texto">
                        ${esc(mensagem.texto)}
                    </span>

                    <span class="rodape-msg">
                        <span class="hora">
                            ${esc(hora)}
                        </span>

                        <button
                            type="button"
                            class="btn-opcoes-msg"
                            data-mensagem-id="${Number(mensagem.id)}"
                            data-minha="${minha}"
                            title="Opções"
                            aria-label="Opções da mensagem"
                        >
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                    </span>
                </div>
            `;
        }).join("");

    container.innerHTML = `
        <div class="dia-sep">
            Mensagens
        </div>

        ${elementos}
    `;

    if (estavaNoFim) {
        container.scrollTop =
            container.scrollHeight;

        novasMensagensAbaixoCount = 0;
    } else {
        novasMensagensAbaixoCount++;
    }

    atualizarBotaoBaixoScroll();
}

// ==========================================================
// ENVIO DE MENSAGENS
// ==========================================================
async function enviarMensagem(evento) {
    if (evento) {
        evento.preventDefault();
    }

    const input =
        $("inputMensagem");

    const botao =
        $("btnEnviarMensagem");

    if (!input) return;

    const texto =
        input.value.trim();

    if (
        !texto ||
        modoAtivo === "nenhum"
    ) {
        return;
    }

    if (botao) {
        botao.disabled = true;
    }

    mostrarFeedback("");

    try {
        if (modoAtivo === "global") {
            await enviarMensagemGlobal(
                texto
            );
        } else if (
            modoAtivo === "privado" &&
            conversaAtivaId
        ) {
            await requisitarApi(
                `/${conversaAtivaId}/mensagem`,
                {
                    method: "POST",

                    body: JSON.stringify({
                        texto
                    })
                }
            );

            await carregarMensagens(
                conversaAtivaId,
                true
            );

            await carregarConversas(true);
        }

        input.value = "";
        input.style.height = "auto";
    } catch (erro) {
        console.error(
            "Erro ao enviar mensagem:",
            erro
        );

        mostrarFeedback(
            erro.message ||
            "Erro ao enviar mensagem.",
            true
        );

        exibirToast(
            erro.message ||
            "Erro ao enviar mensagem.",
            "erro"
        );
    } finally {
        atualizarEstadoDoFormulario();
        input.focus();
    }
}

// ==========================================================
// SCROLL
// ==========================================================
function atualizarBotaoBaixoScroll() {
    const botao = $("btnBaixo");
    const contador = $("baixoContador");
    const container =
        $("chatMessagesScroll");

    if (!botao || !container) {
        return;
    }

    const longeDoFim =
        container.scrollHeight -
        container.scrollTop >
        container.clientHeight + 140;

    botao.hidden = !longeDoFim;

    if (contador) {
        contador.hidden =
            !longeDoFim ||
            novasMensagensAbaixoCount <= 0;

        contador.textContent =
            novasMensagensAbaixoCount;
    }

    if (!longeDoFim) {
        novasMensagensAbaixoCount = 0;
    }
}

// ==========================================================
// EXCLUSÃO DE MENSAGEM PRIVADA
// ==========================================================
function fecharModalDelecao() {
    const modal =
        $("modalDeleteMsg");

    if (modal) {
        modal.hidden = true;
    }

    mensagemSelecionadaId = null;
}

function abrirMenuExclusao(
    mensagemId,
    minha
) {
    if (modoAtivo !== "privado") {
        return;
    }

    mensagemSelecionadaId =
        mensagemId;

    const modal =
        $("modalDeleteMsg");

    if (!modal) return;

    const btnTodos =
        $("btnDeleteParaTodos");

    const texto =
        $("modalDeleteTexto");

    if (btnTodos) {
        btnTodos.hidden = !minha;
    }

    if (texto) {
        texto.textContent = minha
            ? "Você pode apagar esta mensagem para você ou para todos."
            : "Você pode apagar esta mensagem apenas para você.";
    }

    modal.hidden = false;
}

async function apagarMensagem(
    mensagemId,
    tipo
) {
    try {
        const dados =
            await requisitarApi(
                `/mensagem/${mensagemId}`,
                {
                    method: "DELETE",

                    body: JSON.stringify({
                        tipo
                    })
                }
            );

        if (!dados.sucesso) {
            throw new Error(
                dados.erro ||
                "Não foi possível apagar a mensagem."
            );
        }

        exibirToast(
            "Mensagem removida com sucesso!"
        );

        await carregarMensagens(
            conversaAtivaId,
            true
        );

        await carregarConversas(true);
    } catch (erro) {
        console.error(
            "Erro ao apagar mensagem:",
            erro
        );

        exibirToast(
            erro.message ||
            "Erro ao apagar mensagem.",
            "erro"
        );
    }
}

// ==========================================================
// EMOJIS E RESPOSTAS RÁPIDAS
// ==========================================================
function inicializarPaineisAuxiliares() {
    const painelEmoji =
        $("emojiPanel");

    const respostas =
        $("respostasRapidas");

    if (painelEmoji) {
        painelEmoji.innerHTML =
            EMOJIS.map(
                (emoji) => `
                    <button type="button">
                        ${emoji}
                    </button>
                `
            ).join("");

        painelEmoji.addEventListener(
            "click",
            (evento) => {
                const botao =
                    evento.target.closest(
                        "button"
                    );

                if (!botao) return;

                const input =
                    $("inputMensagem");

                if (
                    !input ||
                    input.disabled
                ) {
                    return;
                }

                input.value +=
                    botao.textContent.trim();

                input.dispatchEvent(
                    new Event("input")
                );

                input.focus();
            }
        );
    }

    if (respostas) {
        respostas.innerHTML =
            RESPOSTAS_RAPIDAS.map(
                (resposta) => `
                    <button
                        type="button"
                        class="resposta-chip"
                    >
                        ${esc(resposta)}
                    </button>
                `
            ).join("");

        respostas.addEventListener(
            "click",
            (evento) => {
                const botao =
                    evento.target.closest(
                        ".resposta-chip"
                    );

                if (
                    !botao ||
                    modoAtivo !== "privado"
                ) {
                    return;
                }

                const input =
                    $("inputMensagem");

                if (!input) return;

                input.value =
                    botao.textContent.trim();

                input.dispatchEvent(
                    new Event("input")
                );

                input.focus();
            }
        );
    }

    const btnEmoji =
        $("btnEmoji");

    if (btnEmoji) {
        btnEmoji.addEventListener(
            "click",
            () => {
                if (painelEmoji) {
                    painelEmoji.hidden =
                        !painelEmoji.hidden;
                }

                if (respostas) {
                    respostas.hidden = true;
                }
            }
        );
    }

    const btnRapidas =
        $("btnRapidas");

    if (btnRapidas) {
        btnRapidas.addEventListener(
            "click",
            () => {
                if (
                    modoAtivo !== "privado"
                ) {
                    return;
                }

                if (respostas) {
                    respostas.hidden =
                        !respostas.hidden;
                }

                if (painelEmoji) {
                    painelEmoji.hidden = true;
                }
            }
        );
    }
}

// ==========================================================
// INICIALIZAÇÃO DA PÁGINA
// ==========================================================
document.addEventListener(
    "DOMContentLoaded",
    async () => {
        const sessao =
            obterSessao();

        const token =
            obterToken();

        if (!sessao || !token) {
            window.location.replace(
                LOGIN_URL
            );

            return;
        }

        meuUsuarioId = Number(
            sessao.id ||
            sessao._id ||
            sessao.usuario_id
        );

        configurarNavegacao(sessao);
        inicializarPaineisAuxiliares();
        inicializarSocketGlobal();

        const btnGlobal =
            $("btnChatGlobal");

        if (btnGlobal) {
            btnGlobal.addEventListener(
                "click",
                abrirChatGlobal
            );
        }

        const pesquisa =
            $("inputPesquisaConversa");

        if (pesquisa) {
            pesquisa.addEventListener(
                "input",
                (evento) => {
                    termoBusca =
                        evento.target.value;

                    aplicarFiltrosEBusca();
                }
            );
        }

        document
            .querySelectorAll(".filtro")
            .forEach((botao) => {
                botao.addEventListener(
                    "click",
                    () => {
                        document
                            .querySelectorAll(
                                ".filtro"
                            )
                            .forEach(
                                (item) => {
                                    item.classList.remove(
                                        "ativo"
                                    );
                                }
                            );

                        botao.classList.add(
                            "ativo"
                        );

                        filtroAtual =
                            botao.dataset.filtro;

                        aplicarFiltrosEBusca();
                    }
                );
            });

        const lista =
            $("conversasList");

        if (lista) {
            lista.addEventListener(
                "click",
                (evento) => {
                    const item =
                        evento.target.closest(
                            ".conversa-item"
                        );

                    if (item) {
                        abrirConversa(
                            item.dataset.id
                        );
                    }
                }
            );

            lista.addEventListener(
                "keydown",
                (evento) => {
                    if (
                        evento.key !== "Enter" &&
                        evento.key !== " "
                    ) {
                        return;
                    }

                    const item =
                        evento.target.closest(
                            ".conversa-item"
                        );

                    if (item) {
                        evento.preventDefault();

                        abrirConversa(
                            item.dataset.id
                        );
                    }
                }
            );
        }

        const btnListaVoltar =
            $("btnListaVoltar");

        if (btnListaVoltar) {
            btnListaVoltar.addEventListener(
                "click",
                () => {
                    const wrapper =
                        $("chatWrapper");

                    if (wrapper) {
                        wrapper.classList.remove(
                            "em-conversa"
                        );
                    }
                }
            );
        }

        const container =
            $("chatMessagesScroll");

        if (container) {
            container.addEventListener(
                "scroll",
                atualizarBotaoBaixoScroll
            );

            container.addEventListener(
                "click",
                (evento) => {
                    const botao =
                        evento.target.closest(
                            ".btn-opcoes-msg"
                        );

                    if (!botao) return;

                    abrirMenuExclusao(
                        Number(
                            botao.dataset.mensagemId
                        ),

                        botao.dataset.minha ===
                            "true"
                    );
                }
            );
        }

        const btnBaixo =
            $("btnBaixo");

        if (btnBaixo) {
            btnBaixo.addEventListener(
                "click",
                () => {
                    if (!container) return;

                    container.scrollTop =
                        container.scrollHeight;

                    novasMensagensAbaixoCount = 0;

                    atualizarBotaoBaixoScroll();
                }
            );
        }

        const input =
            $("inputMensagem");

        if (input) {
            input.addEventListener(
                "input",
                () => {
                    input.style.height =
                        "auto";

                    input.style.height =
                        `${Math.min(
                            input.scrollHeight,
                            130
                        )}px`;

                    atualizarEstadoDoFormulario();
                }
            );

            input.addEventListener(
                "keydown",
                (evento) => {
                    if (
                        evento.key === "Enter" &&
                        !evento.shiftKey
                    ) {
                        evento.preventDefault();

                        const formulario =
                            $("chatForm");

                        if (formulario) {
                            formulario.requestSubmit();
                        }
                    }
                }
            );
        }

        const formulario =
            $("chatForm");

        if (formulario) {
            formulario.addEventListener(
                "submit",
                enviarMensagem
            );
        }

        const modal =
            $("modalDeleteMsg");

        if (modal) {
            modal.addEventListener(
                "click",
                (evento) => {
                    if (
                        evento.target === modal
                    ) {
                        fecharModalDelecao();
                    }
                }
            );
        }

        const btnCancelar =
            $("btnDeleteCancelar");

        if (btnCancelar) {
            btnCancelar.addEventListener(
                "click",
                fecharModalDelecao
            );
        }

        const btnTodos =
            $("btnDeleteParaTodos");

        if (btnTodos) {
            btnTodos.addEventListener(
                "click",
                async () => {
                    const id =
                        mensagemSelecionadaId;

                    fecharModalDelecao();

                    if (id) {
                        await apagarMensagem(
                            id,
                            "para_todos"
                        );
                    }
                }
            );
        }

        const btnMim =
            $("btnDeleteParaMim");

        if (btnMim) {
            btnMim.addEventListener(
                "click",
                async () => {
                    const id =
                        mensagemSelecionadaId;

                    fecharModalDelecao();

                    if (id) {
                        await apagarMensagem(
                            id,
                            "para_mim"
                        );
                    }
                }
            );
        }

        document.addEventListener(
            "keydown",
            (evento) => {
                if (
                    evento.key === "Escape"
                ) {
                    fecharModalDelecao();
                }
            }
        );

        await carregarConversas();

        const parametros =
            new URLSearchParams(
                window.location.search
            );

        const conversaUrlId =
            parametros.get("conversa");

        if (
            parametros.get("global") ===
            "1"
        ) {
            abrirChatGlobal();
        } else if (conversaUrlId) {
            await abrirConversa(
                conversaUrlId
            );
        } else if (
            listaConversasGlobal.length > 0 &&
            window.innerWidth >= 768
        ) {
            await abrirConversa(
                listaConversasGlobal[0].id
            );
        } else {
            abrirChatGlobal();
        }

        intervaloPolling =
            setInterval(
                () => {
                    carregarConversas(true);
                },
                4000
            );
    }
);

window.addEventListener(
    "beforeunload",
    () => {
        if (intervaloPolling) {
            clearInterval(
                intervaloPolling
            );
        }

        if (socketGlobal) {
            socketGlobal.disconnect();
        }
    }
);