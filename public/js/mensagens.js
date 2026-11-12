"use strict";

const API_URL = "/api/conversas";
const LOGIN_URL = "/pages/login.html";
const MAX_CARACTERES_MENSAGEM = 2000;
const TEMPO_ESPERA_BUSCA = 350;

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
let listaConversas = [];
let socketPrivado = null;
let filtroAtual = "todas";
let termoBusca = "";
let mensagemSelecionadaId = null;
let novasMensagensAbaixoCount = 0;
let assinaturaMensagens = "";
let mapaNaoLidas = new Map();
let totalNaoLidasGeral = 0;
let temporizadorBuscaUsuarios = null;
let controleBuscaUsuarios = null;
let iniciandoConversaDireta = false;
let temporizadorAjusteBaloes = null;

const $ = (id) => document.getElementById(id);

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

function limparSessaoEIrParaLogin() {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    window.location.replace(LOGIN_URL);
}

function configurarNavegacao(sessao) {
    const botao = $("btnVoltar");
    const texto = $("btnVoltarTexto");

    if (!botao) return;

    botao.addEventListener("click", (evento) => {
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

    if (
        ["admin", "super_admin"].includes(tipo) ||
        sessao?.cargo === "admin"
    ) {
        botao.href = "/pages/painel-admin.html";

        if (texto) {
            texto.textContent = "Painel Admin";
        }

        return;
    }

    if (tipo === "empresa") {
        botao.href = "/pages/painel-empresa.html";

        if (texto) {
            texto.textContent = "Painel Empresa";
        }

        return;
    }

    botao.href = "/pages/catalogo.html";

    if (texto) {
        texto.textContent = "Voltar";
    }
}

async function requisitarApi(caminho, opcoes = {}) {
    const token = obterToken();

    const resposta = await fetch(`${API_URL}${caminho}`, {
        ...opcoes,
        headers: {
            "Content-Type": "application/json",
            ...(token
                ? { Authorization: `Bearer ${token}` }
                : {}),
            ...(opcoes.headers || {})
        }
    });

    const dados = await resposta
        .json()
        .catch(() => ({}));

    if (resposta.status === 401) {
        limparSessaoEIrParaLogin();
        throw new Error("Sessão expirada.");
    }

    if (!resposta.ok) {
        throw new Error(
            dados.erro ||
            dados.mensagem ||
            `Erro ${resposta.status}`
        );
    }

    return dados;
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
        })[caractere]
    );
}

