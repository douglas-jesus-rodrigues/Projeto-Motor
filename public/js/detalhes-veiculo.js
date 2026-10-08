// ==========================================
// ESTADO E UTILITÁRIOS
// ==========================================
const CHAVES_SESSAO = ["usuario", "usuario_logado"];
const IMAGEM_PADRAO = "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=800&q=80";

let veiculoAtual = null;
let veiculoIdAtual = null;

// ==========================================
// COMBUSTÍVEL E CÂMBIO: sempre o que está no banco (nunca um valor "chutado")
// ==========================================
const ICONES = {
    raio:  { classe: "fa-bolt" },
    folha: { classe: "fa-leaf" }
};

// Regra dos ícones: folha = combustível líquido · raio = elétrico · híbrido = os dois
const COMBUSTIVEIS = {
    gasolina: { rotulo: "Gasolina", grupo: "liquido",  tipo: "Combustível líquido",  icones: ["folha"],
        descricao: "O combustível fóssil mais comum para veículos leves, derivado do petróleo, que oferece uma boa resposta de desempenho e autonomia." },
    etanol:   { rotulo: "Etanol",   grupo: "liquido",  tipo: "Combustível líquido",  icones: ["folha"],
        descricao: "Um biocombustível renovável (produzido a partir da cana-de-açúcar), que emite menos poluentes, embora o veículo costume apresentar um consumo ligeiramente superior por quilômetro." },
    flex:     { rotulo: "Flex",     grupo: "liquido",  tipo: "Combustível líquido",  icones: ["folha"],
        descricao: "Veículos equipados com motores capazes de funcionar com gasolina, etanol ou qualquer proporção de mistura entre ambos no mesmo depósito." },
    diesel:   { rotulo: "Diesel",   grupo: "liquido",  tipo: "Combustível líquido",  icones: ["folha"],
        descricao: "Um combustível fóssil mais denso e pesado, utilizado em motores próprios que oferecem maior torque e eficiência em longas distâncias, sendo comum em veículos comerciais e de grande porte." },
    eletrico: { rotulo: "Elétrico", grupo: "eletrico", tipo: "Energia elétrica",     icones: ["raio"],
        descricao: "Veículos que funcionam exclusivamente com energia elétrica armazenada em baterias recarregáveis, sem emissões diretas de gases de escape." },
    hibrido:  { rotulo: "Híbrido",  grupo: "hibrido",  tipo: "Combustível + elétrico", icones: ["raio", "folha"],
        descricao: "Veículos que combinam um motor tradicional (combustível) com um motor elétrico, alternando ou unindo as duas fontes para maximizar a eficiência energética e reduzir o consumo." }
};

// Nomes por id (iguais aos do banco). As rotas /api/combustiveis e /api/cambios atualizam estas listas.
const nomesCombustivel = { 1: "Gasolina", 2: "Etanol", 3: "Flex", 4: "Diesel", 5: "Elétrico", 6: "Híbrido" };
const nomesCambio = { 1: "Manual", 2: "Automático", 3: "Semi-automático" };

async function carregarListaAuxiliar(url, destino) {
    try {
        const r = await fetch(url);
        if (!r.ok) return;
        const lista = await r.json();
        if (Array.isArray(lista)) {
            lista.forEach(i => { if (i && i.id != null && i.nome) destino[i.id] = String(i.nome); });
        }
    } catch {
        // usa os nomes padrão acima
    }
}

function carregarListasAuxiliares() {
    return Promise.all([
        carregarListaAuxiliar("/api/combustiveis", nomesCombustivel),
        carregarListaAuxiliar("/api/cambios", nomesCambio)
    ]);
}

// Só aceita texto de verdade (ignora vazio e números soltos, que seriam ids)
function nomeValido(valor) {
    if (typeof valor !== "string") return null;
    const t = valor.trim();
    return t && !/^\d+$/.test(t) ? t : null;
}

