"use strict";

// ==========================================================
// CONFIG
// ==========================================================
const API_URL = "/api/admin";
const LOGIN_URL = "/pages/login.html";

// Para onde cada tipo de login "volta"
const PAINEL_POR_TIPO = {
    admin: "/pages/painel-admin.html",
    empresa: "/pages/painel-empresa.html"
};
const PAINEL_PADRAO = "/pages/painel-cliente.html";

const ROTULOS = { admin: "Admin", empresa: "Empresa", individual: "Individual" };
const ICONES = { admin: "fa-user-shield", empresa: "fa-building", individual: "fa-user" };

// ==========================================================
// ESTADO
// ==========================================================
const $ = (id) => document.getElementById(id);
let listaUsuariosGlobal = [];
let filtroTipo = "todos";
let termoBusca = "";
let meuId = null;

// ==========================================================
// SESSÃO / NAVEGAÇÃO
// ==========================================================
function lerSessao() {
    const bruto =
        localStorage.getItem("usuario") || localStorage.getItem("usuario_logado") ||
        sessionStorage.getItem("usuario") || sessionStorage.getItem("usuario_logado");
    try { return bruto ? JSON.parse(bruto) : null; } catch { return null; }
}

const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");
const normalizarTipo = (t) => String(t || "individual").toLowerCase().trim();
const painelDoUsuario = (u) => PAINEL_POR_TIPO[normalizarTipo(u && u.tipo)] || PAINEL_PADRAO;

function configurarNavegacao(sessao) {
    const destino = painelDoUsuario(sessao);
    ["logoLink", "linkInicio", "btnVoltar"].forEach((id) => {
        const el = $(id);
        if (el) el.setAttribute("href", destino);
    });
    if (normalizarTipo(sessao.tipo) !== "admin") $("linkModeracao")?.remove();
    return destino;
}

// ==========================================================
// UTILIDADES
// ==========================================================
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function nomeDe(u) { return `${u.nome || ""} ${u.sobrenome || ""}`.trim() || "Não informado"; }

function iniciaisDe(u) {
    const partes = nomeDe(u) === "Não informado" ? [] : nomeDe(u).split(/\s+/);
    if (partes.length) return (partes[0][0] + (partes[1] ? partes[1][0] : "")).toUpperCase();
    return String(u.email || "?")[0].toUpperCase();
}

function matiz(u) {
    const base = String(u.email || u.id || "");
    let h = 0;
    for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) % 360;
    return h;
}

async function api(caminho, opcoes = {}) {
    const token = getToken();
    const resp = await fetch(`${API_URL}${caminho}`, {
        ...opcoes,
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }), ...opcoes.headers }
    });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(dados.erro || dados.mensagem || `Erro ${resp.status} ao falar com o servidor.`);
    return dados;
}

// ==========================================================
// AVISOS E CONFIRMAÇÃO COM SENHA
// ==========================================================
function toast(msg, tipo = "ok") {
    const area = $("toastArea");
    if (!area) return;

    const t = document.createElement("div");
    t.className = `toast toast--${tipo}`;
    t.innerHTML = `<i class="fa-solid ${tipo === "erro" ? "fa-circle-exclamation" : "fa-circle-check"}"></i><span></span>`;
    t.querySelector("span").textContent = msg;
    area.appendChild(t);
    requestAnimationFrame(() => t.classList.add("visivel"));
    setTimeout(() => { t.classList.remove("visivel"); setTimeout(() => t.remove(), 300); }, 3500);
}

function confirmar({ titulo, texto, botao = "Confirmar", perigo = false }) {
    return new Promise((resolve) => {
        const modal = $("modalConfirma"), ok = $("confirmaOk"), cancelar = $("confirmaCancelar");
        const inputSenha = $("inputSenhaAdmin");
        
        if (!modal) { 
            const resp = confirm(texto);
            resolve({ ok: resp, senha: resp ? prompt("Insira a sua senha de Admin:") || "" : "" }); 
            return; 
        }

        const anterior = document.activeElement;

        $("confirmaTitulo").textContent = titulo;
        $("confirmaTexto").textContent = texto;
        if (inputSenha) inputSenha.value = "";
        
        ok.textContent = botao;
        ok.className = `btn-modal ${perigo ? "btn-perigo" : "btn-primario"}`;

        const fechar = (confirmado) => {
            const senhaVal = inputSenha ? inputSenha.value : "";
            modal.hidden = true;
            document.removeEventListener("keydown", aoTeclar);
            modal.removeEventListener("click", aoClicarFora);
            ok.removeEventListener("click", aoOk);
            cancelar.removeEventListener("click", aoCancelar);
            if (anterior && anterior.focus) anterior.focus();
            resolve({ ok: confirmado, senha: senhaVal });
        };

        const aoOk = () => {
            if (inputSenha && !inputSenha.value.trim()) {
                toast("Insira a sua senha para continuar.", "erro");
                inputSenha.focus();
                return;
            }
            fechar(true);
        };
        const aoCancelar = () => fechar(false);
        const aoClicarFora = (e) => { if (e.target === modal) fechar(false); };
        const aoTeclar = (e) => { 
            if (e.key === "Escape") fechar(false); 
            if (e.key === "Enter") aoOk(); 
        };

        ok.addEventListener("click", aoOk);
        cancelar.addEventListener("click", aoCancelar);
        modal.addEventListener("click", aoClicarFora);
        document.addEventListener("keydown", aoTeclar);
        
        modal.hidden = false;
        if (inputSenha) inputSenha.focus();
    });
}