function obterIniciais(nome) {
    const iniciais = String(nome || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((parte) => parte.charAt(0))
        .join("")
        .toUpperCase();

    return iniciais || "US";
}

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

function mostrarFeedback(texto = "", erro = false) {
    const elemento = $("chatFeedback");

    if (!elemento) return;

    elemento.textContent = texto;
    elemento.classList.toggle("erro", erro);
}

function atualizarEstadoDoFormulario() {
    const input = $("inputMensagem");
    const botao = $("btnEnviarMensagem");

    if (!input || !botao) return;

    const conversaDisponivel =
        Number.isInteger(conversaAtivaId) &&
        conversaAtivaId > 0;

    input.disabled = !conversaDisponivel;

    botao.disabled =
        !conversaDisponivel ||
        !input.value.trim();
}

function inicializarSocketPrivado() {
    const token = obterToken();

    if (!token || typeof window.io !== "function") {
        mostrarFeedback(
            "Não foi possível iniciar as mensagens em tempo real.",
            true
        );
        return;
    }

    socketPrivado = window.io({
        auth: { token },
        transports: ["websocket", "polling"]
    });

    socketPrivado.on("privado:conectado", () => {
        mostrarFeedback("");
        carregarConversas(true);
    });

    socketPrivado.on("connect_error", (erro) => {
        const codigo = erro?.data?.codigo;

        const errosDeToken = [
            "TOKEN_AUSENTE",
            "TOKEN_EXPIRADO",
            "TOKEN_INVALIDO",
            "USUARIO_INVALIDO"
        ];

        if (errosDeToken.includes(codigo)) {
            limparSessaoEIrParaLogin();
            return;
        }

        console.error(
            "Erro no Socket.IO privado:",
            erro?.message || erro
        );

        mostrarFeedback(
            "Tentando reconectar às mensagens em tempo real...",
            true
        );
    });

    socketPrivado.on("disconnect", (motivo) => {
        if (motivo !== "io client disconnect") {
            mostrarFeedback(
                "Reconectando às mensagens em tempo real...",
                true
            );
        }
    });

    socketPrivado.on("privado:mensagem", async (dados) => {
        const conversaId = Number(dados?.conversa_id);
        const remetenteId = Number(
            dados?.mensagem?.remetente_id
        );

        if (
            !Number.isInteger(conversaId) ||
            conversaId <= 0
        ) {
            return;
        }

        await carregarConversas(true);

        if (
            conversaId === Number(conversaAtivaId) &&
            remetenteId !== Number(meuUsuarioId)
        ) {
            await marcarConversaComoLida(
                conversaId,
                true
            );
        }

        if (
            conversaId !== Number(conversaAtivaId) &&
            remetenteId !== Number(meuUsuarioId)
        ) {
            exibirToast(
                "Você recebeu uma nova mensagem."
            );
        }
    });

    socketPrivado.on(
        "privado:mensagem_excluida",
        async (dados) => {
            const conversaId = Number(
                dados?.conversa_id
            );

            if (
                !Number.isInteger(conversaId) ||
                conversaId <= 0
            ) {
                return;
            }

            if (
                conversaId === Number(conversaAtivaId)
            ) {
                assinaturaMensagens = "";
            }

            await carregarConversas(true);
        }
    );

    socketPrivado.on(
        "privado:conversa_atualizada",
        async () => {
            await carregarConversas(true);
        }
    );

    socketPrivado.on(
        "privado:mensagens_lidas",
        async (dados) => {
            const conversaId = Number(
                dados?.conversa_id
            );

            if (
                conversaId === Number(conversaAtivaId)
            ) {
                assinaturaMensagens = "";

                await carregarMensagens(
                    conversaId,
                    true
                );
            }

            await carregarResumoNaoLidas(true);
            aplicarFiltrosEBusca();
        }
    );
}

async function carregarResumoNaoLidas(
    silencioso = false
) {
    try {
        const dados = await requisitarApi(
            "/nao-lidas/resumo"
        );

        const resumos = Array.isArray(dados.conversas)
            ? dados.conversas
            : [];

        mapaNaoLidas = new Map(
            resumos.map((item) => [
                Number(item.conversa_id),
                Number(item.total_nao_lidas) || 0
            ])
        );

        totalNaoLidasGeral =
            Number(dados.total_nao_lidas) || 0;

        listaConversas = listaConversas.map(
            (conversa) => {
                const totalNaoLidas =
                    mapaNaoLidas.get(
                        Number(conversa.id)
                    ) || 0;

                return {
                    ...conversa,
                    total_nao_lidas: totalNaoLidas,
                    tem_nova: totalNaoLidas > 0
                };
            }
        );

        const contador = $("totalNaoLidas");

        if (contador) {
            contador.textContent = totalNaoLidasGeral;
            contador.hidden = totalNaoLidasGeral <= 0;
        }

        return true;
    } catch (erro) {
        if (!silencioso) {
            console.error(
                "Erro ao carregar mensagens não lidas:",
                erro
            );
        }

        return false;
    }
}

async function marcarConversaComoLida(
    conversaId,
    silencioso = false
) {
    const id = Number(conversaId);

    if (!Number.isInteger(id) || id <= 0) {
        return;
    }

    try {
        await requisitarApi(`/${id}/ler`, {
            method: "POST",
            body: JSON.stringify({})
        });

        mapaNaoLidas.delete(id);

        listaConversas = listaConversas.map(
            (conversa) =>
                Number(conversa.id) === id
                    ? {
                        ...conversa,
                        total_nao_lidas: 0,
                        tem_nova: false
                    }
                    : conversa
        );

        totalNaoLidasGeral = [
            ...mapaNaoLidas.values()
        ].reduce(
            (total, quantidade) =>
                total + Number(quantidade || 0),
            0
        );

        const contador = $("totalNaoLidas");

        if (contador) {
            contador.textContent = totalNaoLidasGeral;
            contador.hidden = totalNaoLidasGeral <= 0;
        }

        aplicarFiltrosEBusca();
    } catch (erro) {
        if (!silencioso) {
            console.error(
                "Erro ao marcar conversa como lida:",
                erro
            );
        }
    }
}

async function carregarConversas(silencioso = false) {
    try {
        const dados = await requisitarApi("/");

        listaConversas = Array.isArray(dados.conversas)
            ? dados.conversas
            : [];

        await carregarResumoNaoLidas(true);

        const total = $("totalConversas");

        if (total) {
            total.textContent = listaConversas.length;
        }

        aplicarFiltrosEBusca();

        if (conversaAtivaId) {
            await carregarMensagens(
                conversaAtivaId,
                true
            );
        }
    } catch (erro) {
        if (silencioso) return;

        console.error(
            "Erro ao carregar conversas:",
            erro
        );

        const container = $("conversasList");

        if (container) {
            container.innerHTML = `
                <div class="chat-loading">
                    Erro ao carregar conversas.
                </div>
            `;
        }
    }
}

function aplicarFiltrosEBusca() {
    const termo = termoBusca.toLowerCase().trim();

    const filtradas = listaConversas.filter(
        (conversa) => {
            const campos = [
                conversa.outro_usuario_nome,
                conversa.veiculo_modelo,
                conversa.veiculo_marca,
                conversa.ultima_mensagem
            ].map((valor) =>
                String(valor || "").toLowerCase()
            );

            const corresponde =
                !termo ||
                campos.some((campo) =>
                    campo.includes(termo)
                );

            if (filtroAtual === "nao-lidas") {
                return (
                    corresponde &&
                    Boolean(conversa.tem_nova)
                );
            }

            return corresponde;
        }
    );

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
            </div>
        `;
        return;
    }

    container.innerHTML = conversas
        .map((conversa) => {
            const conversaId = Number(conversa.id);

            const ativa =
                conversaId === Number(conversaAtivaId)
                    ? "ativo"
                    : "";

            const totalNaoLidas =
                Number(conversa.total_nao_lidas) || 0;

            const nova =
                totalNaoLidas > 0 ? "tem-nova" : "";

            const nome =
                conversa.outro_usuario_nome ||
                "Usuário";

            const iniciais = obterIniciais(nome);

            const data = new Date(
                conversa.ultimo_envio ||
                conversa.criado_em
            );

            const hora = Number.isNaN(data.getTime())
                ? ""
                : data.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit"
                });

            const temVeiculo = Boolean(
                conversa.veiculo_id
            );

            const referencia = conversa.veiculo_modelo
                ? `${conversa.veiculo_marca || ""} ${conversa.veiculo_modelo}`.trim()
                : temVeiculo
                    ? "Veículo em negociação"
                    : "Conversa direta";

            const iconeReferencia = temVeiculo
                ? "fa-car-side"
                : "fa-user";

            const foto =
                conversa.outro_usuario_foto ||
                conversa.foto_perfil;

            return `
                <div
                    class="conversa-item ${ativa} ${nova}"
                    data-id="${conversaId}"
                    tabindex="0"
                    role="button"
                    aria-label="Abrir conversa com ${esc(nome)}"
                >
                    <div class="av av-md">
                        ${
                            foto
                                ? `
                                    <img
                                        src="${esc(foto)}"
                                        alt="Foto de ${esc(nome)}"
                                        loading="lazy"
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

                            ${
                                totalNaoLidas > 0
                                    ? `
                                        <span class="badge-nova">
                                            ${
                                                totalNaoLidas > 99
                                                    ? "99+"
                                                    : totalNaoLidas
                                            }
                                        </span>
                                    `
                                    : ""
                            }
                        </div>

                        <span class="conversa-veic">
                            <i class="fa-solid ${iconeReferencia}"></i>
                            ${esc(referencia)}
                        </span>
                    </div>
                </div>
            `;
        })
        .join("");
}