function normalizarTexto(str) {
    return String(str ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Descobre o tipo pelo nome que está no banco (ex.: "Elétrico", "Híbrido", "Gasolina/Etanol")
function infoCombustivel(nomeBanco) {
    const nome = normalizarTexto(nomeBanco);
    let chave = null;

    if (nome.includes("hibrid")) chave = "hibrido";            // híbrido primeiro (pode citar gasolina/elétrico)
    else if (nome.includes("eletric")) chave = "eletrico";
    else if (nome.includes("flex") || (nome.includes("gasolina") && (nome.includes("etanol") || nome.includes("alcool")))) chave = "flex";
    else if (nome.includes("gasolina")) chave = "gasolina";
    else if (nome.includes("etanol") || nome.includes("alcool")) chave = "etanol";
    else if (nome.includes("diesel")) chave = "diesel";

    return chave ? COMBUSTIVEIS[chave] : null;                 // GNV e outros: sem ícone/descrição
}

// Troca o conteúdo de um contêiner pelos ícones do tipo (ou pela bomba de combustível, se não houver tipo)
function aplicarIcones(id, icones) {
    const el = document.getElementById(id);
    if (!el) return;
    const lista = icones && icones.length ? icones : null;
    el.replaceChildren(...(lista || ["bomba"]).map(nome => {
        const i = document.createElement("i");
        i.setAttribute("aria-hidden", "true");
        i.className = nome === "bomba"
            ? "fa-solid fa-gas-pump"
            : `fa-solid ${ICONES[nome].classe} ic-${nome}`;
        return i;
    }));
}

function mostrarTipoCombustivel(nomeBanco) {
    const info = infoCombustivel(nomeBanco);
    const icones = info ? info.icones : null;

    aplicarIcones("chipCombIcones", icones);
    aplicarIcones("specCombIcones", icones);

    const caixa = document.getElementById("combustivelInfo");
    if (!caixa) return;
    if (!info) { caixa.hidden = true; return; }

    aplicarIcones("combustivelInfoIcones", icones);
    definirTexto("combustivelInfoNome", nomeBanco);          // o nome exatamente como está no banco
    definirTexto("combustivelInfoTipo", info.tipo);
    definirTexto("combustivelInfoTexto", info.descricao);
    caixa.className = `combustivel-info combustivel-info--${info.grupo}`;
    caixa.hidden = false;

    const chip = document.getElementById("chipCombustivel");
    if (chip) chip.title = `${info.rotulo}: ${info.tipo}`;
}

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

// Painel correto de acordo com o tipo de conta logada
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

    // Correção de cache/estado ao voltar (BFCACHE)
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
        const [resposta] = await Promise.all([
            fetch(`/api/veiculos/${encodeURIComponent(id)}`),
            carregarListasAuxiliares()
        ]);
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
        // Valores vindos do banco (pelo nome ou pelo id). Sem dado, mostra "Não informado": nada de valor inventado.
        const combustivel = nomeValido(v.combustivel_nome) || nomeValido(v.combustivel)
            || nomesCombustivel[v.tipo_combustivel_id] || "Não informado";
        const cambio = nomeValido(v.cambio_nome) || nomeValido(v.cambio) || nomeValido(v.transmissao_nome)
            || nomesCambio[v.tipo_transmissao_id] || "Não informado";

        definirTexto("specAno", ano);
        definirTexto("specQuilometragem", km);
        definirTexto("specCombustivel", combustivel);
        definirTexto("specCambio", cambio);
        definirTexto("specCor", v.cor || "Não informada");
        definirTexto("specPortas", v.portas ? `${v.portas} portas` : "Não informado");

        // Chips de resumo
        definirTexto("chipAno", v.ano_modelo || v.ano_fabricacao || "--");
        definirTexto("chipKm", km);
        definirTexto("chipComb", combustivel);
        mostrarTipoCombustivel(combustivel);

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
// GALERIA (foto principal + miniaturas opcionais)
// ==========================================
function montarGaleria(v) {
    const fotoEl = document.getElementById("fotoPrincipal");
    const miniaturasEl = document.getElementById("miniaturas");

    const principal = normalizarUrlImagem(v.imagem) || IMAGEM_PADRAO;

    // Se a API devolver várias fotos (v.fotos), monta as miniaturas
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
// CARD DE CONTATO: DONO x OUTRAS CONTAS
// ==========================================
function renderizarCardContato(v) {
    const card = document.getElementById("contatoCard");
    if (!card) return;

    const usuario = lerUsuario();
    const idDono = Number(v.usuario_id || v.proprietario_id || 0);
    const idAtual = usuario?.id ? Number(usuario.id) : null;
    const ehDono = !!(idAtual && idDono > 0 && idAtual === idDono);

    if (ehDono) {
        // Leva ao painel correto conforme o tipo de login (cliente / empresa / admin)
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
// REGISTRAR VISUALIZAÇÃO ÚNICA (EXCLUINDO DONO E ADMINS NO BACK-END)
// ==========================================
async function registrarVisualizacaoUnica(veiculoId) {
    try {
        const usuario = lerUsuario();
        if (!usuario?.id) return; // sem login, não conta

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
        e.stopPropagation(); // não abre o lightbox

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

// Sincronização com outras abas
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
// MODAIS (LOGIN, LIGHTBOX E PROPOSTA)
// ==========================================
function configurarModais() {
    // Lightbox
    document.getElementById("fotoWrapper")?.addEventListener("click", () => {
        abrirModalImagem(document.getElementById("fotoPrincipal").src);
    });
    document.getElementById("modalImagem")?.addEventListener("click", fecharModalImagem);
    document.querySelector(".modal-imagem-conteudo")?.addEventListener("click", (e) => e.stopPropagation());
    document.getElementById("btnFecharImagem")?.addEventListener("click", fecharModalImagem);

    // Login necessário
    document.getElementById("btnCancelarLogin")?.addEventListener("click", fecharModalLoginNecessario);
    document.getElementById("modalLoginNecessario")?.addEventListener("click", (e) => {
        if (e.target.id === "modalLoginNecessario") fecharModalLoginNecessario();
    });

    // Proposta
    document.getElementById("btnFecharProposta")?.addEventListener("click", fecharModalProposta);
    document.getElementById("btnCancelarProposta")?.addEventListener("click", fecharModalProposta);
    document.getElementById("btnEnviarProposta")?.addEventListener("click", enviarProposta);
    document.getElementById("modalProposta")?.addEventListener("click", (e) => {
        if (e.target.id === "modalProposta") fecharModalProposta();
    });

    // Frases rápidas: acrescentam ao texto sem duplicar
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

    // Ctrl/Cmd + Enter envia
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
// PROPOSTA: MENSAGEM AUTOMÁTICA PARA O DONO DO ANÚNCIO
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

// Chamado pelo botão "Enviar Proposta"
function abrirFluxoProposta() {
    if (!usuarioEstaLogado()) {
        abrirModalLoginNecessario();
        return;
    }

    const modal = document.getElementById("modalProposta");
    if (!modal) return;

    // Mini-resumo do veículo
    const foto = document.getElementById("propostaFoto");
    if (foto) {
        foto.src = document.getElementById("fotoPrincipal")?.src || IMAGEM_PADRAO;
    }
    definirTexto("propostaTitulo", document.getElementById("tituloVeiculo")?.textContent || "Veículo");
    definirTexto("propostaPreco", document.getElementById("precoVeiculo")?.textContent || "");

    // Mensagem já pronta
    document.getElementById("propostaTexto").value = montarMensagemAutomatica();

    modal.hidden = false;
    atualizarBloqueioScroll();

    // Foco no botão de enviar: basta apertar Enter/clicar
    document.getElementById("btnEnviarProposta")?.focus();
}

// Mantido por compatibilidade com o nome antigo
function enviarPropostaModal() {
    abrirFluxoProposta();
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