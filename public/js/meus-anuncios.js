/* ==========================================================
   MotorFlex — Meus Anúncios
   Funciona para qualquer conta (individual, empresa ou admin) e
   leva o botão "Voltar" para o painel correto de cada tipo de conta.
   Mostra o nome da empresa (contas "empresa") de acordo com o login.
   ========================================================== */

// AJUSTE AQUI os nomes dos seus painéis (chave = usuarios.tipo no banco)
const PAINEIS = {
    individual: "/pages/painel-cliente.html",
    empresa:    "/pages/painel-empresa.html",
    admin:      "/pages/painel-admin.html"
};
const PAINEL_PADRAO = "/pages/painel-cliente.html";
const LOGIN = "/pages/login.html";

// AJUSTE AQUI: campos do usuário (salvo no login) que guardam o nome da empresa, em ordem de prioridade
const CAMPOS_NOME_EMPRESA = ["nome_fantasia", "nomeFantasia", "razao_social", "razaoSocial", "nome_empresa", "nomeEmpresa", "empresa"];

let usuario = null;
let anuncios = [];

const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const brl = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

/* ---------- SESSÃO ---------- */
function lerUsuario() {
    try {
        const u = JSON.parse(localStorage.getItem("usuario"));
        if (!u || typeof u !== "object") return null;
        // aceita variações do objeto salvo no login (u.usuario, u.id / id_usuario / usuario_id)
        const base = u.usuario && typeof u.usuario === "object" ? u.usuario : u;
        const id = base.id ?? base.id_usuario ?? base.usuario_id ?? u.id;
        if (id == null) return null;
        // mescla o nível de cima (ex.: u.empresa) com o objeto do usuário, para achar o nome da empresa onde estiver
        return { ...(base === u ? {} : u), ...base, id, tipo: String(base.tipo || base.cargo || "individual").toLowerCase() };
    } catch (e) { return null; }
}

function authHeaders() {
    const t = localStorage.getItem("token");
    return t ? { Authorization: `Bearer ${t}` } : {};
}

// Nome que aparece na tela: empresa → nome da empresa; demais contas → nome da pessoa
function nomeExibicao(u) {
    if (u.tipo === "empresa") {
        for (const campo of CAMPOS_NOME_EMPRESA) {
            const v = u[campo];
            const s = typeof v === "string" ? v
                    : (v && typeof v === "object" ? (v.nome_fantasia || v.nome || v.razao_social || "") : "");
            if (String(s).trim()) return String(s).trim();
        }
    }
    return u.nome ? String(u.nome).trim() : "";
}

