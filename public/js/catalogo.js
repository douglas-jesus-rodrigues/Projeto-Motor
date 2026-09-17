document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 0. UTILITÁRIOS DE SEGURANÇA
    // ==========================================

    // Escapa qualquer texto antes de inseri-lo via innerHTML, prevenindo XSS
    // caso dados vindos da API contenham marcação maliciosa.
    function escapeHTML(valor) {
        return String(valor ?? "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[c]));
    }

    // Só aceita imagens de origem relativa ao próprio site ou https,
    // bloqueando esquemas como "javascript:" ou "data:" vindos da API.
    function sanitizarSrcImagem(src) {
        if (typeof src !== "string") return "/imagens/sem-foto.jpg";
        if (src.startsWith("/") || src.startsWith("https://")) return src;
        return "/imagens/sem-foto.jpg";
    }

    function lerLocalStorageSeguro(chave) {
        try {
            return JSON.parse(localStorage.getItem(chave));
        } catch {
            return null;
        }
    }

    // Nota de segurança: o objeto "usuario" no localStorage é usado aqui
    // apenas para conveniência de navegação (mostrar/ocultar abas). Ele NÃO
    // deve ser tratado como prova de autenticação — qualquer chamada de API
    // que dependa disso precisa validar a sessão/token no servidor, pois
    // dados em localStorage podem ser alterados livremente pelo usuário.
    const usuario = lerLocalStorageSeguro("usuario") || { id: 1, tipo: "cliente" };

    const btnPainel = document.getElementById("btnPainel");
    if (btnPainel && usuario) {
        if (usuario.tipo === "empresa") {
            btnPainel.href = "/pages/painel-empresa.html";
        } else if (usuario.tipo === "admin") {
            btnPainel.href = "/pages/admin.html";
        } else {
            btnPainel.href = "/pages/painel-cliente.html";
        }
    }

    // ==========================================
    // TOASTS (substitui alert())
    // ==========================================
    const toastContainer = document.getElementById("toastContainer");

    function mostrarToast(mensagem, tipo = "info") {
        if (!toastContainer) { return; }
        const toast = document.createElement("div");
        toast.className = `toast ${tipo}`;
        toast.textContent = mensagem; // textContent: nunca interpreta HTML
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 4500);
    }

    function mostrarAvisoRedirecionarLogin(mensagem) {
        const modalAntigo = document.getElementById("modalAvisoLogin");
        if (modalAntigo) modalAntigo.remove();

        const overlay = document.createElement("div");
        overlay.id = "modalAvisoLogin";
        overlay.setAttribute("role", "alertdialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.style.cssText = `
            position: fixed; inset: 0;
            background: rgba(4,5,6,0.85); display: flex; align-items: center;
            justify-content: center; z-index: 99999; backdrop-filter: blur(4px);
        `;

        const caixa = document.createElement("div");
        caixa.style.cssText = `
            background: #14181f; border: 1px solid #c97a3c; padding: 34px;
            border-radius: 10px; max-width: 420px; width: 90%; text-align: center;
            box-shadow: 0 20px 50px rgba(0,0,0,0.7);
        `;

        const marca = document.createElement("div");
        marca.style.cssText = "font-family:'Oswald',sans-serif; font-size:26px; color:#e08f4d; margin-bottom:15px; font-weight:600; letter-spacing:2px;";
        marca.textContent = "MOTORFLEX";

        const titulo = document.createElement("h3");
        titulo.style.cssText = "color:#fff; font-size:18px; margin-bottom:12px; font-weight:600;";
        titulo.textContent = "Autenticação necessária";

        const paragrafo = document.createElement("p");
        paragrafo.style.cssText = "color:#8b93a1; font-size:13.5px; line-height:1.6; margin-bottom:22px;";
        paragrafo.textContent = mensagem; // texto sempre tratado como dado, não HTML

        const rodape = document.createElement("div");
        rodape.style.cssText = "color:#5b6270; font-size:11px; letter-spacing:1px;";
        rodape.textContent = "Redirecionando para o login...";

        caixa.append(marca, titulo, paragrafo, rodape);
        overlay.appendChild(caixa);
        document.body.appendChild(overlay);

        setTimeout(() => {
            window.location.href = "/pages/login.html";
        }, 2200);
    }

    // ==========================================
    // 1. NAVEGAÇÃO ENTRE ABAS (com suporte a ?tab=...)
    // ==========================================
    const navLinks = document.querySelectorAll(".nav-link");
    const pageTabs = document.querySelectorAll(".page-tab");
    const liveRegion = document.getElementById("liveRegion");

    function ativarAbaPorId(tabId) {
        const alvo = document.getElementById(tabId);
        if (!alvo) return;

        navLinks.forEach((l) => {
            const ehAtiva = l.getAttribute("data-tab") === tabId;
            l.classList.toggle("active", ehAtiva);
            if (ehAtiva) l.setAttribute("aria-current", "page");
            else l.removeAttribute("aria-current");
        });

        pageTabs.forEach((pt) => pt.classList.toggle("active", pt.id === tabId));

        if (liveRegion) liveRegion.textContent = `Seção ${alvo.querySelector("h2")?.textContent || tabId} exibida.`;
    }

    function exigeLogin(tabId) {
        return tabId === "tab-cadastrar" || tabId === "cadastrar";
    }

    navLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetTab = link.getAttribute("data-tab");

            if (exigeLogin(targetTab)) {
                const usuarioLogado = lerLocalStorageSeguro("usuario");
                if (!usuarioLogado || !usuarioLogado.id) {
                    mostrarAvisoRedirecionarLogin("Para publicar anúncios de veículos na plataforma, é necessário possuir uma conta ativa e estar autenticado.");
                    return;
                }
            }

            ativarAbaPorId(targetTab);
        });
    });

    const urlParams = new URLSearchParams(window.location.search);
    const abaDaUrl = urlParams.get("tab");
    if (abaDaUrl && /^[a-z-]+$/i.test(abaDaUrl)) {
        if (exigeLogin(abaDaUrl)) {
            const usuarioLogado = lerLocalStorageSeguro("usuario");
            if (!usuarioLogado || !usuarioLogado.id) {
                mostrarAvisoRedirecionarLogin("Para publicar anúncios de veículos na plataforma, é necessário possuir uma conta ativa e estar autenticado.");
            }
        } else {
            ativarAbaPorId(`tab-${abaDaUrl}`);
        }
    }

    function irParaCatalogo() {
        ativarAbaPorId("tab-catalogo");
    }

    // ==========================================
    // 2. CATÁLOGO — CARREGAMENTO DA API
    // ==========================================
    let bancoDeDadosVeiculos = [];

    const featuredCarContainer = document.getElementById("featuredCar");
    const carsGrid = document.getElementById("carsGrid");
    const topDealsContainer = document.getElementById("topDeals");
    const resultCount = document.getElementById("resultCount");

    const inputBusca = document.getElementById("filtroBusca");
    const inputPrecoMax = document.getElementById("filtroPrecoMax");
    const inputAnoMin = document.getElementById("filtroAnoMin");
    const selectCombustivel = document.getElementById("filtroCombustivel");
    const selectCambio = document.getElementById("filtroCambio");
    const selectCarroceria = document.getElementById("filtroCarroceria");
    const formFiltro = document.getElementById("formFiltro");
    const btnLimpar = document.getElementById("btnLimparFiltros");

    const formatarMoeda = (valor) =>
        (Number(valor) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    async function carregarVeiculosDoBanco() {
        try {
            const resposta = await fetch("/api/veiculos");
            if (!resposta.ok) throw new Error(`Falha HTTP ${resposta.status}`);
            const dados = await resposta.json();

            if (dados.sucesso && Array.isArray(dados.veiculos)) {
                bancoDeDadosVeiculos = dados.veiculos.map((v) => ({
                    id: Number(v.id) || 0,
                    marca: String(v.marca_nome || v.marca || "Outra"),
                    modelo_nome: String(v.modelo_nome || v.modelo || ""),
                    marca_nome: String(v.marca_nome || v.marca || ""),
                    versao: String(v.versao || ""),
                    categoria: String(v.carroceria || "Outro"),
                    transmissao: (v.tipo_transmissao_id === 2 || v.cambio === "Automático") ? "Automático" : (v.cambio || "Manual"),
                    combustivel: String(v.combustivel || "Gasolina"),
                    ano: Number(v.ano_modelo) || 2020,
                    ano_fabricacao: Number(v.ano_fabricacao) || 2020,
                    condicao: "Seminovo",
                    quilometragem: Number(v.quilometragem) || 0,
                    preco: Number(v.preco) || 0,
                    destaquePrincipal: Boolean(v.destaque_principal),
                    imagem: sanitizarSrcImagem(v.imagem ? `/uploads/${v.imagem}` : "/imagens/sem-foto.jpg"),
                }));
            }
        } catch (erro) {
            console.error("Erro ao carregar veículos do backend:", erro);
            mostrarToast("Não foi possível carregar o catálogo agora. Tente novamente em instantes.", "erro");
        }

        renderizarDestaque();
        renderizarCardsCatalogo(bancoDeDadosVeiculos);
        renderizarTopDeals();
    }

    function renderizarDestaque() {
        if (!featuredCarContainer) return;
        if (bancoDeDadosVeiculos.length === 0) {
            featuredCarContainer.innerHTML = "";
            return;
        }

        const principal = bancoDeDadosVeiculos.find((v) => v.destaquePrincipal) || bancoDeDadosVeiculos[0];
        const nomeCompleto = `${principal.marca_nome} ${principal.modelo_nome}`.trim();

        featuredCarContainer.innerHTML = `
            <img src="${sanitizarSrcImagem(principal.imagem)}" alt="${escapeHTML(nomeCompleto)}">
            <div class="featured-info">
                <span>${escapeHTML(String(principal.ano))} · ${escapeHTML(nomeCompleto)}</span>
                <span class="price">${formatarMoeda(principal.preco)}</span>
            </div>
        `;
    }

    function renderizarCardsCatalogo(lista) {
        if (!carsGrid) return;
        carsGrid.innerHTML = "";

        if (resultCount) {
            resultCount.textContent = `${lista.length} veículo${lista.length === 1 ? "" : "s"} encontrado${lista.length === 1 ? "" : "s"}`;
        }

        if (lista.length === 0) {
            const vazio = document.createElement("p");
            vazio.className = "empty-state";
            vazio.textContent = "Nenhum veículo encontrado com os filtros selecionados.";
            carsGrid.appendChild(vazio);
            return;
        }

        const favoritosIds = lerLocalStorageSeguro("favoritos_veiculos") || [];

        lista.forEach((veiculo) => {
            const isFavorito = Array.isArray(favoritosIds) && favoritosIds.includes(veiculo.id);
            const nomeCompleto = `${veiculo.marca_nome} ${veiculo.modelo_nome}`.trim();

            const card = document.createElement("div");
            card.className = "card-item-catalogo";

            // Todo dado dinâmico passa por escapeHTML antes de ir para innerHTML.
            card.innerHTML = `
                <div class="card-img-wrapper">
                    <img src="${sanitizarSrcImagem(veiculo.imagem)}" alt="${escapeHTML(nomeCompleto)}" loading="lazy">
                    <button type="button" class="btn-favoritar" data-id="${veiculo.id}" title="Favoritar veículo" aria-pressed="${isFavorito}">
                        <span aria-hidden="true">${isFavorito ? "❤️" : "🤍"}</span>
                    </button>
                </div>
                <div class="card-corpo">
                    <h3>${escapeHTML(nomeCompleto)}</h3>
                    <p class="card-versao">${escapeHTML(veiculo.versao)}</p>
                    <p class="card-detalhes">Ano ${escapeHTML(String(veiculo.ano_fabricacao))}/${escapeHTML(String(veiculo.ano))} · ${escapeHTML(veiculo.quilometragem.toLocaleString("pt-BR"))} km</p>
                    <div class="card-footer">
                        <div>
                            <span class="rotulo-preco">Valor total</span>
                            <span class="card-preco">${formatarMoeda(veiculo.preco)}</span>
                        </div>
                        <a href="/pages/detalhes.html?id=${encodeURIComponent(veiculo.id)}" class="btn-detalhes">Ver detalhes</a>
                    </div>
                </div>
            `;

            const btnFav = card.querySelector(".btn-favoritar");
            btnFav.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                const usuarioLogado = lerLocalStorageSeguro("usuario");
                if (!usuarioLogado || !usuarioLogado.id) {
                    mostrarAvisoRedirecionarLogin("Para favoritar veículos e gerenciar suas preferências, é necessário acessar sua conta no sistema.");
                    return;
                }

                let favsAtuais = lerLocalStorageSeguro("favoritos_veiculos") || [];
                if (!Array.isArray(favsAtuais)) favsAtuais = [];

                const jaFavoritado = favsAtuais.includes(veiculo.id);
                favsAtuais = jaFavoritado
                    ? favsAtuais.filter((id) => id !== veiculo.id)
                    : [...favsAtuais, veiculo.id];

                btnFav.querySelector("span").textContent = jaFavoritado ? "🤍" : "❤️";
                btnFav.setAttribute("aria-pressed", String(!jaFavoritado));
                localStorage.setItem("favoritos_veiculos", JSON.stringify(favsAtuais));
            });

            carsGrid.appendChild(card);
        });
    }

    function renderizarTopDeals() {
        if (!topDealsContainer) return;
        topDealsContainer.innerHTML = "";

        bancoDeDadosVeiculos.slice(0, 4).forEach((carro) => {
            const nomeCompleto = `${carro.marca_nome} ${carro.modelo_nome}`.trim();
            const item = document.createElement("div");
            item.className = "deal-item";
            item.innerHTML = `
                <img src="${sanitizarSrcImagem(carro.imagem)}" alt="${escapeHTML(nomeCompleto)}" loading="lazy">
                <div class="deal-info">
                    <div class="deal-title">${escapeHTML(nomeCompleto)}</div>
                    <div style="color:var(--text-faint); font-size:0.72rem;">${escapeHTML(String(carro.ano))} · ${escapeHTML(carro.condicao)}</div>
                    <div class="deal-price">${formatarMoeda(carro.preco)}</div>
                </div>
            `;
            topDealsContainer.appendChild(item);
        });
    }

    function executarBusca() {
        const termo = inputBusca ? inputBusca.value.trim().toLowerCase().slice(0, 60) : "";
        const precoMax = inputPrecoMax && inputPrecoMax.value !== "" ? Number(inputPrecoMax.value) : null;
        const anoMin = inputAnoMin && inputAnoMin.value !== "" ? Number(inputAnoMin.value) : null;
        const combustivel = selectCombustivel ? selectCombustivel.value : "";
        const cambio = selectCambio ? selectCambio.value : "";
        const carroceria = selectCarroceria ? selectCarroceria.value : "";

        const filtrados = bancoDeDadosVeiculos.filter((v) => {
            const nomeCompleto = `${v.marca_nome} ${v.modelo_nome} ${v.versao}`.toLowerCase();
            const bateTexto = termo === "" || nomeCompleto.includes(termo);
            const batePreco = precoMax === null || Number.isNaN(precoMax) || v.preco <= precoMax;
            const bateAno = anoMin === null || Number.isNaN(anoMin) || v.ano >= anoMin;
            const bateCombustivel = combustivel === "" || v.combustivel === combustivel;
            const bateCambio = cambio === "" || v.transmissao === cambio;
            const bateCarroceria = carroceria === "" || v.categoria === carroceria;

            return bateTexto && batePreco && bateAno && bateCombustivel && bateCambio && bateCarroceria;
        });

        renderizarCardsCatalogo(filtrados);
    }

    if (formFiltro) {
        formFiltro.addEventListener("submit", (e) => {
            e.preventDefault();
            executarBusca();
        });
    }

    if (btnLimpar) {
        btnLimpar.addEventListener("click", () => {
            setTimeout(executarBusca, 0); // aguarda o reset nativo do form
        });
    }

    if (inputBusca) {
        let debounce;
        inputBusca.addEventListener("input", () => {
            clearTimeout(debounce);
            debounce = setTimeout(executarBusca, 250);
        });
    }

    // ==========================================
    // 3. UPLOAD, MINIATURA E MODAL DE PRÉ-VISUALIZAÇÃO
    // ==========================================
    const inputImagem = document.getElementById("imagem");
    const btnVerFoto = document.getElementById("btnVerFoto");
    const nomeArquivo = document.getElementById("nomeArquivoSelecionado");
    const modal = document.getElementById("modalVisualizarFoto");
    const imgPreviewModal = document.getElementById("imgPreviewModal");
    const miniaturaPreview = document.getElementById("miniaturaPreview");
    const erroImagem = document.getElementById("erroImagem");

    const TIPOS_IMAGEM_ACEITOS = ["image/png", "image/jpeg", "image/webp"];
    const TAMANHO_MAXIMO_MB = 5;

    function limparSelecaoImagem() {
        if (nomeArquivo) nomeArquivo.textContent = "Selecionar foto";
        if (btnVerFoto) btnVerFoto.disabled = true;
        if (imgPreviewModal) imgPreviewModal.src = "";
        if (miniaturaPreview) {
            miniaturaPreview.src = "";
            miniaturaPreview.style.display = "none";
        }
    }

    if (inputImagem) {
        inputImagem.addEventListener("change", function (event) {
            const arquivo = event.target.files[0];
            if (erroImagem) erroImagem.textContent = "";

            if (!arquivo) {
                limparSelecaoImagem();
                return;
            }

            if (!TIPOS_IMAGEM_ACEITOS.includes(arquivo.type)) {
                if (erroImagem) erroImagem.textContent = "Envie uma imagem em PNG, JPEG ou WEBP.";
                inputImagem.value = "";
                limparSelecaoImagem();
                return;
            }

            if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
                if (erroImagem) erroImagem.textContent = `A imagem deve ter até ${TAMANHO_MAXIMO_MB}MB.`;
                inputImagem.value = "";
                limparSelecaoImagem();
                return;
            }

            if (nomeArquivo) nomeArquivo.textContent = arquivo.name.slice(0, 40);
            if (btnVerFoto) btnVerFoto.disabled = false;

            const reader = new FileReader();
            reader.onload = (e) => {
                const urlResultado = e.target.result;
                if (imgPreviewModal) imgPreviewModal.src = urlResultado;
                if (miniaturaPreview) {
                    miniaturaPreview.src = urlResultado;
                    miniaturaPreview.style.display = "block";
                }
            };
            reader.readAsDataURL(arquivo);
        });
    }

    function abrirModalFoto() {
        if (modal && imgPreviewModal && imgPreviewModal.src) {
            modal.classList.add("ativo");
            document.getElementById("btnFecharModal")?.focus();
        }
    }

    function fecharModalFoto() {
        if (modal) modal.classList.remove("ativo");
    }

    if (btnVerFoto) btnVerFoto.addEventListener("click", abrirModalFoto);
    document.getElementById("btnFecharModal")?.addEventListener("click", fecharModalFoto);
    modal?.addEventListener("click", (e) => { if (e.target === modal) fecharModalFoto(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharModalFoto(); });

    // ==========================================
    // 4. VALIDAÇÃO E ENVIO DO ANÚNCIO
    // ==========================================
    const formAnuncio = document.getElementById("formAnuncio");
    const btnAnunciar = document.getElementById("btnAnunciar");

    function definirErro(campoEl, erroEl, mensagem) {
        if (erroEl) erroEl.textContent = mensagem;
        if (campoEl) campoEl.setAttribute("aria-invalid", mensagem ? "true" : "false");
    }

    if (formAnuncio) {
        formAnuncio.addEventListener("submit", async (e) => {
            e.preventDefault();

            const usuarioLogado = lerLocalStorageSeguro("usuario");
            if (!usuarioLogado || !usuarioLogado.id) {
                mostrarAvisoRedirecionarLogin("Para publicar anúncios de veículos na plataforma, é necessário possuir uma conta ativa e estar autenticado.");
                return;
            }

            const marcaEl = document.getElementById("marca");
            const modeloEl = document.getElementById("modelo");
            const versaoEl = document.getElementById("versao");
            const precoEl = document.getElementById("preco");
            const anoFabEl = document.getElementById("anoFabricacao");
            const anoModEl = document.getElementById("anoModelo");
            const kmEl = document.getElementById("quilometragem");
            const combustivelEl = document.getElementById("combustivel");
            const cambioEl = document.getElementById("cambio");
            const corEl = document.getElementById("cor");
            const portasEl = document.getElementById("portas");
            const carroceriaEl = document.getElementById("carroceria");
            const descricaoEl = document.getElementById("descricao");

            const anoAtual = new Date().getFullYear();
            let valido = true;

            definirErro(marcaEl, document.getElementById("erroMarca"), "");
            definirErro(modeloEl, document.getElementById("erroModelo"), "");
            definirErro(anoFabEl, document.getElementById("erroAnoFabricacao"), "");
            definirErro(anoModEl, document.getElementById("erroAnoModelo"), "");
            definirErro(precoEl, document.getElementById("erroPreco"), "");

            if (!marcaEl.value.trim()) {
                definirErro(marcaEl, document.getElementById("erroMarca"), "Digite a marca.");
                valido = false;
            }
            if (!modeloEl.value.trim()) {
                definirErro(modeloEl, document.getElementById("erroModelo"), "Digite o modelo.");
                valido = false;
            }

            const anoFab = Number(anoFabEl.value);
            if (!anoFabEl.value || anoFab < 1950 || anoFab > anoAtual + 1) {
                definirErro(anoFabEl, document.getElementById("erroAnoFabricacao"), `Informe um ano entre 1950 e ${anoAtual + 1}.`);
                valido = false;
            }

            const anoMod = Number(anoModEl.value);
            if (!anoModEl.value || anoMod < 1950 || anoMod > anoAtual + 1) {
                definirErro(anoModEl, document.getElementById("erroAnoModelo"), `Informe um ano entre 1950 e ${anoAtual + 1}.`);
                valido = false;
            }

            const preco = Number(precoEl.value);
            if (!precoEl.value || preco <= 0) {
                definirErro(precoEl, document.getElementById("erroPreco"), "Informe um preço válido, maior que zero.");
                valido = false;
            }

            if (!valido) {
                mostrarToast("Revise os campos destacados antes de publicar.", "erro");
                return;
            }

            const formData = new FormData();
            formData.append("usuario_id", usuarioLogado.id);
            formData.append("marca", marcaEl.value.trim());
            formData.append("modelo", modeloEl.value.trim());
            formData.append("versao", versaoEl.value.trim());
            formData.append("preco", String(preco));
            formData.append("ano_fabricacao", String(anoFab));
            formData.append("ano_modelo", String(anoMod));
            formData.append("quilometragem", kmEl.value ? String(Number(kmEl.value)) : "0");
            formData.append("combustivel", combustivelEl.value);
            formData.append("cambio", cambioEl.value);
            formData.append("cor", corEl.value.trim());
            formData.append("portas", portasEl.value ? String(Number(portasEl.value)) : "2");
            formData.append("carroceria", carroceriaEl.value);
            formData.append("descricao", descricaoEl.value.trim());

            if (inputImagem && inputImagem.files && inputImagem.files[0]) {
                formData.append("imagem", inputImagem.files[0]);
            }

            if (btnAnunciar) {
                btnAnunciar.textContent = "Publicando...";
                btnAnunciar.disabled = true;
            }

            try {
                const resposta = await fetch("/api/veiculos", { method: "POST", body: formData });
                const resultado = await resposta.json();

                if (resposta.ok && resultado.sucesso) {
                    mostrarToast(resultado.mensagem || "Anúncio publicado com sucesso!", "sucesso");
                    formAnuncio.reset();
                    limparSelecaoImagem();
                    await carregarVeiculosDoBanco();
                    irParaCatalogo();

                    if (usuarioLogado.tipo === "empresa") {
                        window.location.href = "/pages/painel-empresa.html";
                    } else if (usuarioLogado.tipo === "cliente") {
                        window.location.href = "/pages/painel-cliente.html";
                    }
                } else {
                    mostrarToast(resultado.mensagem || "Não foi possível publicar o anúncio.", "erro");
                }
            } catch (erro) {
                console.error("Erro na requisição de cadastro:", erro);
                mostrarToast("Erro de conexão com o servidor ao tentar enviar o anúncio.", "erro");
            } finally {
                if (btnAnunciar) {
                    btnAnunciar.textContent = "Publicar anúncio";
                    btnAnunciar.disabled = false;
                }
            }
        });
    }

    // ==========================================
    // 5. AVALIAÇÃO PROFISSIONAL (validação client-side)
    // ==========================================
    const formAvaliacao = document.getElementById("formAvaliacao");
    const avaPlacaEl = document.getElementById("avaPlaca");

    if (avaPlacaEl) {
        avaPlacaEl.addEventListener("input", () => {
            avaPlacaEl.value = avaPlacaEl.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
        });
    }

    const avaTelefoneEl = document.getElementById("avaTelefone");
    if (avaTelefoneEl) {
        avaTelefoneEl.addEventListener("input", () => {
            const digitos = avaTelefoneEl.value.replace(/\D/g, "").slice(0, 11);
            let formatado = digitos;
            if (digitos.length > 6) {
                formatado = `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
            } else if (digitos.length > 2) {
                formatado = `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
            }
            avaTelefoneEl.value = formatado;
        });
    }

    if (formAvaliacao) {
        formAvaliacao.addEventListener("submit", (e) => {
            e.preventDefault();

            const nomeEl = document.getElementById("avaNome");
            const kmEl = document.getElementById("avaKm");

            let valido = true;

            definirErro(nomeEl, document.getElementById("erroAvaNome"), "");
            definirErro(avaTelefoneEl, document.getElementById("erroAvaTelefone"), "");
            definirErro(avaPlacaEl, document.getElementById("erroAvaPlaca"), "");
            definirErro(kmEl, document.getElementById("erroAvaKm"), "");

            if (!nomeEl.value.trim() || nomeEl.value.trim().length < 3) {
                definirErro(nomeEl, document.getElementById("erroAvaNome"), "Digite seu nome completo.");
                valido = false;
            }

            const digitosTelefone = avaTelefoneEl.value.replace(/\D/g, "");
            if (digitosTelefone.length < 10) {
                definirErro(avaTelefoneEl, document.getElementById("erroAvaTelefone"), "Informe um telefone válido com DDD.");
                valido = false;
            }

            // Aceita placas no padrão antigo (ABC1234) e Mercosul (ABC1D23)
            const padraoPlaca = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
            if (!padraoPlaca.test(avaPlacaEl.value)) {
                definirErro(avaPlacaEl, document.getElementById("erroAvaPlaca"), "Informe uma placa válida (ex: ABC1D23).");
                valido = false;
            }

            if (!kmEl.value || Number(kmEl.value) < 0) {
                definirErro(kmEl, document.getElementById("erroAvaKm"), "Informe a quilometragem atual.");
                valido = false;
            }

            if (!valido) {
                mostrarToast("Revise os campos destacados no formulário.", "erro");
                return;
            }

            mostrarToast("Solicitação enviada! Nossa equipe entrará em contato em breve.", "sucesso");
            formAvaliacao.reset();
        });
    }

    // ==========================================
    // 6. SIMULADOR DE FINANCIAMENTO
    // ==========================================
    const btnSimular = document.getElementById("btnSimular");
    const TAXAS_JUROS = { excelente: 0.0129, bom: 0.0159, regular: 0.0199 };

    if (btnSimular) {
        btnSimular.addEventListener("click", () => {
            const finValorEl = document.getElementById("finValor");
            const finEntradaEl = document.getElementById("finEntrada");
            const finParcelasEl = document.getElementById("finParcelas");
            const finScoreEl = document.getElementById("finScore");
            const erroFin = document.getElementById("erroFinanciamento");
            const resultado = document.getElementById("resultadoSimulacao");

            if (erroFin) erroFin.textContent = "";

            const valorVeiculo = Number(finValorEl.value);
            const entrada = Number(finEntradaEl.value) || 0;
            const parcelas = Number(finParcelasEl.value);
            const taxa = TAXAS_JUROS[finScoreEl.value] ?? TAXAS_JUROS.bom;

            if (!valorVeiculo || valorVeiculo <= 0) {
                if (erroFin) erroFin.textContent = "Informe o valor do veículo para simular.";
                resultado.style.display = "none";
                return;
            }

            if (entrada < 0 || entrada >= valorVeiculo) {
                if (erroFin) erroFin.textContent = "A entrada deve ser menor que o valor do veículo.";
                resultado.style.display = "none";
                return;
            }

            const valorFinanciado = valorVeiculo - entrada;

            // Sistema Price (parcelas fixas): PMT = PV * i / (1 - (1+i)^-n)
            const parcelaMensal = (valorFinanciado * taxa) / (1 - Math.pow(1 + taxa, -parcelas));
            const custoTotal = parcelaMensal * parcelas + entrada;

            document.getElementById("resFinanciado").textContent = formatarMoeda(valorFinanciado);
            document.getElementById("resParcela").textContent = `${formatarMoeda(parcelaMensal)} /mês`;
            document.getElementById("resTotal").textContent = formatarMoeda(custoTotal);
            document.getElementById("resTaxa").textContent = `${(taxa * 100).toFixed(2).replace(".", ",")}% a.m.`;

            resultado.style.display = "block";
        });
    }

    // ==========================================
    // 7. INICIALIZAÇÃO
    // ==========================================
    carregarVeiculosDoBanco();
});