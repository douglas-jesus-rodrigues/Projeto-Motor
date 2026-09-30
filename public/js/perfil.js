"use strict";

// ==========================================================
// CONFIG
// ==========================================================
const LOGIN_URL = "/pages/login.html";

// Para onde cada tipo de login volta. Qualquer outro tipo (cliente, individual...) vai ao painel do cliente.
const PAINEL_POR_TIPO = {
    admin: "/pages/painel-admin.html",
    empresa: "/pages/painel-empresa.html"
};
const PAINEL_PADRAO = "/pages/painel-cliente.html";

const ROTULOS_TIPO = { admin: "Administrador", empresa: "Conta Jurídica", individual: "Conta Individual" };
const ROTULOS_VERIFICACAO = {
    pendente: ["Em análise", "Estamos analisando os dados da sua empresa."],
    aprovada: ["Verificada", "Sua empresa foi aprovada."],
    recusada: ["Recusada", "Sua empresa não foi aprovada."]
};
const SUBTITULO_POR_TIPO = {
    admin: "Dados da sua conta de administrador da plataforma.",
    empresa: "Dados do responsável e da empresa cadastrada na plataforma.",
    individual: "Visualize os dados de cadastro da sua conta na plataforma."
};
const MASCARA_CPF = "***.***.***-**";
const MASCARA_SENHA = "********";
const AUTO_OCULTAR_MS = 30000;      // dados revelados voltam a ficar mascarados sozinhos

// ==========================================================
// ESTADO
// ==========================================================
const $ = (id) => document.getElementById(id);
const dadosReais = { email: "", cpf: "" };   // a senha NUNCA fica guardada aqui
const timers = {};
let sessao = null;                           // { dados, storage, chave }
let usuarioId = null;
let focoAnterior = null;

// ==========================================================
// SESSÃO
// ==========================================================
function obterSessao() {
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

const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");
const authHeaders = () => {
    const token = getToken();
    return { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) };
};

const tipoNormalizado = (t) => String(t || "individual").toLowerCase().trim();
const painelDoTipo = (t) => PAINEL_POR_TIPO[tipoNormalizado(t)] || PAINEL_PADRAO;

function configurarBotaoVoltar(tipo) {
    const destino = painelDoTipo(tipo);
    ["btnVoltar", "logoLink"].forEach((id) => { const el = $(id); if (el) el.setAttribute("href", destino); });
}

// ==========================================================
// AVISOS
// ==========================================================
function toast(msg, tipo = "ok") {
    const t = document.createElement("div");
    t.className = `toast toast--${tipo}`;
    t.innerHTML = `<i class="fa-solid ${tipo === "erro" ? "fa-circle-exclamation" : "fa-circle-check"}"></i><span></span>`;
    t.querySelector("span").textContent = msg;
    $("toastArea").appendChild(t);
    requestAnimationFrame(() => t.classList.add("visivel"));
    setTimeout(() => { t.classList.remove("visivel"); setTimeout(() => t.remove(), 300); }, 3500);
}

// ==========================================================
// FORMATAÇÃO
// ==========================================================
function gerarMascaraEmail(email) {
    if (!email || !email.includes("@")) return "******";
    const [usuario, dominio] = email.split("@");
    return usuario.length <= 3 ? `${usuario}***@${dominio}` : `${usuario.substring(0, 3)}***@${dominio}`;
}

