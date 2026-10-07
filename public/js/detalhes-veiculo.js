// ==========================================
// ESTADO E UTILITÁRIOS
// ==========================================
const CHAVES_SESSAO = ["usuario", "usuario_logado"];
const IMAGEM_PADRAO = "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=800&q=80";

// Mapeamento direto dos IDs da tabela tipo_combustivel da base de dados
const MAPA_COMBUSTIVEL = {
    1: "Gasolina",
    2: "Etanol",
    3: "Flex",
    4: "Diesel",
    5: "Elétrico",
    6: "Híbrido"
};

let veiculoAtual = null;
let veiculoIdAtual = null;

function lerUsuario() {
    for (const chave of CHAVES_SESSAO) {
        const bruto = localStorage.getItem(chave) || sessionStorage.getItem(chave);
        if (!bruto || bruto === "undefined" || bruto === "null") continue;
        try {
            const obj = JSON.parse(bruto);
            if (obj && typeof obj === "object") return obj;
        } catch {
            // ignora e tenta a próxima chave
        }
    }
    return null;
}

function usuarioEstaLogado() {
    const u = lerUsuario();
    return !!(u && u.id);
}

function obterRotaPainel(usuario) {
    if (!usuario) return "/pages/login.html";
    if (usuario.tipo === "empresa") return "/pages/painel-empresa.html";
    if (["admin", "super_admin"].includes(usuario.tipo) || usuario.cargo === "admin") {
        return "/pages/painel-admin.html";
    }
    return "/pages/painel-cliente.html";
}