async function abrirConversa(conversaId) {
    const id = Number(conversaId);

    if (!Number.isInteger(id) || id <= 0) {
        return;
    }

    conversaAtivaId = id;
    assinaturaMensagens = "";
    novasMensagensAbaixoCount = 0;

    $("chatWrapper")?.classList.add("em-conversa");

    if ($("chatEmptyState")) {
        $("chatEmptyState").hidden = true;
    }

    if ($("chatActiveBox")) {
        $("chatActiveBox").hidden = false;
    }

    const container = $("chatMessagesScroll");

    if (container) {
        container.innerHTML = `
            <div class="chat-loading">
                Carregando mensagens...
            </div>
        `;
    }

    document
        .querySelectorAll(".conversa-item")
        .forEach((item) => {
            item.classList.toggle(
                "ativo",
                Number(item.dataset.id) === id
            );
        });

    const conversa = listaConversas.find(
        (item) => Number(item.id) === id
    );

    if (conversa) {
        const nome =
            conversa.outro_usuario_nome || "Usuário";

        const temVeiculo = Boolean(conversa.veiculo_id);

        const referencia = conversa.veiculo_modelo
            ? `${conversa.veiculo_marca || ""} ${conversa.veiculo_modelo}`.trim()
            : temVeiculo
                ? "Veículo em negociação"
                : "Conversa direta";

        const iconeReferencia = temVeiculo
            ? "fa-car-side"
            : "fa-user";

        const foto =
            conversa.outro_usuario_foto ||
            conversa.foto_perfil;

        if ($("chatDestinatarioNome")) {
            $("chatDestinatarioNome").textContent =
                nome;
        }

        if ($("chatVeiculoRef")) {
            $("chatVeiculoRef").innerHTML = `
                <i class="fa-solid ${iconeReferencia}"></i>
                <span>${esc(referencia)}</span>
            `;
        }

        if ($("chatAvatar")) {
            $("chatAvatar").innerHTML = foto
                ? `
                    <img
                        src="${esc(foto)}"
                        alt="Foto de ${esc(nome)}"
                    >
                `
                : esc(obterIniciais(nome));
        }
    }

    const input = $("inputMensagem");

    if (input) {
        input.value = "";
        input.style.height = "auto";
        input.maxLength = MAX_CARACTERES_MENSAGEM;
        input.placeholder = "Escreva sua mensagem...";
    }

    mostrarFeedback("");
    atualizarEstadoDoFormulario();

    await carregarMensagens(id);
    await marcarConversaComoLida(id, true);
}