function formatarCPF(cpf) {
    if (!cpf) return "";
    return String(cpf).replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatarCNPJ(cnpj) {
    if (!cnpj) return "";
    return String(cnpj).replace(/\D/g, "").replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatarTelefone(tel) {
    if (!tel) return "";
    const limpo = String(tel).replace(/\D/g, "");
    return limpo.length === 11
        ? limpo.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
        : limpo.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
}

function formatarCEP(cep) {
    const l = String(cep || "").replace(/\D/g, "");
    return l.length === 8 ? l.replace(/(\d{5})(\d{3})/, "$1-$2") : (cep || "");
}

function formatarData(d) {
    if (!d) return "";
    const dt = new Date(d);
    return isNaN(dt) ? "" : dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const setValor = (id, valor) => { const el = $(id); if (el) el.value = valor || ""; };

// ==========================================================
// PERFIL (carregar e preencher)
// ==========================================================
const urlUpload = (f) => (/^(https?:)?\//.test(f) ? f : `/uploads/${f}`);

function montarAvatar(foto, nomeCompleto) {
    const avatar = $("heroAvatar"), iniciais = $("heroIniciais");
    const partes = nomeCompleto.split(/\s+/).filter(Boolean);
    iniciais.textContent = partes.length ? (partes[0][0] + (partes[1] ? partes[1][0] : "")).toUpperCase() : "?";

    avatar.querySelector("img")?.remove();
    iniciais.hidden = false;
    if (!foto) return;

    const img = new Image();
    img.alt = "";
    img.src = urlUpload(foto);
    img.onload = () => { iniciais.hidden = true; avatar.appendChild(img); };   // se falhar, ficam as iniciais
}

// Mostra só as seções que fazem sentido para o tipo de login
function aplicarSecoes(tipo, temEndereco) {
    $("secaoEmpresa").hidden = tipo !== "empresa";
    $("secaoAdmin").hidden = tipo !== "admin";
    $("secaoEndereco").hidden = !temEndereco;
    $("tituloPessoal").textContent = tipo === "empresa" ? "Dados do responsável" : "Dados pessoais";
}

function preencherEmpresa(u) {
    setValor("cnpj", formatarCNPJ(u.cnpj));
    setValor("nomeEmpresa", u.nome_empresa);
    setValor("razaoSocial", u.razao_social);
    setValor("inscricaoEstadual", u.inscricao_estadual);
    setValor("site", u.site);

    const st = String(u.status_verificacao || "").toLowerCase();
    const [rotulo, nota] = ROTULOS_VERIFICACAO[st] || ["—", ""];
    const badge = $("badgeVerificacao");
    badge.className = `badge badge--${ROTULOS_VERIFICACAO[st] ? st : "neutro"}`;
    badge.textContent = rotulo;
    $("notaVerificacao").textContent = nota;

    const recusada = st === "recusada" && !!u.motivo_recusa;
    $("grupoMotivo").hidden = !recusada;
    setValor("motivoRecusa", recusada ? u.motivo_recusa : "");
}

function preencherEndereco(e) {
    setValor("cep", formatarCEP(e.cep));
    ["estado", "cidade", "bairro", "rua", "numero", "complemento"].forEach((k) => setValor(k, e[k]));
}

function preencherPerfil(u) {
    const tipo = tipoNormalizado(u.tipo);
    const nomeCompleto = `${u.nome || ""} ${u.sobrenome || ""}`.trim();
    const endereco = u.endereco && Object.values(u.endereco).some(Boolean) ? u.endereco : null;

    const badge = $("badgeTipoConta");
    badge.className = `badge badge--${ROTULOS_TIPO[tipo] ? tipo : "individual"}`;
    badge.textContent = ROTULOS_TIPO[tipo] || "Conta Individual";
    $("heroSub").textContent = SUBTITULO_POR_TIPO[tipo] || SUBTITULO_POR_TIPO.individual;

    // Empresa: nome da empresa em destaque e logo como avatar (se não houver foto pessoal)
    const tituloHero = tipo === "empresa" && u.nome_empresa ? u.nome_empresa : nomeCompleto;
    $("heroNome").textContent = tituloHero || "Meu perfil";
    montarAvatar(u.fotoUrl || u.foto_perfil || (tipo === "empresa" ? u.logo_empresa : ""), tituloHero);

    dadosReais.email = u.email || "";
    dadosReais.cpf = formatarCPF(u.cpf);
    setValor("nome", u.nome);
    setValor("sobrenome", u.sobrenome);
    setValor("telefone", formatarTelefone(u.telefone));

    // tudo sensível volta mascarado (também em recarregamentos)
    document.querySelectorAll(".btn-revelar").forEach((b) => ocultar(b));

    aplicarSecoes(tipo, !!endereco);
    if (tipo === "empresa") preencherEmpresa(u);
    if (tipo === "admin") {
        setValor("adminStatus", u.status ? u.status.charAt(0).toUpperCase() + u.status.slice(1) : "");
        setValor("adminUltimoLogin", formatarData(u.ultimo_login));
    }
    if (endereco) preencherEndereco(endereco);
}

async function carregarPerfil() {
    const form = $("formPerfil");
    form.classList.add("carregando");
    $("avisoErro").hidden = true;

    try {
        const resp = await fetch(`/api/perfil/meu-perfil?id=${encodeURIComponent(usuarioId)}`, { headers: authHeaders() });
        const dados = await resp.json().catch(() => ({}));
        if (!resp.ok || !dados.sucesso || !dados.usuario) {
            throw new Error(dados.mensagem || "Não foi possível carregar as informações atualizadas do servidor.");
        }

        // A senha vinda do servidor nunca é guardada no navegador
        const { senha, ...usuario } = dados.usuario;
        Object.assign(sessao.dados, usuario);
        delete sessao.dados.senha;
        sessao.storage.setItem(sessao.chave, JSON.stringify(sessao.dados));

        configurarBotaoVoltar(usuario.tipo);     // confirma o destino com o tipo vindo do servidor
        preencherPerfil(usuario);
    } catch (erro) {
        console.error("Erro ao carregar perfil do banco:", erro);
        $("avisoErroTexto").textContent = `${erro.message} Mostrando os dados salvos neste navegador.`;
        $("avisoErro").hidden = false;
        const { senha, ...cache } = sessao.dados;
        preencherPerfil(cache);
    } finally {
        form.classList.remove("carregando");
    }
}

// ==========================================================
// BOTÕES "VER" / "OCULTAR"
// ==========================================================
function marcarBotao(botao, visivel) {
    botao.dataset.visivel = visivel ? "1" : "0";
    botao.textContent = visivel ? "Ocultar" : "Ver";
    botao.classList.toggle("ativo", visivel);
    botao.setAttribute("aria-pressed", String(visivel));
}

function ocultar(botao) {
    const alvo = botao.dataset.alvo, input = $(alvo);
    clearTimeout(timers[alvo]);
    if (input) {
        if (alvo === "email") input.value = dadosReais.email ? gerarMascaraEmail(dadosReais.email) : "";
        else if (alvo === "cpf") input.value = dadosReais.cpf ? MASCARA_CPF : "";
        else if (alvo === "senhaAtualPerfil") { input.value = MASCARA_SENHA; input.type = "password"; }
    }
    marcarBotao(botao, false);
}

function revelar(botao) {
    const alvo = botao.dataset.alvo, input = $(alvo);
    if (!input) return;

    if (botao.dataset.visivel === "1") { ocultar(botao); return; }
    if (alvo === "senhaAtualPerfil") { abrirModalSenha(); return; }   // senha exige confirmação
    if (!dadosReais[alvo]) return;

    input.value = dadosReais[alvo];
    marcarBotao(botao, true);
    clearTimeout(timers[alvo]);
    timers[alvo] = setTimeout(() => ocultar(botao), AUTO_OCULTAR_MS);
}

function configurarBotoesRevelar() {
    document.querySelectorAll(".btn-revelar").forEach((botao) => botao.addEventListener("click", () => revelar(botao)));
}

// ==========================================================
// MODAL DE SENHA
// ==========================================================
function mostrarErroSenha(msg) {
    const erro = $("erroSenha");
    erro.textContent = msg || "";
    erro.hidden = !msg;
    document.querySelector(".campo-modal").classList.toggle("invalido", !!msg);
}

function abrirModalSenha() {
    focoAnterior = document.activeElement;
    const input = $("senhaDigitadaModal");
    input.value = "";
    input.type = "password";
    const ver = $("btnVerSenhaModal");
    ver.textContent = "Ver";
    ver.setAttribute("aria-pressed", "false");
    mostrarErroSenha("");
    $("modalSenha").hidden = false;
    input.focus();
}

function fecharModalSenha() {
    $("modalSenha").hidden = true;
    $("senhaDigitadaModal").value = "";
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
}

function toggleSenhaModal() {
    const input = $("senhaDigitadaModal"), botao = $("btnVerSenhaModal");
    const mostrar = input.type === "password";
    input.type = mostrar ? "text" : "password";
    botao.textContent = mostrar ? "Ocultar" : "Ver";
    botao.setAttribute("aria-pressed", String(mostrar));
}

async function confirmarSenhaModal() {
    const input = $("senhaDigitadaModal"), botao = $("btnConfirmarModal");
    const senhaDigitada = input.value;

    if (!senhaDigitada) {
        mostrarErroSenha("Por favor, digite sua senha atual.");
        input.focus();
        return;
    }
    if (!usuarioId) {
        toast("Sessão expirada. Faça login novamente.", "erro");
        window.location.href = LOGIN_URL;
        return;
    }

    botao.disabled = true;
    botao.textContent = "Verificando...";
    mostrarErroSenha("");

    try {
        const resp = await fetch("/api/usuarios/verificar-senha", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ id: usuarioId, senha: senhaDigitada })
        });
        const resultado = await resp.json().catch(() => ({}));

        if (resultado.sucesso) {
            // o servidor só confirma; mostramos a senha que o próprio usuário acabou de digitar
            const campo = $("senhaAtualPerfil"), botaoSenha = document.querySelector('[data-alvo="senhaAtualPerfil"]');
            campo.value = senhaDigitada;
            campo.type = "text";
            marcarBotao(botaoSenha, true);
            clearTimeout(timers.senhaAtualPerfil);
            timers.senhaAtualPerfil = setTimeout(() => ocultar(botaoSenha), AUTO_OCULTAR_MS);
            fecharModalSenha();
        } else {
            mostrarErroSenha(resultado.erro || resultado.mensagem || "Senha incorreta.");
            input.value = "";
            input.focus();
        }
    } catch (erro) {
        console.error("Erro ao validar senha:", erro);
        mostrarErroSenha("Erro de conexão ao tentar validar a senha.");
    } finally {
        botao.disabled = false;
        botao.textContent = "Confirmar";
    }
}

function configurarModal() {
    const modal = $("modalSenha");
    $("btnCancelarModal").addEventListener("click", fecharModalSenha);
    $("btnConfirmarModal").addEventListener("click", confirmarSenhaModal);
    $("btnVerSenhaModal").addEventListener("click", toggleSenhaModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) fecharModalSenha(); });
    $("senhaDigitadaModal").addEventListener("input", () => mostrarErroSenha(""));
    document.addEventListener("keydown", (e) => {
        if (modal.hidden) return;
        if (e.key === "Escape") fecharModalSenha();
        else if (e.key === "Enter" && document.activeElement === $("senhaDigitadaModal")) { e.preventDefault(); confirmarSenhaModal(); }
    });
}

// ==========================================================
// INIT
// ==========================================================
document.addEventListener("DOMContentLoaded", async () => {
    sessao = obterSessao();
    if (!sessao) { window.location.replace(LOGIN_URL); return; }

    usuarioId = sessao.dados.id ?? sessao.dados._id ?? null;

    configurarBotaoVoltar(sessao.dados.tipo);

    $("formPerfil").addEventListener("submit", (e) => e.preventDefault());
    $("btnTentarNovamente").addEventListener("click", carregarPerfil);
    configurarBotoesRevelar();
    configurarModal();

    await carregarPerfil();
});