// ==========================================================
// CARREGAR DADOS
// ==========================================================
function mostrarSkeleton() {
    const tbody = $("tabelaUsuarios");
    if (!tbody) return;
    const linha = `<tr class="estado-skel">
        <td data-label="ID"><span class="skeleton" style="width:36px; display:inline-block; height:16px;"></span></td>
        <td data-label="Usuário"><div class="user"><span class="skeleton skeleton--avatar" style="width:42px; height:42px; border-radius:50%; display:inline-block;"></span><span class="skeleton" style="width:130px; display:inline-block; height:16px;"></span></div></td>
        <td data-label="E-mail"><span class="skeleton" style="width:180px; display:inline-block; height:16px;"></span></td>
        <td data-label="Tipo de acesso"><span class="skeleton" style="width:80px; display:inline-block; height:16px;"></span></td>
        <td class="col-acoes"><span class="skeleton" style="width:150px; margin-left:auto; display:block; height:16px;"></span></td>
    </tr>`;
    tbody.innerHTML = linha.repeat(5);
}

async function carregarUsuarios({ silencioso = false } = {}) {
    if (!silencioso) mostrarSkeleton();
    try {
        const dados = await api("/usuarios");
        listaUsuariosGlobal = Array.isArray(dados) ? dados : (dados.usuarios || []);
        atualizarResumo();
        aplicarFiltros();
    } catch (erro) {
        console.error("Erro ao carregar usuários:", erro);
        const tbody = $("tabelaUsuarios");
        if (tbody) {
            tbody.innerHTML = `
                <tr class="estado"><td colspan="5"><div class="vazio" style="text-align:center; padding:30px;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size:2rem; color:var(--primary); margin-bottom:10px;"></i>
                    <p>${esc(erro.message || "Erro ao carregar os usuários do servidor.")}</p>
                    <button type="button" class="btn-acao" data-acao="recarregar" style="margin-top:15px; padding:8px 16px; cursor:pointer;"><i class="fa-solid fa-rotate-right"></i> Tentar de novo</button>
                </div></td></tr>`;
        }
        if ($("contador")) $("contador").textContent = "";
    }
}

// ==========================================================
// RESUMO, FILTROS E TABELA
// ==========================================================
function atualizarResumo() {
    const conta = (tipo) => listaUsuariosGlobal.filter((u) => normalizarTipo(u.tipo) === tipo).length;
    if ($("statTotal")) $("statTotal").textContent = listaUsuariosGlobal.length;
    if ($("statAdmin")) $("statAdmin").textContent = conta("admin");
    if ($("statEmpresa")) $("statEmpresa").textContent = conta("empresa");
    if ($("statIndividual")) $("statIndividual").textContent = conta("individual");
}