function configurarNavegacao() {
    const voltar = $("btnVoltar");
    if (voltar) voltar.href = PAINEIS[usuario.tipo] || PAINEL_PADRAO;

    const nome = nomeExibicao(usuario);
    if (!nome) return;

    const s = $("saudacao");
    if (s) s.textContent = `Olá, ${nome}! Gerencie seus veículos à venda e acompanhe o desempenho.`;

    const conta = $("conta");
    if (conta) {
        $("contaNome").textContent = nome;                       // textContent: seguro contra HTML no nome
        $("contaIcone").className = usuario.tipo === "empresa" ? "fa-solid fa-building" : "fa-solid fa-user";
        conta.title = nome;
        conta.hidden = false;
    }
    document.title = `Meus Anúncios | ${nome}`;
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", () => {
    usuario = lerUsuario();
    if (!usuario) { location.href = LOGIN; return; }

    configurarNavegacao();
    mostrarSkeleton();
    carregarMeusAnuncios(usuario.id);

    $("busca").addEventListener("input", renderizar);
    $("ordem").addEventListener("change", renderizar);
    $("btnFecharModal").addEventListener("click", fecharModalImagem);
    $("modalImagem").addEventListener("click", e => { if (e.target.id === "modalImagem") fecharModalImagem(); });

    // delegação de eventos (sem onclick inline)
    $("tabelaMeusAnuncios").addEventListener("click", e => {
        const foto = e.target.closest(".tabela-foto");
        if (foto) return abrirModalImagem(foto.dataset.full);
        const tg = e.target.closest(".btn-acoes-toggle");
        if (tg) { e.stopPropagation(); return toggleMenu(tg); }
        const ac = e.target.closest("[data-acao]");
        if (!ac) return;
        const id = ac.dataset.id;
        fecharTodosMenus();
        if (ac.dataset.acao === "editar") location.href = `/pages/editar-anuncio.html?id=${id}`;
        else if (ac.dataset.acao === "destacar") toast("Destaque de anúncios em breve!");
        else if (ac.dataset.acao === "excluir") excluirAnuncio(id);
    });

    document.addEventListener("click", e => { if (!e.target.closest(".acoes-container")) fecharTodosMenus(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") { fecharModalImagem(); fecharTodosMenus(); } });
});

/* ---------- DADOS ---------- */
function extrairLista(data) {
    if (Array.isArray(data)) return data;
    if (!data) return [];
    return data.veiculos || data.anuncios || data.dados || data.data || [];
}

async function carregarMeusAnuncios(usuarioId) {
    try {
        const resposta = await fetch(`/api/veiculos/usuario/${encodeURIComponent(usuarioId)}`, { headers: authHeaders() });
        if (resposta.status === 401 || resposta.status === 403) { location.href = LOGIN; return; }
        const data = await resposta.json();
        if (data && data.sucesso === false && !extrairLista(data).length && resposta.ok === false) throw new Error(data.mensagem);
        anuncios = extrairLista(data);
        renderizar();
    } catch (erro) {
        console.error("Erro ao buscar anúncios:", erro);
        $("tabelaMeusAnuncios").innerHTML = `<tr><td colspan="7" class="estado erro"><i class="fa-solid fa-triangle-exclamation"></i>Erro ao carregar seus anúncios. Tente novamente mais tarde.</td></tr>`;
    }
}

function mostrarSkeleton() {
    const linha = `<tr class="sk">${'<td><div></div></td>'.repeat(7)}</tr>`;
    $("tabelaMeusAnuncios").innerHTML = linha.repeat(3);
}

/* ---------- RENDER ---------- */
function urlImagem(img) {
    if (!img) return "";
    if (/^(https?:)?\/\//.test(img) || img.startsWith("/")) return img;
    return `/uploads/${img}`;
}

function atualizarResumo() {
    const views = anuncios.reduce((s, v) => s + Number(v.total_visualizacoes || 0), 0);
    const valor = anuncios.reduce((s, v) => s + Number(v.preco || 0), 0);
    $("kpiTotal").textContent = anuncios.length;
    $("kpiViews").textContent = views.toLocaleString("pt-BR");
    $("kpiValor").textContent = brl(valor);
}

function renderizar() {
    const tabela = $("tabelaMeusAnuncios");
    atualizarResumo();

    if (!anuncios.length) {
        tabela.innerHTML = `<tr><td colspan="7" class="estado"><i class="fa-solid fa-car-side"></i>Você ainda não possui veículos anunciados.<br><a href="/pages/catalogo.html?tab=cadastrar"><i class="fa-solid fa-plus"></i> Anunciar meu primeiro veículo</a></td></tr>`;
        return;
    }

    const q = $("busca").value.trim().toLowerCase();
    const lista = anuncios.filter(v => `${v.marca} ${v.modelo} ${v.versao || ""}`.toLowerCase().includes(q));
    const ord = $("ordem").value;
    lista.sort((a, b) =>
        ord === "views" ? (b.total_visualizacoes || 0) - (a.total_visualizacoes || 0) :
        ord === "menor" ? a.preco - b.preco :
        ord === "maior" ? b.preco - a.preco : b.id - a.id);

    if (!lista.length) {
        tabela.innerHTML = `<tr><td colspan="7" class="estado"><i class="fa-solid fa-magnifying-glass"></i>Nenhum veículo encontrado para essa busca.</td></tr>`;
        return;
    }

    tabela.innerHTML = lista.map(v => {
        const ano = v.ano_fabricacao && v.ano_modelo ? `${v.ano_fabricacao}/${v.ano_modelo}` : (v.ano_fabricacao || v.ano || "—");
        const full = urlImagem(v.imagem);
        const foto = full
            ? `<img src="${esc(full)}" data-full="${esc(full)}" alt="${esc(v.modelo)}" class="tabela-foto" loading="lazy">`
            : `<div class="sem-foto"><i class="fa-solid fa-car"></i></div>`;
        const st = String(v.status_anuncio || v.status || "Ativo");
        const stCls = /paus|inativ/i.test(st) ? "pausado" : /vend/i.test(st) ? "vendido" : "";
        return `
        <tr>
            <td class="c-foto">${foto}</td>
            <td class="c-veic veiculo"><strong>${esc(v.marca)} ${esc(v.modelo)}</strong><small>${esc(v.versao || "")}</small></td>
            <td class="c-ano">${esc(ano)}</td>
            <td class="c-preco preco">${brl(v.preco)}</td>
            <td class="c-views"><span class="views"><i class="fa-solid fa-eye"></i> ${Number(v.total_visualizacoes || 0)}</span></td>
            <td class="c-status"><span class="badge ${stCls}">${esc(st)}</span></td>
            <td class="acoes">
                <div class="acoes-container">
                    <button class="btn-acoes-toggle" aria-haspopup="true" aria-expanded="false" aria-label="Ações"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                    <div class="menu-dropdown">
                        <button data-acao="editar" data-id="${v.id}"><i class="fa-solid fa-pen"></i> Editar dados</button>
                        <button data-acao="destacar" data-id="${v.id}"><i class="fa-solid fa-bolt" style="color:#facc15"></i> Destacar anúncio</button>
                        <hr>
                        <button class="btn-excluir-opt" data-acao="excluir" data-id="${v.id}"><i class="fa-solid fa-trash"></i> Excluir</button>
                    </div>
                </div>
            </td>
        </tr>`;
    }).join("");
}

/* ---------- MENU / MODAL / TOAST ---------- */
function toggleMenu(btn) {
    const menu = btn.nextElementSibling;
    const abrir = !menu.classList.contains("ativo");
    fecharTodosMenus();
    if (!abrir) return;
    menu.classList.add("ativo");
    btn.setAttribute("aria-expanded", "true");
    // se não couber embaixo, abre para cima
    const r = menu.getBoundingClientRect();
    menu.classList.toggle("acima", r.bottom > innerHeight - 8 && btn.getBoundingClientRect().top > r.height);
}
function fecharTodosMenus() {
    document.querySelectorAll(".menu-dropdown.ativo").forEach(m => m.classList.remove("ativo", "acima"));
    document.querySelectorAll(".btn-acoes-toggle[aria-expanded=true]").forEach(b => b.setAttribute("aria-expanded", "false"));
}
function abrirModalImagem(url) {
    if (!url) return;
    $("imagemAmpliada").src = url;
    $("modalImagem").classList.add("ativo");
}
function fecharModalImagem() { $("modalImagem").classList.remove("ativo"); }

let toastT = 0;
function toast(msg, tipo = "") {
    const t = $("toast");
    t.textContent = msg; t.className = `toast on ${tipo}`;
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("on"), 3000);
}

/* ---------- AÇÕES ---------- */
async function excluirAnuncio(id) {
    if (!confirm("Tem certeza que deseja excluir este anúncio?")) return;
    try {
        const resposta = await fetch(`/api/veiculos/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeaders() });
        const data = await resposta.json().catch(() => ({}));
        if (resposta.ok && data.sucesso !== false) {
            anuncios = anuncios.filter(v => String(v.id) !== String(id));
            renderizar();
            toast("Anúncio excluído com sucesso!", "ok");
        } else toast(data.mensagem || "Erro ao excluir o anúncio.", "erro");
    } catch (erro) {
        console.error("Erro:", erro);
        toast("Erro de conexão com o servidor.", "erro");
    }
}