function normalizarUrlImagem(valor) {
    if (typeof valor !== "string") return null;
    let src = valor.trim();
    if (!src || ["null", "undefined", "false", "0"].includes(src.toLowerCase())) return null;

    if (/^(data:image\/|blob:|https?:\/\/|\/\/)/i.test(src)) return src;

    src = src.replace(/\\/g, "/").replace(/^\.\//, "");
    if (src.startsWith("/")) return src;
    if (src.startsWith("uploads/")) return `/${src}`;
    return `/uploads/${encodeURIComponent(src)}`;
}

function formatarPreco(valor) {
    const n = Number(valor);
    if (!isFinite(n)) return "R$ --";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function definirTexto(id, texto) {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
}

let temporizadorToast = null;
function mostrarToast(mensagem) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = mensagem;
    toast.hidden = false;
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(() => { toast.hidden = true; }, 3500);
}

function atualizarBloqueioScroll() {
    const algumAberto =
        !document.getElementById("modalProposta")?.hidden ||
        !document.getElementById("modalLoginNecessario")?.hidden ||
        document.getElementById("modalImagem")?.classList.contains("ativo");
    document.body.classList.toggle("modal-aberto", !!algumAberto);
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {

    window.addEventListener("pageshow", (event) => {
        if (event.persisted) window.location.reload();
    });

    const urlParams = new URLSearchParams(window.location.search);
    veiculoIdAtual = urlParams.get("id");

    if (!veiculoIdAtual) {
        alert("Veículo não especificado!");
        window.location.href = "/pages/catalogo.html";
        return;
    }

    configurarModais();

    await carregarDetalhesDoCarro(veiculoIdAtual);
    configurarBotaoFavorito(veiculoIdAtual);
    registrarVisualizacaoUnica(veiculoIdAtual);
});

// ==========================================
// BUSCAR DADOS DO VEÍCULO NA API
// ==========================================
async function carregarDetalhesDoCarro(id) {
    const loadingEl = document.getElementById("loading");
    const conteudoEl = document.getElementById("conteudoVeiculo");

    try {
        const resposta = await fetch(`/api/veiculos/${encodeURIComponent(id)}`);
        const data = await resposta.json();

        if (!data.sucesso || !data.veiculo) {
            alert("Veículo não encontrado.");
            window.location.href = "/pages/catalogo.html";
            return;
        }

        const v = data.veiculo;
        veiculoAtual = v;

        const marca = v.marca_nome || v.marca || "Marca";
        const modelo = v.modelo_nome || v.modelo || "Modelo";
        const titulo = `${marca} ${modelo}`.trim();

        document.title = `${titulo} - MotorFlex`;
        definirTexto("breadcrumbAtual", titulo);
        definirTexto("marcaModeloBadge", `${marca} / ${modelo}`);
        definirTexto("tituloVeiculo", titulo);
        definirTexto("versaoVeiculo", v.versao || "Versão padrão");
        definirTexto("precoVeiculo", formatarPreco(v.preco));

        // Especificações
        const ano = `${v.ano_fabricacao || "--"} / ${v.ano_modelo || "--"}`;
        const km = v.quilometragem ? `${Number(v.quilometragem).toLocaleString("pt-BR")} km` : "0 km";

        // Obtém o nome do combustível através do JOIN da API ou através do ID mapeado
        const idCombustivel = Number(v.tipo_combustivel_id || v.combustivel_id || 0);
        const combustivel = v.combustivel_nome || 
                            v.combustivel || 
                            v.tipo_combustivel || 
                            MAPA_COMBUSTIVEL[idCombustivel] || 
                            "Não informado";

        // Obtém a motorização (utiliza o campo versao como fallback, onde o motor está guardado na BD)
        const motorizacao = v.motorizacao || 
                            v.motorizacao_nome || 
                            v.tipo_motorizacao || 
                            v.motor || 
                            v.versao || 
                            combustivel;

        const cambio = v.cambio_nome || v.cambio || v.transmissao_nome || "Manual";

        definirTexto("specAno", ano);
        definirTexto("specQuilometragem", km);
        definirTexto("specCombustivel", combustivel);
        definirTexto("specMotorizacao", motorizacao);
        definirTexto("specCambio", cambio);
        definirTexto("specCor", v.cor || "Não informada");
        definirTexto("specPortas", v.portas ? `${v.portas} portas` : "Não informado");

        // Chips de resumo
        definirTexto("chipAno", v.ano_modelo || v.ano_fabricacao || "--");
        definirTexto("chipKm", km);
        definirTexto("chipComb", combustivel);

        // Descrição
        if (v.descricao && String(v.descricao).trim() !== "") {
            definirTexto("descricaoVeiculo", v.descricao);
        }

        montarGaleria(v);
        renderizarCardContato(v);

        loadingEl.style.display = "none";
        conteudoEl.style.display = "block";

    } catch (erro) {
        console.error("Erro ao carregar detalhes:", erro);
        loadingEl.innerHTML = `<p style="color: #e50914;">Erro ao carregar os dados do veículo.</p>`;
    }
}

// ==========================================
// GALERIA
// ==========================================
function montarGaleria(v) {
    const fotoEl = document.getElementById("fotoPrincipal");
    const miniaturasEl = document.getElementById("miniaturas");

    const principal = normalizarUrlImagem(v.imagem) || IMAGEM_PADRAO;

    const listaBruta = Array.isArray(v.fotos) ? v.fotos : [];
    const fotos = listaBruta
        .map(f => typeof f === "string" ? f : (f?.url || f?.caminho || f?.caminho_arquivo || f?.imagem))
        .map(normalizarUrlImagem)
        .filter(Boolean);

    if (!fotos.includes(principal)) fotos.unshift(principal);

    fotoEl.onerror = () => {
        fotoEl.onerror = null;
        fotoEl.src = IMAGEM_PADRAO;
    };
    fotoEl.src = principal;
    fotoEl.alt = `Foto de ${v.marca_nome || v.marca || ""} ${v.modelo_nome || v.modelo || ""}`.trim();

    if (miniaturasEl && fotos.length > 1) {
        miniaturasEl.innerHTML = "";
        fotos.forEach((url, i) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = i === fotos.indexOf(principal) ? "ativa" : "";
            btn.setAttribute("aria-label", `Ver foto ${i + 1}`);

            const img = document.createElement("img");
            img.src = url;
            img.alt = "";
            img.onerror = () => { btn.remove(); };
            btn.appendChild(img);

            btn.addEventListener("click", () => {
                fotoEl.src = url;
                miniaturasEl.querySelectorAll("button").forEach(b => b.classList.remove("ativa"));
                btn.classList.add("ativa");
            });

            miniaturasEl.appendChild(btn);
        });
        miniaturasEl.hidden = false;
    }
}

// ==========================================
// CARD DE CONTATO
// ==========================================
function renderizarCardContato(v) {
    const card = document.getElementById("contatoCard");
    if (!card) return;

    const usuario = lerUsuario();
    const idDono = Number(v.usuario_id || v.proprietario_id || 0);
    const idAtual = usuario?.id ? Number(usuario.id) : null;
    const ehDono = !!(idAtual && idDono > 0 && idAtual === idDono);

    if (ehDono) {
        const destino = `${obterRotaPainel(usuario)}?editar=${encodeURIComponent(v.id || veiculoIdAtual)}`;

        card.innerHTML = `
            <span class="selo-dono"><i class="fa-solid fa-circle-check"></i> Este anúncio é seu</span>
            <h3><i class="fa-solid fa-sliders"></i> Gestão do Anúncio</h3>
            <p>Você é o proprietário deste veículo na plataforma. Clique abaixo para editar as informações, fotos e preço no seu painel.</p>
            <a href="${destino}" class="btn-proposta secundario">
                <i class="fa-solid fa-pen-to-square"></i> Editar meu anúncio
            </a>
        `;
        return;
    }

    card.innerHTML = `
        <h3><i class="fa-solid fa-headset"></i> Interessado neste carro?</h3>
        <p>Envie uma proposta direto ao anunciante. Deixamos a mensagem pronta, é só clicar em enviar.</p>
        <button type="button" class="btn-proposta" id="btnAbrirProposta">
            <i class="fa-solid fa-paper-plane"></i> Enviar Proposta
        </button>
    `;
    document.getElementById("btnAbrirProposta").addEventListener("click", abrirFluxoProposta);
}

