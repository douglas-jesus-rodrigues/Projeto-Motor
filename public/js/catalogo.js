"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);

    const FALLBACK_IMAGE =
        "/imagens/sem-foto.jpg";

    const PAGE_SIZE = 9;

    let veiculos = [];
    let resultados = [];
    let limiteVisivel = PAGE_SIZE;
    let modoLista = false;
    let debounceBusca = null;

    // ==========================================
    // SEGURANÇA E UTILITÁRIOS
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

    function normalizarTexto(valor) {
        return String(valor ?? "")
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .toLowerCase()
            .trim();
    }

    function imagemSegura(valor) {
        const src =
            String(valor || "").trim();

        if (!src) {
            return FALLBACK_IMAGE;
        }

        // Imagem local absoluta.
        if (src.startsWith("/")) {
            return src;
        }

        // Cloudinary ou outro serviço HTTPS.
        if (/^https:\/\//i.test(src)) {
            return src;
        }

        /*
         * Compatibilidade com imagens antigas
         * armazenadas apenas pelo nome.
         */
        if (
            /^[\w().\-\s]+\.(jpe?g|png|webp)$/i.test(
                src
            )
        ) {
            return `/uploads/${
                encodeURIComponent(src)
                    .replace(/%2F/gi, "/")
            }`;
        }

        return FALLBACK_IMAGE;
    }

    function formatarMoeda(valor) {
        return (
            Number(valor) || 0
        ).toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL",
                maximumFractionDigits: 0
            }
        );
    }

    function formatarKm(valor) {
        return `${
            (Number(valor) || 0)
                .toLocaleString("pt-BR")
        } km`;
    }

    function lerJSON(
        storage,
        chave,
        padrao = null
    ) {
        try {
            const valor =
                storage.getItem(chave);

            return valor
                ? JSON.parse(valor)
                : padrao;
        } catch {
            return padrao;
        }
    }

    function obterUsuario() {
        for (
            const storage
            of [localStorage, sessionStorage]
        ) {
            for (
                const chave
                of ["usuario", "usuario_logado"]
            ) {
                const usuario =
                    lerJSON(storage, chave);

                if (
                    usuario
                    && typeof usuario === "object"
                ) {
                    return usuario;
                }
            }
        }

        return null;
    }

    function obterToken() {
        return (
            localStorage.getItem("token")
            || sessionStorage.getItem("token")
        );
    }

    function limparSessao() {
        for (
            const storage
            of [localStorage, sessionStorage]
        ) {
            [
                "usuario",
                "usuario_logado",
                "token"
            ].forEach((chave) => {
                storage.removeItem(chave);
            });
        }
    }

    function rotaPainel(usuario) {
        if (!usuario) {
            return "/pages/login.html";
        }

        if (usuario.tipo === "empresa") {
            return "/pages/painel-empresa.html";
        }

        if (
            [
                "admin",
                "super_admin"
            ].includes(usuario.tipo)
            || usuario.cargo === "admin"
        ) {
            return "/pages/painel-admin.html";
        }

        return "/pages/painel-cliente.html";
    }

    const usuarioAtual =
        obterUsuario();

    if ($("btnPainel")) {
        $("btnPainel").href =
            rotaPainel(usuarioAtual);
    }

    function mostrarToast(
        mensagem,
        tipo = "info"
    ) {
        const container =
            $("toastContainer");

        if (!container) return;

        const toast =
            document.createElement("div");

        toast.className =
            `toast ${tipo}`;

        toast.textContent =
            mensagem;

        container.appendChild(toast);

        window.setTimeout(() => {
            toast.remove();
        }, 4200);
    }

    function pedirLogin(mensagem) {
        mostrarToast(
            mensagem,
            "erro"
        );

        window.setTimeout(() => {
            window.location.href =
                "/pages/login.html";
        }, 1600);
    }

    // ==========================================
    // NAVEGAÇÃO
    // ==========================================

    const navLinks = [
        ...document.querySelectorAll(
            ".nav-link"
        )
    ];

    const paginas = [
        ...document.querySelectorAll(
            ".page-tab"
        )
    ];

    function ativarAba(id) {
        if (
            id === "tab-cadastrar"
            && (
                !obterUsuario()?.id
                || !obterToken()
            )
        ) {
            pedirLogin(
                "Entre na sua conta para publicar um veículo."
            );

            return;
        }

        if (!$(id)) return;

        paginas.forEach((pagina) => {
            pagina.classList.toggle(
                "active",
                pagina.id === id
            );
        });

        navLinks.forEach((link) => {
            const ativa =
                link.dataset.tab === id;

            link.classList.toggle(
                "active",
                ativa
            );

            if (ativa) {
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

        if ($("liveRegion")) {
            $("liveRegion").textContent =
                "Seção alterada.";
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    navLinks.forEach((link) => {
        link.addEventListener(
            "click",
            (evento) => {
                evento.preventDefault();

                ativarAba(
                    link.dataset.tab
                );
            }
        );
    });

    const abaUrl =
        new URLSearchParams(
            window.location.search
        ).get("tab");

    if (
        abaUrl
        && /^[a-z-]+$/i.test(abaUrl)
    ) {
        ativarAba(
            abaUrl.startsWith("tab-")
                ? abaUrl
                : `tab-${abaUrl}`
        );
    }

    // ==========================================
    // NORMALIZAÇÃO DOS VEÍCULOS
    // ==========================================

    const COMBUSTIVEIS = {
        1: "Gasolina",
        2: "Etanol",
        3: "Flex",
        4: "Diesel",
        5: "Elétrico",
        6: "Híbrido"
    };

    const CAMBIOS = {
        1: "Manual",
        2: "Automático",
        3: "Semi-automático"
    };

    function textoValido(valor) {
        const texto =
            String(valor ?? "").trim();

        return (
            texto
            && !/^\d+$/.test(texto)
        )
            ? texto
            : "";
    }

    function normalizarVeiculo(
        item,
        indice
    ) {
        const marca =
            textoValido(item.marca_nome)
            || textoValido(item.marca)
            || "Marca";

        const modelo =
            textoValido(item.modelo_nome)
            || textoValido(item.modelo)
            || "Modelo";

        const combustivel =
            textoValido(
                item.combustivel_nome
            )
            || textoValido(
                item.combustivel
            )
            || COMBUSTIVEIS[
                item.tipo_combustivel_id
            ]
            || "Não informado";

        const cambio =
            textoValido(
                item.cambio_nome
            )
            || textoValido(
                item.cambio
            )
            || textoValido(
                item.transmissao
            )
            || CAMBIOS[
                item.tipo_transmissao_id
            ]
            || "Não informado";

        return {
            id:
                Number(item.id)
                || indice + 1,

            marca,
            modelo,

            nome:
                `${marca} ${modelo}`.trim(),

            versao:
                textoValido(item.versao),

            ano:
                Number(item.ano_modelo)
                || Number(item.ano)
                || 0,

            anoFabricacao:
                Number(
                    item.ano_fabricacao
                )
                || Number(item.ano_modelo)
                || 0,

            preco:
                Number(item.preco)
                || 0,

            quilometragem:
                Number(
                    item.quilometragem
                )
                || 0,

            combustivel,
            cambio,

            carroceria:
                textoValido(
                    item.carroceria
                )
                || textoValido(
                    item.categoria
                )
                || "Outro",

            cor:
                textoValido(item.cor),

            imagem:
                imagemSegura(
                    item.imagem
                ),

            destaque:
                Boolean(
                    item.destaque_principal
                ),

            original: item
        };
    }

    // ==========================================
    // CARREGAMENTO DO CATÁLOGO
    // ==========================================

    async function carregarCatalogo() {
        const grid =
            $("carsGrid");

        if (!grid) return;

        grid.setAttribute(
            "aria-busy",
            "true"
        );

        grid.innerHTML = `
            <div class="loading-state">
                <div>
                    <i class="fa-solid fa-circle-notch fa-spin"></i>
                    Carregando oportunidades...
                </div>
            </div>
        `;

        try {
            const resposta = await fetch(
                "/api/veiculos?pagina=1&limite=50",
                {
                    headers: {
                        Accept:
                            "application/json"
                    }
                }
            );

            const dados = await resposta
                .json()
                .catch(() => ({}));

            if (
                !resposta.ok
                || dados.sucesso === false
            ) {
                throw new Error(
                    dados.mensagem
                    || `Erro HTTP ${resposta.status}`
                );
            }

            veiculos =
                Array.isArray(
                    dados.veiculos
                )
                    ? dados.veiculos.map(
                        normalizarVeiculo
                    )
                    : [];

            aplicarFiltros({
                resetarLimite: true
            });
        } catch (erro) {
            console.error(
                "Erro ao carregar catálogo:",
                erro
            );

            veiculos = [];
            resultados = [];

            renderizarResultados();

            mostrarToast(
                "Não foi possível carregar os veículos agora.",
                "erro"
            );
        } finally {
            grid.setAttribute(
                "aria-busy",
                "false"
            );
        }
    }

    // ==========================================
    // CAMPOS DOS FILTROS
    // ==========================================

    const camposFiltro = {
        busca:
            $("filtroBusca"),

        precoMin:
            $("filtroPrecoMin"),

        precoMax:
            $("filtroPrecoMax"),

        anoMin:
            $("filtroAnoMin"),

        anoMax:
            $("filtroAnoMax"),

        combustivel:
            $("filtroCombustivel"),

        cambio:
            $("filtroCambio"),

        carroceria:
            $("filtroCarroceria"),

        ordenacao:
            $("filtroOrdenacao")
    };

    function numeroCampo(campo) {
        const valor =
            String(
                campo?.value || ""
            ).trim();

        if (!valor) {
            return null;
        }

        const numero =
            Number(valor);

        return Number.isFinite(numero)
            ? numero
            : null;
    }

    function estadoFiltros() {
        return {
            busca:
                normalizarTexto(
                    camposFiltro
                        .busca
                        ?.value
                ),

            precoMin:
                numeroCampo(
                    camposFiltro.precoMin
                ),

            precoMax:
                numeroCampo(
                    camposFiltro.precoMax
                ),

            anoMin:
                numeroCampo(
                    camposFiltro.anoMin
                ),

            anoMax:
                numeroCampo(
                    camposFiltro.anoMax
                ),

            combustivel:
                normalizarTexto(
                    camposFiltro
                        .combustivel
                        ?.value
                ),

            cambio:
                normalizarTexto(
                    camposFiltro
                        .cambio
                        ?.value
                ),

            carroceria:
                normalizarTexto(
                    camposFiltro
                        .carroceria
                        ?.value
                ),

            ordenacao:
                camposFiltro
                    .ordenacao
                    ?.value
                || "recentes"
        };
    }

    // ==========================================
    // APLICAR FILTROS
    // ==========================================

    function aplicarFiltros({
        resetarLimite = false
    } = {}) {
        const filtros =
            estadoFiltros();

        if (resetarLimite) {
            limiteVisivel =
                PAGE_SIZE;
        }

        resultados =
            veiculos.filter(
                (veiculo) => {
                    const indiceBusca =
                        normalizarTexto([
                            veiculo.marca,
                            veiculo.modelo,
                            veiculo.versao,
                            veiculo.carroceria,
                            veiculo.combustivel,
                            veiculo.cambio,
                            veiculo.cor,
                            veiculo.ano
                        ].join(" "));

                    const bateBusca =
                        !filtros.busca
                        || indiceBusca.includes(
                            filtros.busca
                        );

                    const batePrecoMin =
                        filtros.precoMin
                            === null
                        || veiculo.preco
                            >= filtros.precoMin;

                    const batePrecoMax =
                        filtros.precoMax
                            === null
                        || veiculo.preco
                            <= filtros.precoMax;

                    const bateAnoMin =
                        filtros.anoMin
                            === null
                        || veiculo.ano
                            >= filtros.anoMin;

                    const bateAnoMax =
                        filtros.anoMax
                            === null
                        || veiculo.ano
                            <= filtros.anoMax;

                    const bateCombustivel =
                        !filtros.combustivel
                        || normalizarTexto(
                            veiculo.combustivel
                        )
                            === filtros
                                .combustivel;

                    const bateCambio =
                        !filtros.cambio
                        || normalizarTexto(
                            veiculo.cambio
                        ).includes(
                            filtros.cambio
                        );

                    const bateCarroceria =
                        !filtros.carroceria
                        || normalizarTexto(
                            veiculo.carroceria
                        )
                            === filtros
                                .carroceria;

                    return (
                        bateBusca
                        && batePrecoMin
                        && batePrecoMax
                        && bateAnoMin
                        && bateAnoMax
                        && bateCombustivel
                        && bateCambio
                        && bateCarroceria
                    );
                }
            );

        const ordenacoes = {
            recentes: (a, b) =>
                b.id - a.id,

            "menor-preco": (a, b) =>
                a.preco - b.preco,

            "maior-preco": (a, b) =>
                b.preco - a.preco,

            "mais-novos": (a, b) =>
                b.ano - a.ano
                || b.id - a.id,

            "menor-km": (a, b) =>
                a.quilometragem
                - b.quilometragem
        };

        resultados.sort(
            ordenacoes[
                filtros.ordenacao
            ]
            || ordenacoes.recentes
        );

        renderizarResultados();
        renderizarChips();

        renderizarDestaque(
            resultados[0]
            || veiculos[0]
        );

        renderizarOfertas();
    }

    function agendarBusca() {
        window.clearTimeout(
            debounceBusca
        );

        debounceBusca =
            window.setTimeout(
                () => {
                    aplicarFiltros({
                        resetarLimite: true
                    });
                },
                220
            );
    }

    // ==========================================
    // EVENTOS DOS FILTROS
    // ==========================================

    $("formFiltro")
        ?.addEventListener(
            "submit",
            (evento) => {
                evento.preventDefault();

                aplicarFiltros({
                    resetarLimite: true
                });

                fecharFiltrosMobile();
            }
        );

    $("formFiltro")
        ?.addEventListener(
            "reset",
            () => {
                window.setTimeout(
                    () => {
                        aplicarFiltros({
                            resetarLimite:
                                true
                        });
                    },
                    0
                );
            }
        );

    camposFiltro
        .busca
        ?.addEventListener(
            "input",
            agendarBusca
        );

    [
        camposFiltro.precoMin,
        camposFiltro.precoMax,
        camposFiltro.anoMin,
        camposFiltro.anoMax
    ].forEach((campo) => {
        campo?.addEventListener(
            "input",
            agendarBusca
        );
    });

    [
        camposFiltro.combustivel,
        camposFiltro.cambio,
        camposFiltro.carroceria,
        camposFiltro.ordenacao
    ].forEach((campo) => {
        campo?.addEventListener(
            "change",
            () => {
                aplicarFiltros({
                    resetarLimite: true
                });
            }
        );
    });

    $("btnBuscaHero")
        ?.addEventListener(
            "click",
            () => {
                aplicarFiltros({
                    resetarLimite: true
                });

                $("carsGrid")
                    ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
            }
        );

    document
        .querySelectorAll(
            "[data-busca-rapida]"
        )
        .forEach((botao) => {
            botao.addEventListener(
                "click",
                () => {
                    camposFiltro
                        .busca
                        .value =
                        botao.dataset
                            .buscaRapida
                        || "";

                    aplicarFiltros({
                        resetarLimite: true
                    });

                    $("carsGrid")
                        ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                        });
                }
            );
        });

    // ==========================================
    // CHIPS DOS FILTROS ATIVOS
    // ==========================================

    function filtrosAtivos() {
        const itens = [];

        function adicionar(
            id,
            rotulo,
            valor
        ) {
            if (
                valor !== null
                && valor !== ""
            ) {
                itens.push({
                    id,
                    rotulo,
                    valor
                });
            }
        }

        adicionar(
            "filtroBusca",
            "Busca",
            camposFiltro
                .busca
                ?.value
                .trim()
        );

        adicionar(
            "filtroPrecoMin",
            "Preço desde",
            numeroCampo(
                camposFiltro.precoMin
            ) === null
                ? ""
                : formatarMoeda(
                    numeroCampo(
                        camposFiltro
                            .precoMin
                    )
                )
        );

        adicionar(
            "filtroPrecoMax",
            "Preço até",
            numeroCampo(
                camposFiltro.precoMax
            ) === null
                ? ""
                : formatarMoeda(
                    numeroCampo(
                        camposFiltro
                            .precoMax
                    )
                )
        );

        adicionar(
            "filtroAnoMin",
            "Ano desde",
            camposFiltro
                .anoMin
                ?.value
        );

        adicionar(
            "filtroAnoMax",
            "Ano até",
            camposFiltro
                .anoMax
                ?.value
        );

        adicionar(
            "filtroCombustivel",
            "Combustível",
            camposFiltro
                .combustivel
                ?.value
        );

        adicionar(
            "filtroCambio",
            "Câmbio",
            camposFiltro
                .cambio
                ?.value
        );

        adicionar(
            "filtroCarroceria",
            "Carroceria",
            camposFiltro
                .carroceria
                ?.value
        );

        return itens;
    }

    function renderizarChips() {
        const container =
            $("chipsFiltros");

        const ativos =
            filtrosAtivos();

        if (!container) return;

        container.innerHTML =
            ativos.map((item) => `
                <span class="filter-chip">
                    ${escapeHTML(
                        item.rotulo
                    )}:
                    ${escapeHTML(
                        item.valor
                    )}

                    <button
                        type="button"
                        data-remover-filtro="${escapeHTML(
                            item.id
                        )}"
                        aria-label="Remover filtro ${escapeHTML(
                            item.rotulo
                        )}"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </span>
            `).join("");

        const badge =
            $("filterBadge");

        if (badge) {
            badge.textContent =
                String(ativos.length);

            badge.hidden =
                ativos.length === 0;
        }
    }

    $("chipsFiltros")
        ?.addEventListener(
            "click",
            (evento) => {
                const botao =
                    evento.target.closest(
                        "[data-remover-filtro]"
                    );

                if (!botao) return;

                const campo =
                    $(
                        botao.dataset
                            .removerFiltro
                    );

                if (campo) {
                    campo.value = "";
                }

                aplicarFiltros({
                    resetarLimite: true
                });
            }
        );

    // ==========================================
    // FAVORITOS
    // ==========================================

    function favoritosAtuais() {
        const favoritos =
            lerJSON(
                localStorage,
                "favoritos_veiculos",
                []
            );

        return Array.isArray(favoritos)
            ? favoritos.map(Number)
            : [];
    }

    // ==========================================
    // TEMPLATE DOS CARDS
    // ==========================================

    function templateCard(
        veiculo,
        favoritos
    ) {
        const favorito =
            favoritos.includes(
                veiculo.id
            );

        return `
            <article
                class="vehicle-card"
                data-id="${veiculo.id}"
            >
                <div class="vehicle-media">
                    <img
                        src="${escapeHTML(
                            veiculo.imagem
                        )}"
                        alt="${escapeHTML(
                            veiculo.nome
                        )}"
                        loading="lazy"
                        onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'"
                    >

                    <span class="vehicle-year">
                        ${escapeHTML(
                            veiculo.ano
                            || "Ano n/i"
                        )}
                    </span>

                    <button
                        type="button"
                        class="favorite-button ${
                            favorito
                                ? "is-favorite"
                                : ""
                        }"
                        data-favorito="${veiculo.id}"
                        aria-pressed="${favorito}"
                        aria-label="${
                            favorito
                                ? "Remover dos favoritos"
                                : "Adicionar aos favoritos"
                        }"
                    >
                        <i
                            class="${
                                favorito
                                    ? "fa-solid"
                                    : "fa-regular"
                            } fa-heart"
                        ></i>
                    </button>
                </div>

                <div class="vehicle-body">
                    <span class="vehicle-category">
                        ${escapeHTML(
                            veiculo.carroceria
                        )}
                    </span>

                    <h3>
                        ${escapeHTML(
                            veiculo.nome
                        )}
                    </h3>

                    <p class="vehicle-version">
                        ${escapeHTML(
                            veiculo.versao
                            || "Versão não informada"
                        )}
                    </p>

                    <div class="vehicle-specs">
                        <span>
                            <i class="fa-solid fa-road"></i>
                            ${escapeHTML(
                                formatarKm(
                                    veiculo
                                        .quilometragem
                                )
                            )}
                        </span>

                        <span>
                            <i class="fa-solid fa-gas-pump"></i>
                            ${escapeHTML(
                                veiculo.combustivel
                            )}
                        </span>

                        <span>
                            <i class="fa-solid fa-gears"></i>
                            ${escapeHTML(
                                veiculo.cambio
                            )}
                        </span>
                    </div>

                    <div class="vehicle-footer">
                        <div class="vehicle-price">
                            <small>
                                A partir de
                            </small>

                            <strong>
                                ${formatarMoeda(
                                    veiculo.preco
                                )}
                            </strong>
                        </div>

                        <a
                            class="details-link"
                            href="/pages/detalhes-veiculo.html?id=${
                                encodeURIComponent(
                                    veiculo.id
                                )
                            }"
                            aria-label="Ver detalhes de ${escapeHTML(
                                veiculo.nome
                            )}"
                        >
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                    </div>
                </div>
            </article>
        `;
    }

    // ==========================================
    // RENDERIZAR RESULTADOS
    // ==========================================

    function renderizarResultados() {
        const grid =
            $("carsGrid");

        if (!grid) return;

        const quantidade =
            resultados.length;

        if ($("resultCount")) {
            $("resultCount").textContent =
                `${quantidade} veículo${
                    quantidade === 1
                        ? ""
                        : "s"
                } encontrado${
                    quantidade === 1
                        ? ""
                        : "s"
                }`;
        }

        if ($("searchContext")) {
            $("searchContext").textContent =
                quantidade
                    ? "Compare e encontre sua melhor opção"
                    : "Tente alterar ou remover algum filtro";
        }

        grid.classList.toggle(
            "list-view",
            modoLista
        );

        if (!quantidade) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div>
                        <i class="fa-solid fa-car-side"></i>

                        <h3>
                            Nenhum veículo por aqui
                        </h3>

                        <p>
                            Altere os filtros para encontrar
                            outras oportunidades.
                        </p>

                        <button
                            type="button"
                            class="btn-ghost"
                            data-limpar-tudo
                        >
                            Limpar filtros
                        </button>
                    </div>
                </div>
            `;

            if ($("btnMostrarMais")) {
                $("btnMostrarMais").hidden =
                    true;
            }

            return;
        }

        const favoritos =
            obterUsuario()?.id
                ? favoritosAtuais()
                : [];

        grid.innerHTML =
            resultados
                .slice(0, limiteVisivel)
                .map((veiculo) => {
                    return templateCard(
                        veiculo,
                        favoritos
                    );
                })
                .join("");

        if ($("btnMostrarMais")) {
            $("btnMostrarMais").hidden =
                limiteVisivel
                >= resultados.length;
        }
    }

    $("carsGrid")
        ?.addEventListener(
            "click",
            (evento) => {
                if (
                    evento.target.closest(
                        "[data-limpar-tudo]"
                    )
                ) {
                    $("formFiltro")
                        ?.reset();

                    if (
                        camposFiltro.busca
                    ) {
                        camposFiltro
                            .busca
                            .value = "";
                    }

                    aplicarFiltros({
                        resetarLimite: true
                    });

                    return;
                }

                const botao =
                    evento.target.closest(
                        "[data-favorito]"
                    );

                if (!botao) return;

                if (!obterUsuario()?.id) {
                    pedirLogin(
                        "Entre na sua conta para favoritar veículos."
                    );

                    return;
                }

                const id =
                    Number(
                        botao.dataset
                            .favorito
                    );

                let favoritos =
                    favoritosAtuais();

                const remover =
                    favoritos.includes(id);

                favoritos =
                    remover
                        ? favoritos.filter(
                            (item) => {
                                return item
                                    !== id;
                            }
                        )
                        : [
                            ...favoritos,
                            id
                        ];

                localStorage.setItem(
                    "favoritos_veiculos",
                    JSON.stringify(
                        favoritos
                    )
                );

                botao.classList.toggle(
                    "is-favorite",
                    !remover
                );

                botao.setAttribute(
                    "aria-pressed",
                    String(!remover)
                );

                botao.setAttribute(
                    "aria-label",
                    remover
                        ? "Adicionar aos favoritos"
                        : "Remover dos favoritos"
                );

                const icone =
                    botao.querySelector("i");

                if (icone) {
                    icone.className =
                        `${
                            remover
                                ? "fa-regular"
                                : "fa-solid"
                        } fa-heart`;
                }
            }
        );

    $("btnMostrarMais")
        ?.addEventListener(
            "click",
            () => {
                limiteVisivel +=
                    PAGE_SIZE;

                renderizarResultados();
            }
        );

    // ==========================================
    // DESTAQUE
    // ==========================================

    function renderizarDestaque(
        veiculo
    ) {
        const container =
            $("featuredCar");

        if (!container) return;

        if (!veiculo) {
            container.innerHTML = `
                <div class="featured-placeholder">
                    Nenhum destaque disponível.
                </div>
            `;

            container.onclick = null;
            container.style.cursor =
                "default";

            return;
        }

        container.innerHTML = `
            <img
                src="${escapeHTML(
                    veiculo.imagem
                )}"
                alt="${escapeHTML(
                    veiculo.nome
                )}"
                onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'"
            >

            <div class="featured-info">
                <div>
                    <span class="featured-kicker">
                        ${escapeHTML(
                            veiculo.ano
                        )}
                        ·
                        ${escapeHTML(
                            veiculo.carroceria
                        )}
                    </span>

                    <strong class="featured-name">
                        ${escapeHTML(
                            veiculo.nome
                        )}
                    </strong>
                </div>

                <span class="price">
                    ${formatarMoeda(
                        veiculo.preco
                    )}
                </span>
            </div>
        `;

        container.onclick = () => {
            window.location.href =
                `/pages/detalhes-veiculo.html?id=${
                    encodeURIComponent(
                        veiculo.id
                    )
                }`;
        };

        container.style.cursor =
            "pointer";
    }

    // ==========================================
    // OFERTAS
    // ==========================================

    function renderizarOfertas() {
        const container =
            $("topDeals");

        if (!container) return;

        const ofertas = [
            ...veiculos
        ]
            .filter((item) => {
                return item.preco > 0;
            })
            .sort((a, b) => {
                return a.preco
                    - b.preco;
            })
            .slice(0, 4);

        if (!ofertas.length) {
            container.innerHTML = "";
            return;
        }

        container.innerHTML =
            ofertas.map((item) => `
                <a
                    class="deal-item"
                    href="/pages/detalhes-veiculo.html?id=${
                        encodeURIComponent(
                            item.id
                        )
                    }"
                >
                    <img
                        src="${escapeHTML(
                            item.imagem
                        )}"
                        alt="${escapeHTML(
                            item.nome
                        )}"
                        loading="lazy"
                        onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'"
                    >

                    <div>
                        <div class="deal-title">
                            ${escapeHTML(
                                item.nome
                            )}
                        </div>

                        <div class="deal-meta">
                            ${escapeHTML(
                                item.ano
                            )}
                            ·
                            ${escapeHTML(
                                item.carroceria
                            )}
                        </div>

                        <div class="deal-price">
                            ${formatarMoeda(
                                item.preco
                            )}
                        </div>
                    </div>
                </a>
            `).join("");
    }

    // ==========================================
    // VISUALIZAÇÃO GRADE / LISTA
    // ==========================================

    $("btnGrade")
        ?.addEventListener(
            "click",
            () => {
                alterarVisualizacao(
                    false
                );
            }
        );

    $("btnLista")
        ?.addEventListener(
            "click",
            () => {
                alterarVisualizacao(
                    true
                );
            }
        );

    function alterarVisualizacao(
        lista
    ) {
        modoLista = lista;

        $("btnGrade")
            ?.classList.toggle(
                "active",
                !lista
            );

        $("btnLista")
            ?.classList.toggle(
                "active",
                lista
            );

        $("btnGrade")
            ?.setAttribute(
                "aria-pressed",
                String(!lista)
            );

        $("btnLista")
            ?.setAttribute(
                "aria-pressed",
                String(lista)
            );

        renderizarResultados();
    }

    // ==========================================
    // FILTROS NO CELULAR
    // ==========================================

    function abrirFiltrosMobile() {
        $("painelFiltros")
            ?.classList.add("open");

        if ($("filterOverlay")) {
            $("filterOverlay").hidden =
                false;
        }

        $("btnAbrirFiltros")
            ?.setAttribute(
                "aria-expanded",
                "true"
            );

        document.body
            .classList.add(
                "filters-open"
            );
    }

    function fecharFiltrosMobile() {
        $("painelFiltros")
            ?.classList.remove("open");

        if ($("filterOverlay")) {
            $("filterOverlay").hidden =
                true;
        }

        $("btnAbrirFiltros")
            ?.setAttribute(
                "aria-expanded",
                "false"
            );

        document.body
            .classList.remove(
                "filters-open"
            );
    }

    $("btnAbrirFiltros")
        ?.addEventListener(
            "click",
            abrirFiltrosMobile
        );

    $("btnFecharFiltros")
        ?.addEventListener(
            "click",
            fecharFiltrosMobile
        );

    $("filterOverlay")
        ?.addEventListener(
            "click",
            fecharFiltrosMobile
        );

    // ==========================================
    // IMAGEM DO ANÚNCIO
    // ==========================================

    const inputImagem =
        $("imagem");

    let previewObjectUrl = null;

    function limparImagem() {
        if (previewObjectUrl) {
            URL.revokeObjectURL(
                previewObjectUrl
            );
        }

        previewObjectUrl = null;

        if (inputImagem) {
            inputImagem.value = "";
        }

        if ($("nomeArquivoSelecionado")) {
            $("nomeArquivoSelecionado")
                .textContent =
                "Selecionar imagem";
        }

        if ($("miniaturaPreview")) {
            $("miniaturaPreview").src =
                "";

            $("miniaturaPreview").hidden =
                true;
        }

        if ($("imgPreviewModal")) {
            $("imgPreviewModal").src =
                "";
        }

        if ($("btnVerFoto")) {
            $("btnVerFoto").disabled =
                true;
        }

        if ($("erroImagem")) {
            $("erroImagem").textContent =
                "";
        }
    }

    inputImagem
        ?.addEventListener(
            "change",
            () => {
                const arquivo =
                    inputImagem
                        .files?.[0];

                if (!arquivo) {
                    limparImagem();
                    return;
                }

                if (
                    ![
                        "image/jpeg",
                        "image/png",
                        "image/webp"
                    ].includes(
                        arquivo.type
                    )
                ) {
                    limparImagem();

                    $("erroImagem")
                        .textContent =
                        "Use uma imagem JPG, PNG ou WebP.";

                    return;
                }

                if (
                    arquivo.size
                    > 5 * 1024 * 1024
                ) {
                    limparImagem();

                    $("erroImagem")
                        .textContent =
                        "A imagem deve ter no máximo 5 MB.";

                    return;
                }

                if (previewObjectUrl) {
                    URL.revokeObjectURL(
                        previewObjectUrl
                    );
                }

                previewObjectUrl =
                    URL.createObjectURL(
                        arquivo
                    );

                $("nomeArquivoSelecionado")
                    .textContent =
                    arquivo.name.slice(
                        0,
                        42
                    );

                $("miniaturaPreview").src =
                    previewObjectUrl;

                $("miniaturaPreview").hidden =
                    false;

                $("imgPreviewModal").src =
                    previewObjectUrl;

                $("btnVerFoto").disabled =
                    false;

                $("erroImagem").textContent =
                    "";
            }
        );

    $("btnVerFoto")
        ?.addEventListener(
            "click",
            () => {
                if (
                    !$("imgPreviewModal")
                        ?.src
                ) {
                    return;
                }

                $("modalVisualizarFoto")
                    .hidden = false;

                $("btnFecharModal")
                    ?.focus();
            }
        );

    function fecharModal() {
        if (
            $("modalVisualizarFoto")
        ) {
            $("modalVisualizarFoto")
                .hidden = true;
        }
    }

    $("btnFecharModal")
        ?.addEventListener(
            "click",
            fecharModal
        );

    $("modalVisualizarFoto")
        ?.addEventListener(
            "click",
            (evento) => {
                if (
                    evento.target
                    === $("modalVisualizarFoto")
                ) {
                    fecharModal();
                }
            }
        );

    document.addEventListener(
        "keydown",
        (evento) => {
            if (
                evento.key
                === "Escape"
            ) {
                fecharModal();
                fecharFiltrosMobile();
            }
        }
    );

    // ==========================================
    // MÁSCARA DO PREÇO
    // ==========================================

    const precoInput =
        $("preco");

    precoInput
        ?.addEventListener(
            "input",
            () => {
                const digitos =
                    precoInput.value
                        .replace(/\D/g, "")
                        .slice(0, 8);

                precoInput.value =
                    digitos
                        ? Number(
                            digitos
                        ).toLocaleString(
                            "pt-BR"
                        )
                        : "";
            }
        );

    function definirErro(
        campo,
        erroId,
        mensagem
    ) {
        const elementoErro =
            $(erroId);

        if (elementoErro) {
            elementoErro.textContent =
                mensagem;
        }

        campo?.setAttribute(
            "aria-invalid",
            mensagem
                ? "true"
                : "false"
        );
    }

    // ==========================================
    // CADASTRAR VEÍCULO
    // ==========================================

    $("formAnuncio")
        ?.addEventListener(
            "submit",
            async (evento) => {
                evento.preventDefault();

                const usuario =
                    obterUsuario();

                const token =
                    obterToken();

                if (
                    !usuario?.id
                    || !token
                ) {
                    pedirLogin(
                        "Entre na sua conta para publicar um veículo."
                    );

                    return;
                }

                const marca =
                    $("marca");

                const modelo =
                    $("modelo");

                const anoFab =
                    $("anoFabricacao");

                const anoModelo =
                    $("anoModelo");

                const preco =
                    Number(
                        precoInput.value
                            .replace(
                                /\D/g,
                                ""
                            )
                    );

                const anoAtual =
                    new Date()
                        .getFullYear()
                    + 1;

                let valido = true;

                definirErro(
                    marca,
                    "erroMarca",
                    marca.value.trim()
                        ? ""
                        : "Digite a marca."
                );

                definirErro(
                    modelo,
                    "erroModelo",
                    modelo.value.trim()
                        ? ""
                        : "Digite o modelo."
                );

                definirErro(
                    anoFab,
                    "erroAnoFabricacao",
                    Number(
                        anoFab.value
                    ) >= 1950
                    && Number(
                        anoFab.value
                    ) <= anoAtual
                        ? ""
                        : `Use um ano entre 1950 e ${anoAtual}.`
                );

                definirErro(
                    anoModelo,
                    "erroAnoModelo",
                    Number(
                        anoModelo.value
                    ) >= 1950
                    && Number(
                        anoModelo.value
                    ) <= anoAtual
                        ? ""
                        : `Use um ano entre 1950 e ${anoAtual}.`
                );

                definirErro(
                    precoInput,
                    "erroPreco",
                    preco > 0
                    && preco <= 10000000
                        ? ""
                        : "Informe um preço válido de até R$ 10 milhões."
                );

                [
                    "erroMarca",
                    "erroModelo",
                    "erroAnoFabricacao",
                    "erroAnoModelo",
                    "erroPreco"
                ].forEach((id) => {
                    if (
                        $(id)?.textContent
                    ) {
                        valido = false;
                    }
                });

                if (!valido) {
                    mostrarToast(
                        "Revise os campos destacados.",
                        "erro"
                    );

                    return;
                }

                const formData =
                    new FormData();

                const valores = {
                    marca:
                        marca.value.trim(),

                    modelo:
                        modelo.value.trim(),

                    versao:
                        $("versao")
                            .value
                            .trim(),

                    preco,

                    ano_fabricacao:
                        Number(
                            anoFab.value
                        ),

                    ano_modelo:
                        Number(
                            anoModelo.value
                        ),

                    quilometragem:
                        Number(
                            $("quilometragem")
                                .value
                        ) || 0,

                    combustivel:
                        $("combustivel")
                            .value,

                    cambio:
                        $("cambio")
                            .value,

                    cor:
                        $("cor")
                            .value
                            .trim(),

                    portas:
                        Number(
                            $("portas")
                                .value
                        ) || 2,

                    carroceria:
                        $("carroceria")
                            .value,

                    descricao:
                        $("descricao")
                            .value
                            .trim()
                };

                Object.entries(
                    valores
                ).forEach(
                    ([chave, valor]) => {
                        formData.append(
                            chave,
                            String(valor)
                        );
                    }
                );

                if (
                    inputImagem
                        ?.files?.[0]
                ) {
                    formData.append(
                        "imagem",
                        inputImagem
                            .files[0]
                    );
                }

                const botao =
                    $("btnAnunciar");

                botao.disabled = true;
                botao.textContent =
                    "Publicando...";

                try {
                    const resposta =
                        await fetch(
                            "/api/veiculos",
                            {
                                method: "POST",

                                headers: {
                                    Authorization:
                                        `Bearer ${token}`
                                },

                                body:
                                    formData
                            }
                        );

                    const dados =
                        await resposta
                            .json()
                            .catch(
                                () => ({})
                            );

                    if (
                        resposta.status
                        === 401
                    ) {
                        limparSessao();

                        pedirLogin(
                            "Sua sessão expirou. Entre novamente."
                        );

                        return;
                    }

                    if (
                        !resposta.ok
                        || dados.sucesso
                            === false
                    ) {
                        throw new Error(
                            dados.mensagem
                            || dados.erro
                            || "Não foi possível publicar."
                        );
                    }

                    mostrarToast(
                        dados.mensagem
                        || "Veículo publicado com sucesso!",
                        "sucesso"
                    );

                    $("formAnuncio")
                        .reset();

                    limparImagem();

                    await carregarCatalogo();

                    ativarAba(
                        "tab-catalogo"
                    );
                } catch (erro) {
                    console.error(erro);

                    mostrarToast(
                        erro.message
                        || "Erro ao publicar o anúncio.",
                        "erro"
                    );
                } finally {
                    botao.disabled = false;

                    botao.textContent =
                        "Publicar anúncio";
                }
            }
        );

    // ==========================================
    // AVALIAÇÃO
    // ==========================================

    $("avaPlaca")
        ?.addEventListener(
            "input",
            () => {
                $("avaPlaca").value =
                    $("avaPlaca")
                        .value
                        .toUpperCase()
                        .replace(
                            /[^A-Z0-9]/g,
                            ""
                        )
                        .slice(0, 7);
            }
        );

    $("avaTelefone")
        ?.addEventListener(
            "input",
            () => {
                const numeros =
                    $("avaTelefone")
                        .value
                        .replace(
                            /\D/g,
                            ""
                        )
                        .slice(0, 11);

                $("avaTelefone").value =
                    numeros.length > 6
                        ? `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`
                        : numeros.length > 2
                            ? `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`
                            : numeros;
            }
        );

    $("formAvaliacao")
        ?.addEventListener(
            "submit",
            (evento) => {
                evento.preventDefault();

                const nome =
                    $("avaNome");

                const telefone =
                    $("avaTelefone");

                const placa =
                    $("avaPlaca");

                const km =
                    $("avaKm");

                definirErro(
                    nome,
                    "erroAvaNome",
                    nome.value
                        .trim()
                        .length >= 3
                        ? ""
                        : "Digite seu nome completo."
                );

                definirErro(
                    telefone,
                    "erroAvaTelefone",
                    telefone.value
                        .replace(
                            /\D/g,
                            ""
                        )
                        .length >= 10
                        ? ""
                        : "Informe um telefone com DDD."
                );

                definirErro(
                    placa,
                    "erroAvaPlaca",
                    /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
                        .test(
                            placa.value
                        )
                        ? ""
                        : "Informe uma placa válida."
                );

                definirErro(
                    km,
                    "erroAvaKm",
                    km.value !== ""
                    && Number(
                        km.value
                    ) >= 0
                        ? ""
                        : "Informe a quilometragem."
                );

                const idsErros = [
                    "erroAvaNome",
                    "erroAvaTelefone",
                    "erroAvaPlaca",
                    "erroAvaKm"
                ];

                if (
                    idsErros.some(
                        (id) => {
                            return Boolean(
                                $(id)
                                    ?.textContent
                            );
                        }
                    )
                ) {
                    mostrarToast(
                        "Revise os dados da avaliação.",
                        "erro"
                    );

                    return;
                }

                mostrarToast(
                    "Solicitação enviada! Entraremos em contato em breve.",
                    "sucesso"
                );

                evento
                    .currentTarget
                    .reset();
            }
        );

    // ==========================================
    // FINANCIAMENTO
    // ==========================================

    const TAXAS = {
        excelente: 0.0129,
        bom: 0.0159,
        regular: 0.0199
    };

    $("btnSimular")
        ?.addEventListener(
            "click",
            () => {
                const valor =
                    Number(
                        $("finValor")
                            .value
                    );

                const entrada =
                    Number(
                        $("finEntrada")
                            .value
                    ) || 0;

                const parcelas =
                    Number(
                        $("finParcelas")
                            .value
                    );

                const taxa =
                    TAXAS[
                        $("finScore")
                            .value
                    ]
                    || TAXAS.bom;

                const erro =
                    $("erroFinanciamento");

                const resultado =
                    $("resultadoSimulacao");

                erro.textContent = "";

                if (
                    !valor
                    || valor <= 0
                ) {
                    erro.textContent =
                        "Informe o valor do veículo.";

                    resultado.hidden =
                        true;

                    return;
                }

                if (
                    entrada < 0
                    || entrada >= valor
                ) {
                    erro.textContent =
                        "A entrada deve ser menor que o valor do veículo.";

                    resultado.hidden =
                        true;

                    return;
                }

                const financiado =
                    valor - entrada;

                const parcela =
                    (
                        financiado
                        * taxa
                    )
                    / (
                        1
                        - Math.pow(
                            1 + taxa,
                            -parcelas
                        )
                    );

                const total =
                    parcela
                    * parcelas
                    + entrada;

                $("resFinanciado")
                    .textContent =
                    formatarMoeda(
                        financiado
                    );

                $("resParcela")
                    .textContent =
                    `${
                        formatarMoeda(
                            parcela
                        )
                    } /mês`;

                $("resTotal")
                    .textContent =
                    formatarMoeda(
                        total
                    );

                $("resTaxa")
                    .textContent =
                    `${
                        (taxa * 100)
                            .toFixed(2)
                            .replace(
                                ".",
                                ","
                            )
                    }% a.m.`;

                resultado.hidden =
                    false;
            }
        );

    // ==========================================
    // SINCRONIZAR FAVORITOS ENTRE ABAS
    // ==========================================

    window.addEventListener(
        "storage",
        (evento) => {
            if (
                evento.key
                === "favoritos_veiculos"
            ) {
                renderizarResultados();
            }
        }
    );

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================

    carregarCatalogo();
});