async function carregarMensagens(
    conversaId,
    silencioso = false
) {
    const container = $("chatMessagesScroll");

    if (!container || !conversaId) {
        return;
    }

    try {
        const dados = await requisitarApi(
            `/${conversaId}/mensagens`
        );

        if (
            Number(conversaAtivaId) !==
            Number(conversaId)
        ) {
            return;
        }

        const mensagens = Array.isArray(dados.mensagens)
            ? dados.mensagens
            : [];

        renderizarListaMensagens(
            mensagens,
            container
        );
    } catch (erro) {
        if (silencioso) return;

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

function ajustarLarguraBaloes() {
    const container = $("chatMessagesScroll");

    if (
        !container ||
        container.clientWidth <= 0
    ) {
        return;
    }

    const canvas = document.createElement("canvas");
    const contexto = canvas.getContext("2d");

    if (!contexto) return;

    const limitePercentual =
        window.innerWidth <= 767 ? 0.84 : 0.68;

    const larguraMaxima =
        container.clientWidth * limitePercentual;

    container
        .querySelectorAll(".msg-bubble")
        .forEach((balao) => {
            const textoElemento =
                balao.querySelector(".conteudo-texto");

            const rodape =
                balao.querySelector(".rodape-msg");

            if (!textoElemento) return;

            const estiloTexto =
                window.getComputedStyle(textoElemento);

            contexto.font = [
                estiloTexto.fontWeight || "400",
                estiloTexto.fontSize || "14px",
                estiloTexto.fontFamily || "Arial"
            ].join(" ");

            const texto =
                textoElemento.textContent.trim() || " ";

            const larguraTexto = Math.max(
                ...texto.split("\n").map((linha) =>
                    contexto.measureText(
                        linha || " "
                    ).width
                )
            );

            const larguraHora =
                rodape
                    ?.querySelector(".hora")
                    ?.getBoundingClientRect()
                    .width || 0;

            const larguraLeitura =
                rodape
                    ?.querySelector(".status-leitura")
                    ?.getBoundingClientRect()
                    .width || 0;

            const larguraRodape =
                larguraHora + larguraLeitura + 8;

            const larguraNecessaria =
                Math.max(
                    larguraTexto,
                    larguraRodape
                ) + 18;

            const larguraFinal = Math.min(
                Math.max(larguraNecessaria, 58),
                larguraMaxima
            );

            balao.style.setProperty(
                "width",
                `${Math.ceil(larguraFinal)}px`,
                "important"
            );

            balao.style.setProperty(
                "min-width",
                "0",
                "important"
            );

            balao.style.setProperty(
                "max-width",
                `${Math.floor(larguraMaxima)}px`,
                "important"
            );
        });
}

function renderizarListaMensagens(
    mensagens,
    container
) {
    const assinaturaAtual = mensagens
        .map((mensagem) => {
            const id = Number(mensagem.id);
            const lida = mensagem.lida_em ? 1 : 0;

            return `${id}:${lida}`;
        })
        .join(",");

    if (!mensagens.length) {
        container.innerHTML = `
            <div class="dia-sep">
                Início da conversa
            </div>

            <div class="msg-sistema">
                Envie a primeira mensagem.
            </div>
        `;

        assinaturaMensagens = "";
        novasMensagensAbaixoCount = 0;
        atualizarBotaoBaixoScroll();
        return;
    }

    if (assinaturaAtual === assinaturaMensagens) {
        ajustarLarguraBaloes();
        return;
    }

    const estavaNoFim =
        container.scrollHeight -
        container.scrollTop <=
        container.clientHeight + 100;

    const quantidadeAnterior = assinaturaMensagens
        ? assinaturaMensagens
            .split(",")
            .filter(Boolean)
            .length
        : 0;

    const elementos = mensagens
        .map((mensagem) => {
            const minha =
                Number(mensagem.enviada_por_mim) === 1 ||
                Number(mensagem.remetente_id) ===
                Number(meuUsuarioId);

            const data = new Date(
                mensagem.criado_em
            );

            const hora = Number.isNaN(data.getTime())
                ? "Agora"
                : data.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit"
                });

            return `
                <div
                    class="msg-bubble ${
                        minha ? "enviada" : "recebida"
                    }"
                    data-id="${Number(mensagem.id)}"
                >
                    <span class="conteudo-texto">${esc(
                        mensagem.texto
                    )}</span>

                    <span class="rodape-msg">
                        <span class="hora">${esc(hora)}</span>

                        ${
                            minha
                                ? `
                                    <span
                                        class="status-leitura ${
                                            mensagem.lida_em
                                                ? "lida"
                                                : ""
                                        }"
                                        title="${
                                            mensagem.lida_em
                                                ? "Mensagem lida"
                                                : "Mensagem enviada"
                                        }"
                                        aria-label="${
                                            mensagem.lida_em
                                                ? "Mensagem lida"
                                                : "Mensagem enviada"
                                        }"
                                    >
                                        <i class="fa-solid ${
                                            mensagem.lida_em
                                                ? "fa-check-double"
                                                : "fa-check"
                                        }"></i>
                                    </span>
                                `
                                : ""
                        }

                        <button
                            type="button"
                            class="btn-opcoes-msg"
                            data-mensagem-id="${Number(
                                mensagem.id
                            )}"
                            data-minha="${
                                minha ? "true" : "false"
                            }"
                            title="Opções"
                            aria-label="Opções da mensagem"
                        >
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                    </span>
                </div>
            `;
        })
        .join("");

    container.innerHTML = `
        <div class="dia-sep">
            Mensagens
        </div>

        ${elementos}
    `;

    requestAnimationFrame(() => {
        ajustarLarguraBaloes();

        if (estavaNoFim) {
            container.scrollTop =
                container.scrollHeight;
        }
    });

    assinaturaMensagens = assinaturaAtual;

    if (estavaNoFim) {
        novasMensagensAbaixoCount = 0;
    } else {
        novasMensagensAbaixoCount += Math.max(
            0,
            mensagens.length - quantidadeAnterior
        );
    }

    atualizarBotaoBaixoScroll();
}