// ==========================================
// REGISTRAR VISUALIZAÇÃO ÚNICA
// ==========================================
async function registrarVisualizacaoUnica(veiculoId) {
    try {
        const usuario = lerUsuario();
        if (!usuario?.id) return;

        await fetch(`/api/veiculos/${encodeURIComponent(veiculoId)}/visualizar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario_id: usuario.id })
        });
    } catch (erro) {
        console.error("Erro ao registrar visualização:", erro);
    }
}

// ==========================================
// FAVORITO
// ==========================================
function lerFavoritos() {
    try {
        const lista = JSON.parse(localStorage.getItem("favoritos_veiculos"));
        return Array.isArray(lista) ? lista : [];
    } catch {
        return [];
    }
}

function configurarBotaoFavorito(veiculoId) {
    const btnFav = document.getElementById("btnFavoritarDetalhe");
    const iconeFav = document.getElementById("iconeFavorito");
    if (!btnFav || !iconeFav) return;

    const idNumerico = Number(veiculoId);

    atualizarVisualBotaoFavorito(
        usuarioEstaLogado() && lerFavoritos().includes(idNumerico),
        btnFav, iconeFav
    );

    btnFav.addEventListener("click", (e) => {
        e.stopPropagation();

        if (!usuarioEstaLogado()) {
            abrirModalLoginNecessario();
            return;
        }

        let favoritos = lerFavoritos();
        let ehFavorito;

        if (favoritos.includes(idNumerico)) {
            favoritos = favoritos.filter(id => id !== idNumerico);
            ehFavorito = false;
        } else {
            favoritos.push(idNumerico);
            ehFavorito = true;
        }

        localStorage.setItem("favoritos_veiculos", JSON.stringify(favoritos));
        atualizarVisualBotaoFavorito(ehFavorito, btnFav, iconeFav);
        mostrarToast(ehFavorito ? "Adicionado aos favoritos" : "Removido dos favoritos");
    });
}

function atualizarVisualBotaoFavorito(ehFavorito, btn, icone) {
    if (ehFavorito) {
        icone.className = "fa-solid fa-heart";
        icone.style.color = "#ff2b36";
        btn.setAttribute("aria-pressed", "true");
        btn.title = "Remover dos favoritos";
    } else {
        icone.className = "fa-regular fa-heart";
        icone.style.color = "#ffffff";
        btn.setAttribute("aria-pressed", "false");
        btn.title = "Favoritar veículo";
    }
}

window.addEventListener("storage", (event) => {
    if (event.key === "favoritos_veiculos") {
        const btnFav = document.getElementById("btnFavoritarDetalhe");
        const iconeFav = document.getElementById("iconeFavorito");
        const id = Number(veiculoIdAtual);
        if (btnFav && iconeFav && id) {
            atualizarVisualBotaoFavorito(usuarioEstaLogado() && lerFavoritos().includes(id), btnFav, iconeFav);
        }
    }
});

// ==========================================
// MODAIS
// ==========================================
function configurarModais() {
    document.getElementById("fotoWrapper")?.addEventListener("click", () => {
        abrirModalImagem(document.getElementById("fotoPrincipal").src);
    });
    document.getElementById("modalImagem")?.addEventListener("click", fecharModalImagem);
    document.querySelector(".modal-imagem-conteudo")?.addEventListener("click", (e) => e.stopPropagation());
    document.getElementById("btnFecharImagem")?.addEventListener("click", fecharModalImagem);

    document.getElementById("btnCancelarLogin")?.addEventListener("click", fecharModalLoginNecessario);
    document.getElementById("modalLoginNecessario")?.addEventListener("click", (e) => {
        if (e.target.id === "modalLoginNecessario") fecharModalLoginNecessario();
    });

    document.getElementById("btnFecharProposta")?.addEventListener("click", fecharModalProposta);
    document.getElementById("btnCancelarProposta")?.addEventListener("click", fecharModalProposta);
    document.getElementById("btnEnviarProposta")?.addEventListener("click", enviarProposta);
    document.getElementById("modalProposta")?.addEventListener("click", (e) => {
        if (e.target.id === "modalProposta") fecharModalProposta();
    });

    document.getElementById("propostaChips")?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-frase]");
        if (!btn) return;
        const area = document.getElementById("propostaTexto");
        const frase = btn.dataset.frase;
        if (!area.value.includes(frase)) {
            area.value = `${area.value.trim()} ${frase}`.trim();
        }
        area.focus();
    });

    document.getElementById("propostaTexto")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            enviarProposta();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            fecharModalImagem();
            fecharModalLoginNecessario();
            fecharModalProposta();
        }
    });
}

function abrirModalLoginNecessario() {
    const modal = document.getElementById("modalLoginNecessario");
    if (modal) modal.hidden = false;
    atualizarBloqueioScroll();
}

function fecharModalLoginNecessario() {
    const modal = document.getElementById("modalLoginNecessario");
    if (modal) modal.hidden = true;
    atualizarBloqueioScroll();
}

function abrirModalImagem(url) {
    const modal = document.getElementById("modalImagem");
    const img = document.getElementById("imagemAmpliada");
    if (modal && img) {
        img.src = url;
        modal.classList.add("ativo");
        atualizarBloqueioScroll();
    }
}

function fecharModalImagem() {
    const modal = document.getElementById("modalImagem");
    if (modal) modal.classList.remove("ativo");
    atualizarBloqueioScroll();
}

function fecharModalProposta() {
    const modal = document.getElementById("modalProposta");
    if (modal) modal.hidden = true;
    atualizarBloqueioScroll();
}

// ==========================================
// PROPOSTA: MENSAGEM AUTOMÁTICA
// ==========================================
function montarMensagemAutomatica() {
    const titulo = document.getElementById("tituloVeiculo")?.textContent || "este veículo";
    const versao = veiculoAtual?.versao ? ` ${veiculoAtual.versao}` : "";
    const preco = document.getElementById("precoVeiculo")?.textContent || "";
    const usuario = lerUsuario();
    const nome = usuario?.tipo === "empresa"
        ? (usuario.empresa?.nome_empresa || usuario.nome_empresa || usuario.nome)
        : usuario?.nome;

    const assinatura = nome ? ` Meu nome é ${String(nome).split(" ")[0]}.` : "";

    return `Olá! Tenho interesse no ${titulo}${versao} anunciado por ${preco}. Ele ainda está disponível? Gostaria de negociar.${assinatura}`;
}

function abrirFluxoProposta() {
    if (!usuarioEstaLogado()) {
        abrirModalLoginNecessario();
        return;
    }

    const modal = document.getElementById("modalProposta");
    if (!modal) return;

    const foto = document.getElementById("propostaFoto");
    if (foto) {
        foto.src = document.getElementById("fotoPrincipal")?.src || IMAGEM_PADRAO;
    }
    definirTexto("propostaTitulo", document.getElementById("tituloVeiculo")?.textContent || "Veículo");
    definirTexto("propostaPreco", document.getElementById("precoVeiculo")?.textContent || "");

    document.getElementById("propostaTexto").value = montarMensagemAutomatica();

    modal.hidden = false;
    atualizarBloqueioScroll();
    document.getElementById("btnEnviarProposta")?.focus();
}

let enviandoProposta = false;

async function enviarProposta() {
    if (enviandoProposta) return;

    const usuario = lerUsuario();
    if (!usuario?.id) {
        fecharModalProposta();
        abrirModalLoginNecessario();
        return;
    }

    const texto = document.getElementById("propostaTexto").value.trim();
    if (!texto) {
        mostrarToast("Escreva uma mensagem antes de enviar.");
        return;
    }

    const botao = document.getElementById("btnEnviarProposta");
    const textoOriginal = botao.innerHTML;
    enviandoProposta = true;
    botao.disabled = true;
    botao.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i>&nbsp; Enviando...`;

    const veiculoId = veiculoIdAtual;
    const irParaMensagensComRascunho = () => {
        window.location.href = `/pages/mensagens.html?veiculo=${encodeURIComponent(veiculoId)}&msg=${encodeURIComponent(texto)}`;
    };

    try {
        const resposta = await fetch("/api/mensagens/iniciar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                remetente_id: usuario.id,
                veiculo_id: veiculoId,
                texto_inicial: texto
            })
        });

        if (resposta.ok) {
            const dados = await resposta.json();
            const conversaId = dados.conversa_id || dados.id;
            mostrarToast("Proposta enviada!");
            window.location.href = conversaId
                ? `/pages/mensagens.html?conversa=${encodeURIComponent(conversaId)}`
                : "/pages/mensagens.html";
        } else {
            irParaMensagensComRascunho();
        }
    } catch (erro) {
        console.error("Erro ao iniciar chat:", erro);
        irParaMensagensComRascunho();
    } finally {
        enviandoProposta = false;
        botao.disabled = false;
        botao.innerHTML = textoOriginal;
    }
}