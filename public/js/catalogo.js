document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 0. UTILITÁRIOS DE SEGURANÇA
    // ==========================================

    function escapeHTML(valor) {
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

    function sanitizarSrcImagem(src) {
        if (typeof src !== "string") {
            return "/imagens/sem-foto.jpg";
        }

        if (
            src.startsWith("/")
            || src.startsWith("https://")
        ) {
            return src;
        }

        return "/imagens/sem-foto.jpg";
    }

    function lerLocalStorageSeguro(chave) {
        try {
            return JSON.parse(
                localStorage.getItem(chave)
            );
        } catch {
            return null;
        }
    }

    function lerJSONSeguro(
        storage,
        chave
    ) {
        try {
            const valor =
                storage.getItem(chave);

            return valor
                ? JSON.parse(valor)
                : null;
        } catch {
            return null;
        }
    }

    function obterUsuarioSessao() {
        for (
            const storage
            of [localStorage, sessionStorage]
        ) {
            for (
                const chave
                of ["usuario", "usuario_logado"]
            ) {
                const dados =
                    lerJSONSeguro(
                        storage,
                        chave
                    );

                if (
                    dados
                    && typeof dados === "object"
                ) {
                    return dados;
                }
            }
        }

        return null;
    }

    function obterToken() {
        return localStorage.getItem("token")
            || sessionStorage.getItem("token");
    }

    function limparSessao() {
        [
            localStorage,
            sessionStorage
        ].forEach((storage) => {
            [
                "usuario",
                "usuario_logado",
                "token"
            ].forEach((chave) => {
                storage.removeItem(chave);
            });
        });
    }

    function possuiSessaoValida() {
        const usuarioAtual =
            obterUsuarioSessao();

        return Boolean(
            usuarioAtual?.id
            && obterToken()
        );
    }

    function obterRotaPainel(
        usuarioAtual
    ) {
        if (!usuarioAtual) {
            return "/pages/painel-cliente.html";
        }

        if (
            usuarioAtual.tipo === "empresa"
        ) {
            return "/pages/painel-empresa.html";
        }

        if (
            [
                "admin",
                "super_admin"
            ].includes(
                usuarioAtual.tipo
            )
            || usuarioAtual.cargo === "admin"
        ) {
            return "/pages/painel-admin.html";
        }

        return "/pages/painel-cliente.html";
    }

    const usuario =
        obterUsuarioSessao();

    const btnPainel =
        document.getElementById(
            "btnPainel"
        );

    if (
        btnPainel
        && usuario
    ) {
        btnPainel.href =
            obterRotaPainel(usuario);
    }

    // ==========================================
    // MÁSCARA DE PREÇO
    // ==========================================

    const precoInput =
        document.getElementById(
            "preco"
        );

    if (precoInput) {
        precoInput.type = "text";

        precoInput.removeAttribute(
            "min"
        );

        precoInput.removeAttribute(
            "max"
        );

        precoInput.removeAttribute(
            "step"
        );

        precoInput.setAttribute(
            "inputmode",
            "numeric"
        );

        precoInput.setAttribute(
            "autocomplete",
            "off"
        );

        precoInput.setAttribute(
            "maxlength",
            "10"
        );

        precoInput.placeholder = "0";

        precoInput.addEventListener(
            "input",
            (evento) => {
                const digitos =
                    evento.target.value
                        .replace(/\D/g, "")
                        .slice(0, 8);

                if (digitos === "") {
                    evento.target.value = "";
                    return;
                }

                evento.target.value =
                    Number(
                        digitos
                    ).toLocaleString(
                        "pt-BR"
                    );
            }
        );
    }

    // ==========================================
    // AVISOS
    // ==========================================

    const toastContainer =
        document.getElementById(
            "toastContainer"
        );

    function mostrarToast(
        mensagem,
        tipo = "info"
    ) {
        if (!toastContainer) {
            console.log(mensagem);
            return;
        }

        const toast =
            document.createElement("div");

        toast.className =
            `toast ${tipo}`;

        toast.textContent =
            mensagem;

        toastContainer.appendChild(
            toast
        );

        setTimeout(() => {
            toast.remove();
        }, 4500);
    }

    function mostrarAvisoRedirecionarLogin(
        mensagem
    ) {
        const modalAntigo =
            document.getElementById(
                "modalAvisoLogin"
            );

        if (modalAntigo) {
            modalAntigo.remove();
        }

        const overlay =
            document.createElement("div");

        overlay.id =
            "modalAvisoLogin";

        overlay.setAttribute(
            "role",
            "alertdialog"
        );

        overlay.setAttribute(
            "aria-modal",
            "true"
        );

        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(4,5,6,0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            backdrop-filter: blur(4px);
        `;

        const caixa =
            document.createElement("div");

        caixa.style.cssText = `
            background: #14181f;
            border: 1px solid #c97a3c;
            padding: 34px;
            border-radius: 10px;
            max-width: 420px;
            width: 90%;
            text-align: center;
            box-shadow: 0 20px 50px rgba(0,0,0,0.7);
        `;

        const marca =
            document.createElement("div");

        marca.style.cssText = `
            font-family: 'Oswald', sans-serif;
            font-size: 26px;
            color: #e08f4d;
            margin-bottom: 15px;
            font-weight: 600;
            letter-spacing: 2px;
        `;

        marca.textContent =
            "MOTORFLEX";

        const titulo =
            document.createElement("h3");

        titulo.style.cssText = `
            color: #fff;
            font-size: 18px;
            margin-bottom: 12px;
            font-weight: 600;
        `;

        titulo.textContent =
            "Autenticação necessária";

        const paragrafo =
            document.createElement("p");

        paragrafo.style.cssText = `
            color: #8b93a1;
            font-size: 13.5px;
            line-height: 1.6;
            margin-bottom: 22px;
        `;

        paragrafo.textContent =
            mensagem;

        const rodape =
            document.createElement("div");

        rodape.style.cssText = `
            color: #5b6270;
            font-size: 11px;
            letter-spacing: 1px;
        `;

        rodape.textContent =
            "Redirecionando para o login...";

        caixa.append(
            marca,
            titulo,
            paragrafo,
            rodape
        );

        overlay.appendChild(
            caixa
        );

        document.body.appendChild(
            overlay
        );

        setTimeout(() => {
            window.location.href =
                "/pages/login.html";
        }, 2200);
    }

    // ==========================================
    // 1. NAVEGAÇÃO ENTRE ABAS
    // ==========================================

    const navLinks =
        document.querySelectorAll(
            ".nav-link"
        );

    const pageTabs =
        document.querySelectorAll(
            ".page-tab"
        );

    const liveRegion =
        document.getElementById(
            "liveRegion"
        );

    function ativarAbaPorId(tabId) {
        const alvo =
            document.getElementById(
                tabId
            );

        if (!alvo) return;

        navLinks.forEach((link) => {
            const ehAtiva =
                link.getAttribute(
                    "data-tab"
                ) === tabId;

            link.classList.toggle(
                "active",
                ehAtiva
            );

            if (ehAtiva) {
                link.setAttribute(
                    "aria-current",
                    "page"
                );
            } else {
                link.removeAttribute(
                    "aria-current"
                );
            }
        });

        pageTabs.forEach((pagina) => {
            pagina.classList.toggle(
                "active",
                pagina.id === tabId
            );
        });

        if (liveRegion) {
            liveRegion.textContent =
                `Seção ${
                    alvo.querySelector(
                        "h2"
                    )?.textContent
                    || tabId
                } exibida.`;
        }
    }

    function exigeLogin(tabId) {
        return (
            tabId === "tab-cadastrar"
            || tabId === "cadastrar"
        );
    }

    navLinks.forEach((link) => {
        link.addEventListener(
            "click",
            (evento) => {
                evento.preventDefault();

                const targetTab =
                    link.getAttribute(
                        "data-tab"
                    );

                if (
                    exigeLogin(targetTab)
                    && !possuiSessaoValida()
                ) {
                    mostrarAvisoRedirecionarLogin(
                        "Para publicar anúncios de veículos, é necessário acessar uma conta ativa."
                    );

                    return;
                }

                ativarAbaPorId(
                    targetTab
                );
            }
        );
    });

    const urlParams =
        new URLSearchParams(
            window.location.search
        );

    const abaDaUrl =
        urlParams.get("tab");

    if (
        abaDaUrl
        && /^[a-z-]+$/i.test(
            abaDaUrl
        )
    ) {
        const idAba =
            abaDaUrl.startsWith("tab-")
                ? abaDaUrl
                : `tab-${abaDaUrl}`;

        if (
            exigeLogin(abaDaUrl)
            && !possuiSessaoValida()
        ) {
            mostrarAvisoRedirecionarLogin(
                "Para publicar anúncios de veículos, é necessário acessar uma conta ativa."
            );
        } else {
            ativarAbaPorId(
                idAba
            );
        }
    }

    function irParaCatalogo() {
        ativarAbaPorId(
            "tab-catalogo"
        );
    }

    // ==========================================
    // 2. CATÁLOGO
    // ==========================================

    let bancoDeDadosVeiculos = [];

    const featuredCarContainer =
        document.getElementById(
            "featuredCar"
        );

    const carsGrid =
        document.getElementById(
            "carsGrid"
        );

    const topDealsContainer =
        document.getElementById(
            "topDeals"
        );

    const resultCount =
        document.getElementById(
            "resultCount"
        );

    const inputBusca =
        document.getElementById(
            "filtroBusca"
        );

    const inputPrecoMax =
        document.getElementById(
            "filtroPrecoMax"
        );

    const inputAnoMin =
        document.getElementById(
            "filtroAnoMin"
        );

    const selectCombustivel =
        document.getElementById(
            "filtroCombustivel"
        );

    const selectCambio =
        document.getElementById(
            "filtroCambio"
        );

    const selectCarroceria =
        document.getElementById(
            "filtroCarroceria"
        );

    const formFiltro =
        document.getElementById(
            "formFiltro"
        );

    const btnLimpar =
        document.getElementById(
            "btnLimparFiltros"
        );

    function formatarMoeda(valor) {
        const numero =
            Number(valor) || 0;

        const temCentavos =
            Math.round(
                numero * 100
            ) % 100 !== 0;

        return numero.toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL",
                minimumFractionDigits:
                    temCentavos ? 2 : 0,
                maximumFractionDigits:
                    temCentavos ? 2 : 0
            }
        );
    }

    const NOMES_COMBUSTIVEL = {
        1: "Gasolina",
        2: "Etanol",
        3: "Flex",
        4: "Diesel",
        5: "Elétrico",
        6: "Híbrido"
    };

    const NOMES_CAMBIO = {
        1: "Manual",
        2: "Automático",
        3: "Semi-automático"
    };

    function textoOuNulo(valor) {
        return (
            typeof valor === "string"
            && valor.trim()
            && !/^\d+$/.test(
                valor.trim()
            )
        )
            ? valor.trim()
            : null;
    }

    async function carregarVeiculosDoBanco() {
        try {
            const resposta =
                await fetch(
                    "/api/veiculos"
                );

            const dados =
                await resposta
                    .json()
                    .catch(() => ({}));

            if (!resposta.ok) {
                throw new Error(
                    dados.mensagem
                    || `Falha HTTP ${resposta.status}`
                );
            }

            if (
                dados.sucesso
                && Array.isArray(
                    dados.veiculos
                )
            ) {
                bancoDeDadosVeiculos =
                    dados.veiculos.map(
                        (veiculo) => ({
                            id:
                                Number(
                                    veiculo.id
                                ) || 0,

                            marca:
                                String(
                                    veiculo.marca_nome
                                    || veiculo.marca
                                    || "Outra"
                                ),

                            modelo_nome:
                                String(
                                    veiculo.modelo_nome
                                    || veiculo.modelo
                                    || ""
                                ),

                            marca_nome:
                                String(
                                    veiculo.marca_nome
                                    || veiculo.marca
                                    || ""
                                ),

                            versao:
                                String(
                                    veiculo.versao
                                    || ""
                                ),

                            categoria:
                                String(
                                    veiculo.carroceria
                                    || "Outro"
                                ),

                            transmissao:
                                textoOuNulo(
                                    veiculo.cambio_nome
                                )
                                || textoOuNulo(
                                    veiculo.cambio
                                )
                                || NOMES_CAMBIO[
                                    veiculo.tipo_transmissao_id
                                ]
                                || "Não informado",

                            combustivel:
                                textoOuNulo(
                                    veiculo.combustivel_nome
                                )
                                || textoOuNulo(
                                    veiculo.combustivel
                                )
                                || NOMES_COMBUSTIVEL[
                                    veiculo.tipo_combustivel_id
                                ]
                                || "Não informado",

                            ano:
                                Number(
                                    veiculo.ano_modelo
                                ) || 2020,

                            ano_fabricacao:
                                Number(
                                    veiculo.ano_fabricacao
                                ) || 2020,

                            condicao:
                                "Seminovo",

                            quilometragem:
                                Number(
                                    veiculo.quilometragem
                                ) || 0,

                            preco:
                                Number(
                                    veiculo.preco
                                ) || 0,

                            destaquePrincipal:
                                Boolean(
                                    veiculo.destaque_principal
                                ),

                            imagem:
                                sanitizarSrcImagem(
                                    veiculo.imagem
                                        ? `/uploads/${veiculo.imagem}`
                                        : "/imagens/sem-foto.jpg"
                                )
                        })
                    );
            }
        } catch (erro) {
            console.error(
                "Erro ao carregar veículos:",
                erro
            );

            mostrarToast(
                "Não foi possível carregar o catálogo agora.",
                "erro"
            );
        }

        renderizarDestaque();

        renderizarCardsCatalogo(
            bancoDeDadosVeiculos
        );

        renderizarTopDeals();
    }

    function renderizarDestaque() {
        if (!featuredCarContainer) {
            return;
        }

        if (
            bancoDeDadosVeiculos.length
            === 0
        ) {
            featuredCarContainer.innerHTML =
                "";

            return;
        }

        const principal =
            bancoDeDadosVeiculos.find(
                (veiculo) => {
                    return veiculo
                        .destaquePrincipal;
                }
            )
            || bancoDeDadosVeiculos[0];

        const nomeCompleto =
            `${principal.marca_nome} ${principal.modelo_nome}`
                .trim();

        featuredCarContainer.innerHTML = `
            <img
                src="${sanitizarSrcImagem(principal.imagem)}"
                alt="${escapeHTML(nomeCompleto)}"
            >

            <div class="featured-info">
                <span>
                    ${escapeHTML(String(principal.ano))}
                    ·
                    ${escapeHTML(nomeCompleto)}
                </span>

                <span class="price">
                    ${formatarMoeda(principal.preco)}
                </span>
            </div>
        `;
    }

    function renderizarCardsCatalogo(
        lista
    ) {
        if (!carsGrid) return;

        carsGrid.innerHTML = "";

        if (resultCount) {
            resultCount.textContent =
                `${lista.length} veículo${
                    lista.length === 1
                        ? ""
                        : "s"
                } encontrado${
                    lista.length === 1
                        ? ""
                        : "s"
                }`;
        }

        if (lista.length === 0) {
            const vazio =
                document.createElement("p");

            vazio.className =
                "empty-state";

            vazio.textContent =
                "Nenhum veículo encontrado com os filtros selecionados.";

            carsGrid.appendChild(
                vazio
            );

            return;
        }

        const usuarioLogado =
            obterUsuarioSessao();

        const temLoginValido =
            Boolean(
                usuarioLogado?.id
            );

        const favoritosIds =
            lerLocalStorageSeguro(
                "favoritos_veiculos"
            ) || [];

        lista.forEach((veiculo) => {
            const isFavorito =
                temLoginValido
                && Array.isArray(
                    favoritosIds
                )
                && favoritosIds.includes(
                    veiculo.id
                );

            const nomeCompleto =
                `${veiculo.marca_nome} ${veiculo.modelo_nome}`
                    .trim();

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "card-item-catalogo";

            const iconeClasse =
                isFavorito
                    ? "fa-solid fa-heart"
                    : "fa-regular fa-heart";

            const corIcone =
                isFavorito
                    ? "color: #ff0000;"
                    : "color: #ffffff;";

            card.innerHTML = `
                <div class="card-img-wrapper">
                    <img
                        src="${sanitizarSrcImagem(veiculo.imagem)}"
                        alt="${escapeHTML(nomeCompleto)}"
                        loading="lazy"
                    >

                    <button
                        type="button"
                        class="btn-favoritar"
                        data-id="${veiculo.id}"
                        title="${
                            isFavorito
                                ? "Remover dos favoritos"
                                : "Favoritar veículo"
                        }"
                        aria-pressed="${isFavorito}"
                    >
                        <i
                            class="${iconeClasse}"
                            style="${corIcone}"
                        ></i>
                    </button>
                </div>

                <div class="card-corpo">
                    <h3>
                        ${escapeHTML(nomeCompleto)}
                    </h3>

                    <p class="card-versao">
                        ${escapeHTML(veiculo.versao)}
                    </p>

                    <p class="card-detalhes">
                        Ano
                        ${escapeHTML(String(veiculo.ano_fabricacao))}
                        /
                        ${escapeHTML(String(veiculo.ano))}
                        ·
                        ${escapeHTML(
                            veiculo.quilometragem
                                .toLocaleString("pt-BR")
                        )}
                        km
                    </p>

                    <div class="card-footer">
                        <div>
                            <span class="rotulo-preco">
                                Valor total
                            </span>

                            <span class="card-preco">
                                ${formatarMoeda(veiculo.preco)}
                            </span>
                        </div>

                        <a
                            href="/pages/detalhes-veiculo.html?id=${
                                encodeURIComponent(
                                    veiculo.id
                                )
                            }"
                            class="btn-detalhes"
                        >
                            Ver detalhes
                        </a>
                    </div>
                </div>
            `;

            const btnFav =
                card.querySelector(
                    ".btn-favoritar"
                );

            btnFav?.addEventListener(
                "click",
                (evento) => {
                    evento.preventDefault();
                    evento.stopPropagation();

                    const usuarioAtual =
                        obterUsuarioSessao();

                    if (
                        !usuarioAtual?.id
                    ) {
                        mostrarAvisoRedirecionarLogin(
                            "Para favoritar veículos, é necessário acessar sua conta."
                        );

                        return;
                    }

                    let favoritosAtuais =
                        lerLocalStorageSeguro(
                            "favoritos_veiculos"
                        ) || [];

                    if (
                        !Array.isArray(
                            favoritosAtuais
                        )
                    ) {
                        favoritosAtuais = [];
                    }

                    const jaFavoritado =
                        favoritosAtuais.includes(
                            veiculo.id
                        );

                    favoritosAtuais =
                        jaFavoritado
                            ? favoritosAtuais.filter(
                                (id) => {
                                    return id
                                        !== veiculo.id;
                                }
                            )
                            : [
                                ...favoritosAtuais,
                                veiculo.id
                            ];

                    const icone =
                        btnFav.querySelector(
                            "i"
                        );

                    if (icone) {
                        icone.className =
                            jaFavoritado
                                ? "fa-regular fa-heart"
                                : "fa-solid fa-heart";

                        icone.style.color =
                            jaFavoritado
                                ? "#ffffff"
                                : "#ff0000";
                    }

                    btnFav.setAttribute(
                        "aria-pressed",
                        String(
                            !jaFavoritado
                        )
                    );

                    btnFav.title =
                        jaFavoritado
                            ? "Favoritar veículo"
                            : "Remover dos favoritos";

                    localStorage.setItem(
                        "favoritos_veiculos",
                        JSON.stringify(
                            favoritosAtuais
                        )
                    );
                }
            );

            carsGrid.appendChild(
                card
            );
        });
    }

    function renderizarTopDeals() {
        if (!topDealsContainer) {
            return;
        }

        topDealsContainer.innerHTML = "";

        bancoDeDadosVeiculos
            .slice(0, 4)
            .forEach((carro) => {
                const nomeCompleto =
                    `${carro.marca_nome} ${carro.modelo_nome}`
                        .trim();

                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "deal-item";

                item.innerHTML = `
                    <img
                        src="${sanitizarSrcImagem(carro.imagem)}"
                        alt="${escapeHTML(nomeCompleto)}"
                        loading="lazy"
                    >

                    <div class="deal-info">
                        <div class="deal-title">
                            ${escapeHTML(nomeCompleto)}
                        </div>

                        <div
                            style="
                                color: var(--text-faint);
                                font-size: 0.72rem;
                            "
                        >
                            ${escapeHTML(String(carro.ano))}
                            ·
                            ${escapeHTML(carro.condicao)}
                        </div>

                        <div class="deal-price">
                            ${formatarMoeda(carro.preco)}
                        </div>
                    </div>
                `;

                topDealsContainer.appendChild(
                    item
                );
            });
    }

    // ==========================================
    // FILTROS
    // ==========================================

    function executarBusca() {
        const termo =
            inputBusca
                ? inputBusca.value
                    .trim()
                    .toLowerCase()
                    .slice(0, 60)
                : "";

        const precoMax =
            inputPrecoMax
            && inputPrecoMax.value !== ""
                ? Number(
                    inputPrecoMax.value
                )
                : null;

        const anoMin =
            inputAnoMin
            && inputAnoMin.value !== ""
                ? Number(
                    inputAnoMin.value
                )
                : null;

        const combustivel =
            selectCombustivel
                ? selectCombustivel.value
                : "";

        const cambio =
            selectCambio
                ? selectCambio.value
                : "";

        const carroceria =
            selectCarroceria
                ? selectCarroceria.value
                : "";

        const filtrados =
            bancoDeDadosVeiculos.filter(
                (veiculo) => {
                    const nomeCompleto =
                        `${veiculo.marca_nome} ${veiculo.modelo_nome} ${veiculo.versao}`
                            .toLowerCase();

                    const bateTexto =
                        termo === ""
                        || nomeCompleto.includes(
                            termo
                        );

                    const batePreco =
                        precoMax === null
                        || Number.isNaN(
                            precoMax
                        )
                        || veiculo.preco
                            <= precoMax;

                    const bateAno =
                        anoMin === null
                        || Number.isNaN(
                            anoMin
                        )
                        || veiculo.ano
                            >= anoMin;

                    const bateCombustivel =
                        combustivel === ""
                        || veiculo.combustivel
                            === combustivel;

                    const bateCambio =
                        cambio === ""
                        || veiculo.transmissao
                            === cambio;

                    const bateCarroceria =
                        carroceria === ""
                        || veiculo.categoria
                            === carroceria;

                    return (
                        bateTexto
                        && batePreco
                        && bateAno
                        && bateCombustivel
                        && bateCambio
                        && bateCarroceria
                    );
                }
            );

        renderizarCardsCatalogo(
            filtrados
        );
    }

    formFiltro?.addEventListener(
        "submit",
        (evento) => {
            evento.preventDefault();
            executarBusca();
        }
    );

    btnLimpar?.addEventListener(
        "click",
        () => {
            setTimeout(
                executarBusca,
                0
            );
        }
    );

    if (inputBusca) {
        let debounce;

        inputBusca.addEventListener(
            "input",
            () => {
                clearTimeout(debounce);

                debounce = setTimeout(
                    executarBusca,
                    250
                );
            }
        );
    }

    // ==========================================
    // 3. UPLOAD E PRÉ-VISUALIZAÇÃO
    // ==========================================

    const inputImagem =
        document.getElementById(
            "imagem"
        );

    const btnVerFoto =
        document.getElementById(
            "btnVerFoto"
        );

    const nomeArquivo =
        document.getElementById(
            "nomeArquivoSelecionado"
        );

    const modal =
        document.getElementById(
            "modalVisualizarFoto"
        );

    const imgPreviewModal =
        document.getElementById(
            "imgPreviewModal"
        );

    const miniaturaPreview =
        document.getElementById(
            "miniaturaPreview"
        );

    const erroImagem =
        document.getElementById(
            "erroImagem"
        );

    const TIPOS_IMAGEM_ACEITOS = [
        "image/png",
        "image/jpeg",
        "image/webp"
    ];

    const TAMANHO_MAXIMO_MB = 5;

    function limparSelecaoImagem() {
        if (nomeArquivo) {
            nomeArquivo.textContent =
                "Selecionar foto";
        }

        if (btnVerFoto) {
            btnVerFoto.disabled = true;
        }

        if (imgPreviewModal) {
            imgPreviewModal.src = "";
        }

        if (miniaturaPreview) {
            miniaturaPreview.src = "";

            miniaturaPreview.style.display =
                "none";
        }

        if (inputImagem) {
            inputImagem.value = "";
        }
    }

    inputImagem?.addEventListener(
        "change",
        (evento) => {
            const arquivo =
                evento.target.files?.[0];

            if (erroImagem) {
                erroImagem.textContent = "";
            }

            if (!arquivo) {
                limparSelecaoImagem();
                return;
            }

            if (
                !TIPOS_IMAGEM_ACEITOS.includes(
                    arquivo.type
                )
            ) {
                if (erroImagem) {
                    erroImagem.textContent =
                        "Envie uma imagem PNG, JPEG ou WebP.";
                }

                limparSelecaoImagem();
                return;
            }

            if (
                arquivo.size
                > TAMANHO_MAXIMO_MB
                    * 1024
                    * 1024
            ) {
                if (erroImagem) {
                    erroImagem.textContent =
                        `A imagem deve ter até ${TAMANHO_MAXIMO_MB} MB.`;
                }

                limparSelecaoImagem();
                return;
            }

            if (nomeArquivo) {
                nomeArquivo.textContent =
                    arquivo.name.slice(0, 40);
            }

            if (btnVerFoto) {
                btnVerFoto.disabled = false;
            }

            const reader =
                new FileReader();

            reader.onload =
                (eventoLeitura) => {
                    const urlResultado =
                        eventoLeitura
                            .target
                            .result;

                    if (imgPreviewModal) {
                        imgPreviewModal.src =
                            urlResultado;
                    }

                    if (miniaturaPreview) {
                        miniaturaPreview.src =
                            urlResultado;

                        miniaturaPreview.style.display =
                            "block";
                    }
                };

            reader.onerror = () => {
                if (erroImagem) {
                    erroImagem.textContent =
                        "Não foi possível ler a imagem.";
                }

                limparSelecaoImagem();
            };

            reader.readAsDataURL(
                arquivo
            );
        }
    );

    function abrirModalFoto() {
        if (
            modal
            && imgPreviewModal
            && imgPreviewModal.src
        ) {
            modal.classList.add(
                "ativo"
            );

            document
                .getElementById(
                    "btnFecharModal"
                )
                ?.focus();
        }
    }

    function fecharModalFoto() {
        modal?.classList.remove(
            "ativo"
        );
    }

    btnVerFoto?.addEventListener(
        "click",
        abrirModalFoto
    );

    document
        .getElementById(
            "btnFecharModal"
        )
        ?.addEventListener(
            "click",
            fecharModalFoto
        );

    modal?.addEventListener(
        "click",
        (evento) => {
            if (evento.target === modal) {
                fecharModalFoto();
            }
        }
    );

    document.addEventListener(
        "keydown",
        (evento) => {
            if (evento.key === "Escape") {
                fecharModalFoto();
            }
        }
    );

    // ==========================================
    // 4. VALIDAÇÃO E ENVIO DO ANÚNCIO
    // ==========================================

    const formAnuncio =
        document.getElementById(
            "formAnuncio"
        );

    const btnAnunciar =
        document.getElementById(
            "btnAnunciar"
        );

    const PRECO_MAXIMO =
        10000000;

    function definirErro(
        campo,
        elementoErro,
        mensagem
    ) {
        if (elementoErro) {
            elementoErro.textContent =
                mensagem;
        }

        if (campo) {
            campo.setAttribute(
                "aria-invalid",
                mensagem
                    ? "true"
                    : "false"
            );
        }
    }

    function limparPrecoParaBanco(
        valorBruto
    ) {
        if (
            typeof valorBruto
            === "number"
        ) {
            return valorBruto;
        }

        if (!valorBruto) {
            return 0;
        }

        const limpo =
            String(valorBruto)
                .replace(/\D/g, "");

        return Number(limpo) || 0;
    }

    formAnuncio?.addEventListener(
        "submit",
        async (evento) => {
            evento.preventDefault();

            const usuarioLogado =
                obterUsuarioSessao();

            const token =
                obterToken();

            if (
                !usuarioLogado?.id
                || !token
            ) {
                mostrarAvisoRedirecionarLogin(
                    "Para publicar anúncios, é necessário acessar uma conta ativa."
                );

                return;
            }

            const marcaEl =
                document.getElementById(
                    "marca"
                );

            const modeloEl =
                document.getElementById(
                    "modelo"
                );

            const versaoEl =
                document.getElementById(
                    "versao"
                );

            const precoEl =
                document.getElementById(
                    "preco"
                );

            const anoFabEl =
                document.getElementById(
                    "anoFabricacao"
                );

            const anoModEl =
                document.getElementById(
                    "anoModelo"
                );

            const kmEl =
                document.getElementById(
                    "quilometragem"
                );

            const combustivelEl =
                document.getElementById(
                    "combustivel"
                );

            const cambioEl =
                document.getElementById(
                    "cambio"
                );

            const corEl =
                document.getElementById(
                    "cor"
                );

            const portasEl =
                document.getElementById(
                    "portas"
                );

            const carroceriaEl =
                document.getElementById(
                    "carroceria"
                );

            const descricaoEl =
                document.getElementById(
                    "descricao"
                );

            const anoAtual =
                new Date().getFullYear();

            let valido = true;

            definirErro(
                marcaEl,
                document.getElementById(
                    "erroMarca"
                ),
                ""
            );

            definirErro(
                modeloEl,
                document.getElementById(
                    "erroModelo"
                ),
                ""
            );

            definirErro(
                anoFabEl,
                document.getElementById(
                    "erroAnoFabricacao"
                ),
                ""
            );

            definirErro(
                anoModEl,
                document.getElementById(
                    "erroAnoModelo"
                ),
                ""
            );

            definirErro(
                precoEl,
                document.getElementById(
                    "erroPreco"
                ),
                ""
            );

            if (!marcaEl.value.trim()) {
                definirErro(
                    marcaEl,
                    document.getElementById(
                        "erroMarca"
                    ),
                    "Digite a marca."
                );

                valido = false;
            }

            if (!modeloEl.value.trim()) {
                definirErro(
                    modeloEl,
                    document.getElementById(
                        "erroModelo"
                    ),
                    "Digite o modelo."
                );

                valido = false;
            }

            const anoFab =
                Number(
                    anoFabEl.value
                );

            if (
                !anoFabEl.value
                || anoFab < 1950
                || anoFab > anoAtual + 1
            ) {
                definirErro(
                    anoFabEl,
                    document.getElementById(
                        "erroAnoFabricacao"
                    ),
                    `Informe um ano entre 1950 e ${anoAtual + 1}.`
                );

                valido = false;
            }

            const anoMod =
                Number(
                    anoModEl.value
                );

            if (
                !anoModEl.value
                || anoMod < 1950
                || anoMod > anoAtual + 1
            ) {
                definirErro(
                    anoModEl,
                    document.getElementById(
                        "erroAnoModelo"
                    ),
                    `Informe um ano entre 1950 e ${anoAtual + 1}.`
                );

                valido = false;
            }

            const preco =
                limparPrecoParaBanco(
                    precoEl.value
                );

            if (
                !precoEl.value
                || preco <= 0
            ) {
                definirErro(
                    precoEl,
                    document.getElementById(
                        "erroPreco"
                    ),
                    "Informe um preço válido, maior que zero."
                );

                valido = false;
            } else if (
                preco > PRECO_MAXIMO
            ) {
                definirErro(
                    precoEl,
                    document.getElementById(
                        "erroPreco"
                    ),
                    "O preço máximo é R$ 10.000.000,00."
                );

                valido = false;
            }

            if (!valido) {
                mostrarToast(
                    "Revise os campos destacados antes de publicar.",
                    "erro"
                );

                return;
            }

            const formData =
                new FormData();

            /*
             * usuario_id não é enviado.
             * O backend obtém o proprietário
             * pelo token JWT.
             */
            formData.append(
                "marca",
                marcaEl.value.trim()
            );

            formData.append(
                "modelo",
                modeloEl.value.trim()
            );

            formData.append(
                "versao",
                versaoEl.value.trim()
            );

            formData.append(
                "preco",
                String(preco)
            );

            formData.append(
                "ano_fabricacao",
                String(anoFab)
            );

            formData.append(
                "ano_modelo",
                String(anoMod)
            );

            formData.append(
                "quilometragem",
                kmEl.value
                    ? String(
                        Number(kmEl.value)
                    )
                    : "0"
            );

            formData.append(
                "combustivel",
                combustivelEl.value
            );

            formData.append(
                "cambio",
                cambioEl.value
            );

            formData.append(
                "cor",
                corEl.value.trim()
            );

            formData.append(
                "portas",
                portasEl.value
                    ? String(
                        Number(portasEl.value)
                    )
                    : "2"
            );

            formData.append(
                "carroceria",
                carroceriaEl.value
            );

            formData.append(
                "descricao",
                descricaoEl.value.trim()
            );

            if (
                inputImagem?.files?.[0]
            ) {
                formData.append(
                    "imagem",
                    inputImagem.files[0]
                );
            }

            if (btnAnunciar) {
                btnAnunciar.textContent =
                    "Publicando...";

                btnAnunciar.disabled =
                    true;
            }

            try {
                const resposta =
                    await fetch(
                        "/api/veiculos",
                        {
                            method: "POST",

                            /*
                             * Não definir Content-Type.
                             * O navegador gera o
                             * multipart/form-data.
                             */
                            headers: {
                                Authorization:
                                    `Bearer ${token}`
                            },

                            body: formData
                        }
                    );

                const resultado =
                    await resposta
                        .json()
                        .catch(() => ({}));

                if (
                    resposta.status === 401
                ) {
                    limparSessao();

                    mostrarAvisoRedirecionarLogin(
                        "Sua sessão expirou. Entre novamente para publicar o anúncio."
                    );

                    return;
                }

                if (
                    !resposta.ok
                    || resultado.sucesso
                        === false
                ) {
                    mostrarToast(
                        resultado.mensagem
                        || resultado.erro
                        || "Não foi possível publicar o anúncio.",
                        "erro"
                    );

                    return;
                }

                mostrarToast(
                    resultado.mensagem
                    || "Anúncio publicado com sucesso!",
                    "sucesso"
                );

                formAnuncio.reset();

                limparSelecaoImagem();

                await carregarVeiculosDoBanco();

                irParaCatalogo();

                if (
                    usuarioLogado.tipo
                    === "empresa"
                ) {
                    window.location.href =
                        "/pages/painel-empresa.html";
                } else if (
                    usuarioLogado.tipo
                    === "cliente"
                    || usuarioLogado.tipo
                        === "individual"
                ) {
                    window.location.href =
                        "/pages/painel-cliente.html";
                }
            } catch (erro) {
                console.error(
                    "Erro no cadastro do veículo:",
                    erro
                );

                mostrarToast(
                    "Erro de conexão com o servidor ao enviar o anúncio.",
                    "erro"
                );
            } finally {
                if (btnAnunciar) {
                    btnAnunciar.textContent =
                        "Publicar anúncio";

                    btnAnunciar.disabled =
                        false;
                }
            }
        }
    );

    // ==========================================
    // 5. AVALIAÇÃO PROFISSIONAL
    // ==========================================

    const formAvaliacao =
        document.getElementById(
            "formAvaliacao"
        );

    const avaPlacaEl =
        document.getElementById(
            "avaPlaca"
        );

    avaPlacaEl?.addEventListener(
        "input",
        () => {
            avaPlacaEl.value =
                avaPlacaEl.value
                    .toUpperCase()
                    .replace(
                        /[^A-Z0-9]/g,
                        ""
                    )
                    .slice(0, 7);
        }
    );

    const avaTelefoneEl =
        document.getElementById(
            "avaTelefone"
        );

    avaTelefoneEl?.addEventListener(
        "input",
        () => {
            const digitos =
                avaTelefoneEl.value
                    .replace(/\D/g, "")
                    .slice(0, 11);

            let formatado =
                digitos;

            if (digitos.length > 6) {
                formatado =
                    `(${digitos.slice(0, 2)}) ${
                        digitos.slice(2, 7)
                    }-${
                        digitos.slice(7)
                    }`;
            } else if (
                digitos.length > 2
            ) {
                formatado =
                    `(${digitos.slice(0, 2)}) ${
                        digitos.slice(2)
                    }`;
            }

            avaTelefoneEl.value =
                formatado;
        }
    );

    formAvaliacao?.addEventListener(
        "submit",
        (evento) => {
            evento.preventDefault();

            const nomeEl =
                document.getElementById(
                    "avaNome"
                );

            const kmEl =
                document.getElementById(
                    "avaKm"
                );

            let valido = true;

            definirErro(
                nomeEl,
                document.getElementById(
                    "erroAvaNome"
                ),
                ""
            );

            definirErro(
                avaTelefoneEl,
                document.getElementById(
                    "erroAvaTelefone"
                ),
                ""
            );

            definirErro(
                avaPlacaEl,
                document.getElementById(
                    "erroAvaPlaca"
                ),
                ""
            );

            definirErro(
                kmEl,
                document.getElementById(
                    "erroAvaKm"
                ),
                ""
            );

            if (
                !nomeEl.value.trim()
                || nomeEl.value
                    .trim()
                    .length < 3
            ) {
                definirErro(
                    nomeEl,
                    document.getElementById(
                        "erroAvaNome"
                    ),
                    "Digite seu nome completo."
                );

                valido = false;
            }

            const digitosTelefone =
                avaTelefoneEl.value
                    .replace(/\D/g, "");

            if (
                digitosTelefone.length < 10
            ) {
                definirErro(
                    avaTelefoneEl,
                    document.getElementById(
                        "erroAvaTelefone"
                    ),
                    "Informe um telefone válido com DDD."
                );

                valido = false;
            }

            const padraoPlaca =
                /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

            if (
                !padraoPlaca.test(
                    avaPlacaEl.value
                )
            ) {
                definirErro(
                    avaPlacaEl,
                    document.getElementById(
                        "erroAvaPlaca"
                    ),
                    "Informe uma placa válida (exemplo: ABC1D23)."
                );

                valido = false;
            }

            if (
                !kmEl.value
                || Number(kmEl.value) < 0
            ) {
                definirErro(
                    kmEl,
                    document.getElementById(
                        "erroAvaKm"
                    ),
                    "Informe a quilometragem atual."
                );

                valido = false;
            }

            if (!valido) {
                mostrarToast(
                    "Revise os campos destacados no formulário.",
                    "erro"
                );

                return;
            }

            mostrarToast(
                "Solicitação enviada! Nossa equipe entrará em contato em breve.",
                "sucesso"
            );

            formAvaliacao.reset();
        }
    );

    // ==========================================
    // 6. SIMULADOR DE FINANCIAMENTO
    // ==========================================

    const btnSimular =
        document.getElementById(
            "btnSimular"
        );

    const TAXAS_JUROS = {
        excelente: 0.0129,
        bom: 0.0159,
        regular: 0.0199
    };

    btnSimular?.addEventListener(
        "click",
        () => {
            const finValorEl =
                document.getElementById(
                    "finValor"
                );

            const finEntradaEl =
                document.getElementById(
                    "finEntrada"
                );

            const finParcelasEl =
                document.getElementById(
                    "finParcelas"
                );

            const finScoreEl =
                document.getElementById(
                    "finScore"
                );

            const erroFin =
                document.getElementById(
                    "erroFinanciamento"
                );

            const resultado =
                document.getElementById(
                    "resultadoSimulacao"
                );

            if (erroFin) {
                erroFin.textContent = "";
            }

            const valorVeiculo =
                Number(
                    finValorEl.value
                );

            const entrada =
                Number(
                    finEntradaEl.value
                ) || 0;

            const parcelas =
                Number(
                    finParcelasEl.value
                );

            const taxa =
                TAXAS_JUROS[
                    finScoreEl.value
                ]
                ?? TAXAS_JUROS.bom;

            if (
                !valorVeiculo
                || valorVeiculo <= 0
            ) {
                if (erroFin) {
                    erroFin.textContent =
                        "Informe o valor do veículo para simular.";
                }

                resultado.style.display =
                    "none";

                return;
            }

            if (
                entrada < 0
                || entrada >= valorVeiculo
            ) {
                if (erroFin) {
                    erroFin.textContent =
                        "A entrada deve ser menor que o valor do veículo.";
                }

                resultado.style.display =
                    "none";

                return;
            }

            const valorFinanciado =
                valorVeiculo - entrada;

            const parcelaMensal =
                (
                    valorFinanciado
                    * taxa
                )
                / (
                    1
                    - Math.pow(
                        1 + taxa,
                        -parcelas
                    )
                );

            const custoTotal =
                parcelaMensal
                * parcelas
                + entrada;

            document.getElementById(
                "resFinanciado"
            ).textContent =
                formatarMoeda(
                    valorFinanciado
                );

            document.getElementById(
                "resParcela"
            ).textContent =
                `${formatarMoeda(parcelaMensal)} /mês`;

            document.getElementById(
                "resTotal"
            ).textContent =
                formatarMoeda(
                    custoTotal
                );

            document.getElementById(
                "resTaxa"
            ).textContent =
                `${
                    (taxa * 100)
                        .toFixed(2)
                        .replace(".", ",")
                }% a.m.`;

            resultado.style.display =
                "block";
        }
    );

    // ==========================================
    // 7. SINCRONIZAÇÃO DE FAVORITOS
    // ==========================================

    window.addEventListener(
        "storage",
        (evento) => {
            if (
                evento.key
                !== "favoritos_veiculos"
            ) {
                return;
            }

            let novosFavoritos = [];

            try {
                novosFavoritos =
                    JSON.parse(
                        evento.newValue
                    ) || [];
            } catch {
                novosFavoritos = [];
            }

            const usuarioAtual =
                obterUsuarioSessao();

            const temLoginAtual =
                Boolean(
                    usuarioAtual?.id
                );

            document
                .querySelectorAll(
                    ".btn-favoritar"
                )
                .forEach((botao) => {
                    const idVeiculo =
                        Number(
                            botao.getAttribute(
                                "data-id"
                            )
                        );

                    const ehFavorito =
                        temLoginAtual
                        && novosFavoritos.includes(
                            idVeiculo
                        );

                    const icone =
                        botao.querySelector(
                            "i"
                        );

                    if (icone) {
                        icone.className =
                            ehFavorito
                                ? "fa-solid fa-heart"
                                : "fa-regular fa-heart";

                        icone.style.color =
                            ehFavorito
                                ? "#ff0000"
                                : "#ffffff";
                    }

                    botao.setAttribute(
                        "aria-pressed",
                        String(ehFavorito)
                    );

                    botao.title =
                        ehFavorito
                            ? "Remover dos favoritos"
                            : "Favoritar veículo";
                });
        }
    );

    // ==========================================
    // 8. INICIALIZAÇÃO
    // ==========================================

    carregarVeiculosDoBanco();
});