async function enviarMensagem(evento) {
    evento?.preventDefault();

    const input = $("inputMensagem");
    const botao = $("btnEnviarMensagem");

    if (!input || !conversaAtivaId) {
        return;
    }

    const texto = input.value.trim();

    if (!texto) return;

    if (texto.length > MAX_CARACTERES_MENSAGEM) {
        const aviso =
            `A mensagem pode ter no máximo ${MAX_CARACTERES_MENSAGEM} caracteres.`;

        mostrarFeedback(aviso, true);
        exibirToast(aviso, "erro");
        return;
    }

    if (botao) {
        botao.disabled = true;
    }

    mostrarFeedback("");

    try {
        await requisitarApi(
            `/${conversaAtivaId}/mensagem`,
            {
                method: "POST",
                body: JSON.stringify({ texto })
            }
        );

        input.value = "";
        input.style.height = "auto";
        assinaturaMensagens = "";

        await carregarMensagens(
            conversaAtivaId,
            true
        );

        await carregarConversas(true);
    } catch (erro) {
        console.error(
            "Erro ao enviar mensagem:",
            erro
        );

        mostrarFeedback(
            erro.message || "Erro ao enviar mensagem.",
            true
        );

        exibirToast(
            erro.message || "Erro ao enviar mensagem.",
            "erro"
        );
    } finally {
        atualizarEstadoDoFormulario();
        input.focus();
    }
}