function aplicarFiltros() {
    const termo = norm(termoBusca).trim().replace(/^#/, "");
    const digitos = termo.replace(/\D/g, "");

    const filtrados = listaUsuariosGlobal.filter((u) => {
        if (filtroTipo !== "todos" && normalizarTipo(u.tipo) !== filtroTipo) return false;
        if (!termo) return true;
        return (
            norm(nomeDe(u)).includes(termo) ||
            norm(u.email).includes(termo) ||
            norm(u.cpf).includes(termo) ||
            String(u.id) === termo ||
            (digitos.length >= 3 && String(u.cpf || "").replace(/\D/g, "").includes(digitos))
        );
    });

    renderizarTabela(filtrados);
    if ($("contador")) {
        $("contador").textContent = `Exibindo ${filtrados.length} de ${listaUsuariosGlobal.length} usuário${listaUsuariosGlobal.length === 1 ? "" : "s"}`;
    }
}

function renderizarTabela(usuarios) {
    const tbody = $("tabelaUsuarios");
    if (!tbody) return;

    if (!usuarios.length) {
        tbody.innerHTML = `<tr class="estado"><td colspan="5"><div class="vazio" style="text-align:center; padding:30px;">
            <i class="fa-regular fa-user" style="font-size:2rem; margin-bottom:10px; color:var(--text-muted);"></i><p>Nenhum usuário encontrado.</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = usuarios.map((u) => {
        const tipo = normalizarTipo(u.tipo);
        const rotulo = ROTULOS[tipo] || tipo.charAt(0).toUpperCase() + tipo.slice(1);
        const icone = ICONES[tipo] || "fa-user";
        const souEu = meuId !== null && String(u.id) === String(meuId);
        const bloqueio = souEu ? 'disabled title="Você não pode alterar a própria conta"' : "";
        const ehAdmin = tipo === "admin";

        return `<tr>
            <td data-label="ID" class="col-id">#${esc(u.id)}</td>
            <td data-label="Usuário">
                <div class="user">
                    <span class="avatar" style="--h:${matiz(u)}">${esc(iniciaisDe(u))}</span>
                    <div><strong>${esc(nomeDe(u))}</strong>${souEu ? '<em class="voce">você</em>' : ""}</div>
                </div>
            </td>
            <td data-label="E-mail" class="col-email">${esc(u.email)}</td>
            <td data-label="Tipo de acesso"><span class="badge badge--${esc(tipo)}"><i class="fa-solid ${icone}"></i>${esc(rotulo)}</span></td>
            <td class="col-acoes">
                <button type="button" class="btn-acao btn-mudar" data-acao="tipo" data-id="${esc(u.id)}" ${bloqueio || `title="${ehAdmin ? "Remover permissão de admin" : "Tornar administrador"}"`}>
                    <i class="fa-solid ${ehAdmin ? "fa-user-minus" : "fa-user-shield"}"></i>${ehAdmin ? "Remover admin" : "Tornar admin"}
                </button>
                <button type="button" class="btn-acao btn-excluir" data-acao="excluir" data-id="${esc(u.id)}" ${bloqueio || 'title="Excluir usuário"'}>
                    <i class="fa-solid fa-trash"></i>Excluir
                </button>
            </td>
        </tr>`;
    }).join("");
}

// ==========================================================
// AÇÕES COM SENHA
// ==========================================================
const acharUsuario = (id) => listaUsuariosGlobal.find((u) => String(u.id) === String(id));

async function alterarTipo(id, botao) {
    const usuario = acharUsuario(id);
    if (!usuario) return;

    const atual = normalizarTipo(usuario.tipo);
    const novoTipo = atual === "admin" ? "individual" : "admin";

    const resultado = await confirmar({
        titulo: novoTipo === "admin" ? "Tornar administrador?" : "Remover permissão de admin?",
        texto: `Insira a sua senha de Admin para confirmar a alteração de ${nomeDe(usuario)} para "${ROTULOS[novoTipo].toUpperCase()}".`,
        botao: "Sim, alterar"
    });

    if (!resultado.ok) return;

    botao.disabled = true;
    try {
        const r = await api(`/usuarios/${encodeURIComponent(id)}/tipo`, { 
            method: "PUT", 
            body: JSON.stringify({ tipo: novoTipo, senhaAdmin: resultado.senha }) 
        });
        toast(r.mensagem || "Tipo de acesso alterado com sucesso!");
        await carregarUsuarios({ silencioso: true });
    } catch (erro) {
        console.error("Erro na alteração:", erro);
        toast(erro.message || "Erro ao alterar permissão.", "erro");
        botao.disabled = false;
    }
}

async function excluirUsuario(id, botao) {
    const usuario = acharUsuario(id);
    if (!usuario) return;

    const resultado = await confirmar({
        titulo: "Excluir usuário?",
        texto: `Insira a sua senha de Admin para confirmar a exclusão definitiva de ${nomeDe(usuario)}.`,
        botao: "Sim, excluir",
        perigo: true
    });

    if (!resultado.ok) return;

    botao.disabled = true;
    try {
        const r = await api(`/usuarios/${encodeURIComponent(id)}`, { 
            method: "DELETE",
            body: JSON.stringify({ senhaAdmin: resultado.senha })
        });
        toast(r.mensagem || "Usuário excluído com sucesso!");
        await carregarUsuarios({ silencioso: true });
    } catch (erro) {
        console.error("Erro na exclusão:", erro);
        toast(erro.message || "Erro ao excluir usuário.", "erro");
        botao.disabled = false;
    }
}

// ==========================================================
// INIT
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
    const sessao = lerSessao();
    if (!sessao) { window.location.replace(LOGIN_URL); return; }

    meuId = sessao.id ?? sessao._id ?? null;
    const destino = configurarNavegacao(sessao);

    if (normalizarTipo(sessao.tipo) !== "admin") { window.location.replace(destino); return; }

    const inputBusca = $("inputBusca");
    if (inputBusca) {
        inputBusca.addEventListener("input", (e) => { termoBusca = e.target.value; aplicarFiltros(); });
    }

    const filtrosContainer = document.querySelector(".filtros");
    if (filtrosContainer) {
        filtrosContainer.addEventListener("click", (e) => {
            const chip = e.target.closest(".chip");
            if (!chip) return;
            filtroTipo = chip.dataset.filtro;
            document.querySelectorAll(".chip").forEach((c) => {
                const ativo = c === chip;
                c.classList.toggle("ativo", ativo);
                c.setAttribute("aria-pressed", String(ativo));
            });
            aplicarFiltros();
        });
    }

    const tabelaUsuarios = $("tabelaUsuarios");
    if (tabelaUsuarios) {
        tabelaUsuarios.addEventListener("click", (e) => {
            const botao = e.target.closest("button[data-acao]");
            if (!botao || botao.disabled) return;
            const { acao, id } = botao.dataset;
            if (acao === "tipo") alterarTipo(id, botao);
            else if (acao === "excluir") excluirUsuario(id, botao);
            else if (acao === "recarregar") carregarUsuarios();
        });
    }

    carregarUsuarios();
});