function atualizarBotaoBaixoScroll() {
    const botao = $("btnBaixo");
    const contador = $("baixoContador");
    const container = $("chatMessagesScroll");

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

function fecharModalDelecao() {
    const modal = $("modalDeleteMsg");

    if (modal) {
        modal.hidden = true;
    }

    mensagemSelecionadaId = null;
}

function abrirMenuExclusao(mensagemId, minha) {
    if (
        !Number.isInteger(mensagemId) ||
        mensagemId <= 0
    ) {
        return;
    }

    mensagemSelecionadaId = mensagemId;

    const modal = $("modalDeleteMsg");

    if (!modal) return;

    const botaoTodos = $("btnDeleteParaTodos");
    const texto = $("modalDeleteTexto");

    if (botaoTodos) {
        botaoTodos.hidden = !minha;
    }

    if (texto) {
        texto.textContent = minha
            ? "Você pode apagar esta mensagem para você ou para todos."
            : "Você pode apagar esta mensagem apenas para você.";
    }

    modal.hidden = false;
}

async function apagarMensagem(mensagemId, tipo) {
    try {
        await requisitarApi(
            `/mensagem/${mensagemId}`,
            {
                method: "DELETE",
                body: JSON.stringify({ tipo })
            }
        );

        assinaturaMensagens = "";

        exibirToast(
            tipo === "para_todos"
                ? "Mensagem removida para todos."
                : "Mensagem removida para você."
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
            erro.message || "Erro ao apagar mensagem.",
            "erro"
        );
    }
}

function inicializarPaineisAuxiliares() {
    const painelEmoji = $("emojiPanel");
    const respostas = $("respostasRapidas");

    if (painelEmoji) {
        painelEmoji.innerHTML = EMOJIS
            .map((emoji) => `
                <button
                    type="button"
                    aria-label="Adicionar emoji ${emoji}"
                >
                    ${emoji}
                </button>
            `)
            .join("");

        painelEmoji.addEventListener(
            "click",
            (evento) => {
                const botao =
                    evento.target.closest("button");

                const input = $("inputMensagem");

                if (
                    !botao ||
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
        respostas.innerHTML = RESPOSTAS_RAPIDAS
            .map((texto) => `
                <button
                    type="button"
                    class="resposta-chip"
                >
                    ${esc(texto)}
                </button>
            `)
            .join("");

        respostas.addEventListener(
            "click",
            (evento) => {
                const botao = evento.target.closest(
                    ".resposta-chip"
                );

                const input = $("inputMensagem");

                if (!botao || !input) return;

                input.value =
                    botao.textContent.trim();

                input.dispatchEvent(
                    new Event("input")
                );

                input.focus();
            }
        );
    }

    $("btnEmoji")?.addEventListener("click", () => {
        if (painelEmoji) {
            painelEmoji.hidden =
                !painelEmoji.hidden;
        }

        if (respostas) {
            respostas.hidden = true;
        }
    });

    $("btnRapidas")?.addEventListener(
        "click",
        () => {
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

function estadoInicialBuscaContas() {
    const lista = $("listaUsuariosBusca");

    if (!lista) return;

    lista.innerHTML = `
        <div class="resultado-contas-vazio">
            <i class="fa-solid fa-user-group"></i>

            <span>
                Pesquise uma conta para iniciar uma conversa.
            </span>
        </div>
    `;
}

function mostrarEstadoBuscaContas(
    mensagem,
    icone = "fa-magnifying-glass",
    erro = false
) {
    const lista = $("listaUsuariosBusca");

    if (!lista) return;

    lista.innerHTML = `
        <div class="resultado-contas-vazio ${
            erro ? "erro" : ""
        }">
            <i class="fa-solid ${esc(icone)}"></i>
            <span>${esc(mensagem)}</span>
        </div>
    `;
}

function abrirModalNovaConversa() {
    const modal = $("modalNovaConversa");
    const input = $("inputBuscaUsuarios");

    if (!modal || !input) return;

    if (temporizadorBuscaUsuarios) {
        clearTimeout(temporizadorBuscaUsuarios);
        temporizadorBuscaUsuarios = null;
    }

    controleBuscaUsuarios?.abort();
    controleBuscaUsuarios = null;

    input.value = "";
    modal.hidden = false;

    estadoInicialBuscaContas();

    requestAnimationFrame(() => {
        input.focus();
    });
}

function fecharModalNovaConversa() {
    const modal = $("modalNovaConversa");
    const input = $("inputBuscaUsuarios");

    if (temporizadorBuscaUsuarios) {
        clearTimeout(temporizadorBuscaUsuarios);
        temporizadorBuscaUsuarios = null;
    }

    controleBuscaUsuarios?.abort();
    controleBuscaUsuarios = null;

    if (modal) {
        modal.hidden = true;
    }

    if (input) {
        input.value = "";
    }

    estadoInicialBuscaContas();
}

function renderizarUsuariosEncontrados(usuarios) {
    const lista = $("listaUsuariosBusca");

    if (!lista) return;

    if (
        !Array.isArray(usuarios) ||
        usuarios.length === 0
    ) {
        mostrarEstadoBuscaContas(
            "Nenhuma conta encontrada.",
            "fa-user-slash"
        );
        return;
    }

    lista.innerHTML = usuarios
        .map((usuario) => {
            const id = Number(usuario.id);

            const nome = String(
                usuario.nome ||
                usuario.nome_usuario ||
                usuario.nome_empresa ||
                "Usuário"
            ).trim();

            const tipo =
                String(usuario.tipo || "individual")
                    .toLowerCase() === "empresa"
                    ? "Empresa"
                    : "Pessoa";

            const iniciais = obterIniciais(nome);

            const foto = usuario.foto_perfil
                ? `
                    <img
                        src="${esc(usuario.foto_perfil)}"
                        alt="Foto de ${esc(nome)}"
                        loading="lazy"
                    >
                `
                : esc(iniciais);

            return `
                <button
                    type="button"
                    class="resultado-conta"
                    data-usuario-id="${id}"
                    aria-label="Iniciar conversa com ${esc(nome)}"
                >
                    <span class="resultado-conta-avatar">
                        ${foto}
                    </span>

                    <span class="resultado-conta-info">
                        <strong>${esc(nome)}</strong>
                        <small>${esc(tipo)}</small>
                    </span>

                    <i
                        class="fa-solid fa-chevron-right resultado-conta-seta"
                        aria-hidden="true"
                    ></i>
                </button>
            `;
        })
        .join("");
}

async function pesquisarUsuarios(termoInformado) {
    const termo = String(termoInformado || "")
        .replace(/\s+/g, " ")
        .trim();

    if (termo.length < 2) {
        estadoInicialBuscaContas();
        return;
    }

    controleBuscaUsuarios?.abort();
    controleBuscaUsuarios = new AbortController();

    mostrarEstadoBuscaContas(
        "Procurando contas...",
        "fa-spinner fa-spin"
    );

    try {
        const token = obterToken();

        const resposta = await fetch(
            `${API_URL}/usuarios/buscar?termo=${encodeURIComponent(termo)}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                signal: controleBuscaUsuarios.signal
            }
        );

        const dados = await resposta
            .json()
            .catch(() => ({}));

        if (resposta.status === 401) {
            limparSessaoEIrParaLogin();
            return;
        }

        if (!resposta.ok) {
            throw new Error(
                dados.erro ||
                dados.mensagem ||
                "Não foi possível pesquisar as contas."
            );
        }

        const input = $("inputBuscaUsuarios");

        const termoAtual = input
            ? input.value
                .replace(/\s+/g, " ")
                .trim()
            : "";

        if (termoAtual !== termo) {
            return;
        }

        renderizarUsuariosEncontrados(
            dados.usuarios
        );
    } catch (erro) {
        if (erro.name === "AbortError") {
            return;
        }

        console.error(
            "Erro ao pesquisar contas:",
            erro
        );

        mostrarEstadoBuscaContas(
            erro.message ||
            "Erro ao pesquisar contas.",
            "fa-triangle-exclamation",
            true
        );
    }
}

async function iniciarConversaDireta(
    usuarioId,
    botao
) {
    const destinatarioId = Number(usuarioId);

    if (
        iniciandoConversaDireta ||
        !Number.isInteger(destinatarioId) ||
        destinatarioId <= 0
    ) {
        return;
    }

    iniciandoConversaDireta = true;

    const conteudoOriginal = botao?.innerHTML;

    if (botao) {
        botao.disabled = true;

        botao.innerHTML = `
            <span class="resultado-conta-info">
                <strong>Abrindo conversa...</strong>
                <small>Aguarde um momento</small>
            </span>

            <i class="fa-solid fa-spinner fa-spin"></i>
        `;
    }

    try {
        const dados = await requisitarApi(
            "/iniciar-direta",
            {
                method: "POST",
                body: JSON.stringify({
                    destinatario_id: destinatarioId
                })
            }
        );

        const conversaId = Number(
            dados.conversa_id
        );

        if (
            !Number.isInteger(conversaId) ||
            conversaId <= 0
        ) {
            throw new Error(
                "O servidor não retornou a conversa criada."
            );
        }

        fecharModalNovaConversa();

        await carregarConversas(true);
        await abrirConversa(conversaId);

        exibirToast(
            dados.conversa_criada
                ? "Nova conversa iniciada."
                : "Conversa aberta."
        );

        const url = new URL(window.location.href);

        url.searchParams.set(
            "conversa",
            String(conversaId)
        );

        window.history.replaceState({}, "", url);
    } catch (erro) {
        console.error(
            "Erro ao iniciar conversa:",
            erro
        );

        exibirToast(
            erro.message ||
            "Erro ao iniciar a conversa.",
            "erro"
        );

        if (botao && conteudoOriginal) {
            botao.innerHTML = conteudoOriginal;
            botao.disabled = false;
        }
    } finally {
        iniciandoConversaDireta = false;
    }
}

function inicializarBuscaContas() {
    const modal = $("modalNovaConversa");
    const input = $("inputBuscaUsuarios");
    const lista = $("listaUsuariosBusca");

    $("btnNovaConversa")?.addEventListener(
        "click",
        abrirModalNovaConversa
    );

    $("btnFecharNovaConversa")?.addEventListener(
        "click",
        fecharModalNovaConversa
    );

    modal?.addEventListener("click", (evento) => {
        if (evento.target === modal) {
            fecharModalNovaConversa();
        }
    });

    input?.addEventListener("input", () => {
        if (temporizadorBuscaUsuarios) {
            clearTimeout(temporizadorBuscaUsuarios);
        }

        const termo = input.value;

        if (termo.trim().length < 2) {
            controleBuscaUsuarios?.abort();
            estadoInicialBuscaContas();
            return;
        }

        temporizadorBuscaUsuarios = setTimeout(
            () => pesquisarUsuarios(termo),
            TEMPO_ESPERA_BUSCA
        );
    });

    lista?.addEventListener("click", (evento) => {
        const botao = evento.target.closest(
            ".resultado-conta[data-usuario-id]"
        );

        if (!botao) return;

        iniciarConversaDireta(
            botao.dataset.usuarioId,
            botao
        );
    });

    estadoInicialBuscaContas();
}

function inicializarEventosInterface() {
    $("inputPesquisaConversa")?.addEventListener(
        "input",
        (evento) => {
            termoBusca = evento.target.value;
            aplicarFiltrosEBusca();
        }
    );

    document
        .querySelectorAll(".filtro")
        .forEach((botao) => {
            botao.addEventListener("click", () => {
                document
                    .querySelectorAll(".filtro")
                    .forEach((item) => {
                        item.classList.remove("ativo");
                        item.setAttribute(
                            "aria-selected",
                            "false"
                        );
                    });

                botao.classList.add("ativo");

                botao.setAttribute(
                    "aria-selected",
                    "true"
                );

                filtroAtual =
                    botao.dataset.filtro;

                aplicarFiltrosEBusca();
            });
        });

    $("conversasList")?.addEventListener(
        "click",
        (evento) => {
            const item = evento.target.closest(
                ".conversa-item"
            );

            if (item) {
                abrirConversa(item.dataset.id);
            }
        }
    );

    $("conversasList")?.addEventListener(
        "keydown",
        (evento) => {
            if (
                evento.key !== "Enter" &&
                evento.key !== " "
            ) {
                return;
            }

            const item = evento.target.closest(
                ".conversa-item"
            );

            if (!item) return;

            evento.preventDefault();
            abrirConversa(item.dataset.id);
        }
    );

    $("btnListaVoltar")?.addEventListener(
        "click",
        () => {
            $("chatWrapper")?.classList.remove(
                "em-conversa"
            );
        }
    );

    const container = $("chatMessagesScroll");

    container?.addEventListener(
        "scroll",
        atualizarBotaoBaixoScroll
    );

    container?.addEventListener(
        "click",
        (evento) => {
            const botao = evento.target.closest(
                ".btn-opcoes-msg"
            );

            if (!botao) return;

            abrirMenuExclusao(
                Number(botao.dataset.mensagemId),
                botao.dataset.minha === "true"
            );
        }
    );

    $("btnBaixo")?.addEventListener(
        "click",
        () => {
            if (!container) return;

            container.scrollTop =
                container.scrollHeight;

            novasMensagensAbaixoCount = 0;
            atualizarBotaoBaixoScroll();
        }
    );

    const input = $("inputMensagem");

    if (input) {
        input.maxLength =
            MAX_CARACTERES_MENSAGEM;

        input.disabled = true;

        input.addEventListener("input", () => {
            input.style.height = "auto";

            input.style.height =
                `${Math.min(
                    input.scrollHeight,
                    130
                )}px`;

            atualizarEstadoDoFormulario();
        });

        input.addEventListener(
            "keydown",
            (evento) => {
                if (
                    evento.key === "Enter" &&
                    !evento.shiftKey
                ) {
                    evento.preventDefault();
                    $("chatForm")?.requestSubmit();
                }
            }
        );
    }

    $("chatForm")?.addEventListener(
        "submit",
        enviarMensagem
    );

    $("modalDeleteMsg")?.addEventListener(
        "click",
        (evento) => {
            if (
                evento.target ===
                $("modalDeleteMsg")
            ) {
                fecharModalDelecao();
            }
        }
    );

    $("btnDeleteCancelar")?.addEventListener(
        "click",
        fecharModalDelecao
    );

    $("btnDeleteParaTodos")?.addEventListener(
        "click",
        async () => {
            const id = mensagemSelecionadaId;

            fecharModalDelecao();

            if (id) {
                await apagarMensagem(
                    id,
                    "para_todos"
                );
            }
        }
    );

    $("btnDeleteParaMim")?.addEventListener(
        "click",
        async () => {
            const id = mensagemSelecionadaId;

            fecharModalDelecao();

            if (id) {
                await apagarMensagem(
                    id,
                    "para_mim"
                );
            }
        }
    );

    document.addEventListener(
        "keydown",
        (evento) => {
            if (evento.key === "Escape") {
                fecharModalDelecao();
                fecharModalNovaConversa();
            }
        }
    );
}

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        const sessao = obterSessao();
        const token = obterToken();

        if (!sessao || !token) {
            window.location.replace(LOGIN_URL);
            return;
        }

        meuUsuarioId = Number(
            sessao.id ||
            sessao._id ||
            sessao.usuario_id
        );

        if (
            !Number.isInteger(meuUsuarioId) ||
            meuUsuarioId <= 0
        ) {
            window.location.replace(LOGIN_URL);
            return;
        }

        configurarNavegacao(sessao);
        inicializarPaineisAuxiliares();
        inicializarBuscaContas();
        inicializarEventosInterface();
        inicializarSocketPrivado();

        await carregarConversas();

        const parametros = new URLSearchParams(
            window.location.search
        );

        const conversaUrlId =
            parametros.get("conversa");

        if (conversaUrlId) {
            await abrirConversa(conversaUrlId);
        } else if (
            listaConversas.length > 0 &&
            window.innerWidth >= 768
        ) {
            await abrirConversa(
                listaConversas[0].id
            );
        }
    }
);

window.addEventListener("resize", () => {
    if (temporizadorAjusteBaloes) {
        clearTimeout(
            temporizadorAjusteBaloes
        );
    }

    temporizadorAjusteBaloes = setTimeout(
        ajustarLarguraBaloes,
        120
    );
});

window.addEventListener("beforeunload", () => {
    if (temporizadorAjusteBaloes) {
        clearTimeout(
            temporizadorAjusteBaloes
        );
    }

    if (temporizadorBuscaUsuarios) {
        clearTimeout(
            temporizadorBuscaUsuarios
        );
    }

    controleBuscaUsuarios?.abort();
    socketPrivado?.disconnect();
});