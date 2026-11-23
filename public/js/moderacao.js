(() => {
    "use strict";

    const API =
        "/api/moderacao/denuncias";

    const LOGIN =
        "/pages/login.html";

    const LIMITE = 9;
    const TIMEOUT = 15000;

    const $ = (id) =>
        document.getElementById(id);

    const formatarNumero =
        new Intl.NumberFormat("pt-BR");

    const formatarData =
        new Intl.DateTimeFormat(
            "pt-BR",
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );

    const estado = {
        pagina: 1,
        totalPaginas: 1,
        total: 0,
        busca: "",
        motivo: "",
        ordem: "mais_antigas",
        carregando: false,
        controle: null,
        denuncia: null,
        acao: null
    };

    function escapar(valor) {
        const caracteres = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return String(valor ?? "")
            .replace(
                /[&<>"']/g,
                (caractere) =>
                    caracteres[caractere]
            );
    }

    function normalizar(valor) {
        return String(valor ?? "")
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .toLowerCase()
            .trim();
    }

    function lerUsuario() {
        const armazenamentos = [
            localStorage,
            sessionStorage
        ];

        const chaves = [
            "usuario",
            "usuario_logado"
        ];

        for (
            const armazenamento
            of armazenamentos
        ) {
            for (const chave of chaves) {
                const bruto =
                    armazenamento.getItem(
                        chave
                    );

                if (
                    !bruto ||
                    bruto === "undefined" ||
                    bruto === "null"
                ) {
                    continue;
                }

                try {
                    const objeto =
                        JSON.parse(bruto);

                    const usuario =
                        objeto?.usuario ||
                        objeto?.user ||
                        objeto?.dados?.usuario ||
                        objeto?.data?.usuario ||
                        objeto;

                    if (
                        usuario &&
                        typeof usuario ===
                            "object"
                    ) {
                        return usuario;
                    }
                } catch {
                    // Continua procurando.
                }
            }
        }

        return null;
    }

    function ehAdmin(usuario) {
        const permitidos = [
            "admin",
            "super_admin",
            "superadmin"
        ];

        return (
            permitidos.includes(
                normalizar(usuario?.tipo)
            ) ||
            permitidos.includes(
                normalizar(usuario?.cargo)
            )
        );
    }

    function token() {
        return (
            localStorage.getItem("token") ||
            sessionStorage.getItem("token") ||
            ""
        );
    }

    function limparSessao() {
        const chaves = [
            "usuario",
            "usuario_logado",
            "token"
        ];

        chaves.forEach((chave) => {
            localStorage.removeItem(chave);
            sessionStorage.removeItem(chave);
        });
    }

    function fotoValida(valor) {
        if (
            typeof valor !== "string" ||
            !valor.trim()
        ) {
            return null;
        }

        const origem = valor
            .trim()
            .replace(/\\/g, "/");

        if (
            /^(https?:\/\/|data:image\/|blob:|\/)/i
                .test(origem)
        ) {
            return origem;
        }

        if (
            origem.startsWith(
                "uploads/"
            )
        ) {
            return `/${origem}`;
        }

        const caminho = origem
            .split("/")
            .map(encodeURIComponent)
            .join("/");

        return `/uploads/${caminho}`;
    }

    function urlImagem(item) {
        const imagem =
            item.imagem ||
            item.imagem_principal ||
            item.imagem_url ||
            item.foto ||
            item.veiculo?.imagem;

        return (
            fotoValida(imagem) ||
            "/imagens/sem-foto.jpg"
        );
    }

    function textoMotivo(valor) {
        const chave = normalizar(valor)
            .replace(/\s+/g, "_");

        const rotulos = {
            fraude:
                "Possível fraude",

            conteudo_inadequado:
                "Conteúdo inadequado",

            informacao_falsa:
                "Informação incorreta",

            duplicado:
                "Anúncio duplicado",

            outro:
                "Outro motivo"
        };

        return (
            rotulos[chave] ||
            valor ||
            "Motivo não informado"
        );
    }

    function nomeVeiculo(item) {
        const marca =
            item.marca_nome ||
            item.marca ||
            item.veiculo?.marca;

        const modelo =
            item.modelo_nome ||
            item.modelo ||
            item.veiculo?.modelo;

        return (
            [marca, modelo]
                .filter(Boolean)
                .join(" ") ||
            "Veículo"
        );
    }

    function dataSegura(valor) {
        const data = new Date(valor);

        if (
            Number.isNaN(
                data.getTime()
            )
        ) {
            return "Data não informada";
        }

        return formatarData.format(data);
    }

    function toast(
        mensagem,
        tipo = "ok"
    ) {
        const area = $("toastArea");

        if (!area) {
            return;
        }

        while (
            area.children.length >= 3
        ) {
            area.firstElementChild.remove();
        }

        const elemento =
            document.createElement("div");

        elemento.className =
            `toast${
                tipo === "ok"
                    ? ""
                    : ` ${tipo}`
            }`;

        elemento.textContent =
            mensagem;

        area.appendChild(elemento);

        requestAnimationFrame(() => {
            elemento.classList.add("on");
        });

        setTimeout(() => {
            elemento.classList.remove(
                "on"
            );

            setTimeout(() => {
                elemento.remove();
            }, 250);
        }, 3200);
    }

    function abrirModal(modal) {
        if (!modal) {
            return;
        }

        modal._focoAnterior =
            document.activeElement;

        modal.hidden = false;

        document.body.classList.add(
            "travado"
        );
    }

    function fecharModal(modal) {
        if (!modal) {
            return;
        }

        modal.hidden = true;

        document.body.classList.remove(
            "travado"
        );

        modal._focoAnterior?.focus?.();
    }

    function configurarCabecalho(
        usuario
    ) {
        const nome =
            [
                usuario.nome,
                usuario.sobrenome
            ]
                .filter(Boolean)
                .join(" ") ||
            "Administrador";

        const primeiroNome =
            nome.split(/\s+/)[0];

        $("miniNome").textContent =
            primeiroNome;

        $("ddNome").textContent =
            nome;

        $("ddEmail").textContent =
            usuario.email || "";

        const avatar =
            $("avatarMini");

        avatar.textContent =
            primeiroNome
                .charAt(0)
                .toUpperCase();

        const foto = fotoValida(
            usuario.foto_perfil ||
            usuario.foto_url ||
            usuario.fotoUrl
        );

        if (foto) {
            const imagem =
                new Image();

            imagem.alt = "";

            imagem.addEventListener(
                "load",
                () => {
                    avatar.textContent = "";
                    avatar.appendChild(
                        imagem
                    );
                },
                {
                    once: true
                }
            );

            imagem.src = foto;
        }

        const botao =
            $("btnConfig");

        const menu =
            $("menuConfig");

        const alternar = (abrir) => {
            const aberto =
                abrir ??
                !menu.classList.contains(
                    "mostrar"
                );

            menu.classList.toggle(
                "mostrar",
                aberto
            );

            botao.setAttribute(
                "aria-expanded",
                String(aberto)
            );
        };

        botao.addEventListener(
            "click",
            (evento) => {
                evento.stopPropagation();
                alternar();
            }
        );

        document.addEventListener(
            "click",
            (evento) => {
                if (
                    !menu.contains(
                        evento.target
                    ) &&
                    !botao.contains(
                        evento.target
                    )
                ) {
                    alternar(false);
                }
            }
        );

        $("gatilhoSair")
            .addEventListener(
                "click",
                () => {
                    alternar(false);

                    abrirModal(
                        $("modalSair")
                    );
                }
            );
    }

    function configurarTema() {
        const aplicar = (tema) => {
            document
                .documentElement
                .dataset
                .tema = tema;

            localStorage.setItem(
                "mf_admin_tema",
                tema
            );

            document
                .querySelector(
                    'meta[name="theme-color"]'
                )
                ?.setAttribute(
                    "content",
                    tema === "claro"
                        ? "#f3f5f8"
                        : "#08080b"
                );
        };

        aplicar(
            document
                .documentElement
                .dataset
                .tema === "claro"
                ? "claro"
                : "escuro"
        );

        $("btnTema").addEventListener(
            "click",
            () => {
                aplicar(
                    document
                        .documentElement
                        .dataset
                        .tema === "claro"
                        ? "escuro"
                        : "claro"
                );
            }
        );
    }

    function cabecalhos() {
        const headers = {
            Accept: "application/json"
        };

        const jwt = token();

        if (jwt) {
            headers.Authorization =
                `Bearer ${jwt}`;
        }

        return headers;
    }

    async function requisitar(
        url,
        opcoes = {}
    ) {
        const controle =
            new AbortController();

        const limite = setTimeout(
            () => controle.abort(),
            TIMEOUT
        );

        try {
            const resposta = await fetch(
                url,
                {
                    credentials:
                        "same-origin",

                    cache:
                        "no-store",

                    ...opcoes,

                    headers: {
                        ...cabecalhos(),
                        ...(opcoes.headers || {})
                    },

                    signal:
                        opcoes.signal ||
                        controle.signal
                }
            );

            let corpo = null;

            try {
                corpo =
                    await resposta.json();
            } catch {
                // Resposta sem JSON.
            }

            if (
                !resposta.ok ||
                corpo?.sucesso === false
            ) {
                const erro =
                    new Error(
                        corpo?.mensagem ||
                        corpo?.erro ||
                        `Falha HTTP ${resposta.status}.`
                    );

                erro.status =
                    resposta.status;

                throw erro;
            }

            return corpo || {};
        } catch (erro) {
            if (
                erro.name ===
                "AbortError"
            ) {
                throw new Error(
                    "O servidor demorou para responder."
                );
            }

            throw erro;
        } finally {
            clearTimeout(limite);
        }
    }

    function skeleton() {
        $("listaDenuncias").innerHTML =
            Array.from(
                {
                    length: 6
                },
                () => (
                    '<div class="skeleton-card" ' +
                    'aria-hidden="true"></div>'
                )
            ).join("");

        $("listaDenuncias")
            .setAttribute(
                "aria-busy",
                "true"
            );
    }

    function atualizarMetricas(
        resumo = {}
    ) {
        const pendentes = Number(
            resumo.pendentes ??
            estado.total
        ) || 0;

        const resolvidasHoje = Number(
            resumo.resolvidas_hoje
        ) || 0;

        const mantidos = Number(
            resumo.mantidos
        ) || 0;

        const removidos = Number(
            resumo.removidos ??
            resumo.restringidos
        ) || 0;

        $("totalPendentes").textContent =
            formatarNumero.format(
                pendentes
            );

        $("totalResolvidasHoje").textContent =
            formatarNumero.format(
                resolvidasHoje
            );

        $("totalMantidos").textContent =
            formatarNumero.format(
                mantidos
            );

        $("totalRemovidos").textContent =
            formatarNumero.format(
                removidos
            );
    }

        function renderizarCards(lista) {
        const container =
            $("listaDenuncias");

        container.setAttribute(
            "aria-busy",
            "false"
        );

        if (!lista.length) {
            container.innerHTML = `
                <div class="vazio">
                    <div>
                        <i class="fa-solid fa-shield-circle-check"></i>

                        <h3>
                            Nenhuma denúncia encontrada
                        </h3>

                        <p>
                            A fila está limpa ou nenhum
                            registro corresponde aos filtros.
                        </p>
                    </div>
                </div>
            `;

            return;
        }

        container.innerHTML = lista
            .map((item) => {
                const denunciaId =
                    item.denuncia_id ||
                    item.id;

                const veiculoId =
                    item.veiculo_id ||
                    item.veiculo?.id ||
                    item.anuncio_id;

                const titulo =
                    nomeVeiculo(item);

                const motivo =
                    textoMotivo(
                        item.motivo ||
                        item.categoria
                    );

                const descricao =
                    item.descricao ||
                    item.detalhes ||
                    item.mensagem ||
                    motivo;

                const ano =
                    item.ano_modelo ||
                    item.ano_fabricacao ||
                    item.veiculo?.ano;

                const preco =
                    Number(
                        item.preco ||
                        item.veiculo?.preco
                    );

                const precoTexto =
                    Number.isFinite(preco)
                        ? preco.toLocaleString(
                            "pt-BR",
                            {
                                style:
                                    "currency",

                                currency:
                                    "BRL",

                                maximumFractionDigits:
                                    0
                            }
                        )
                        : "Preço não informado";

                return `
                    <article
                        class="card-denuncia"
                        data-denuncia-id="${escapar(denunciaId)}"
                    >
                        <div class="card-imagem">
                            <img
                                src="${escapar(urlImagem(item))}"
                                alt="Imagem do anúncio ${escapar(titulo)}"
                                loading="lazy"
                                data-fallback
                            >

                            <span class="status-denuncia">
                                <i class="fa-solid fa-clock"></i>
                                Pendente
                            </span>
                        </div>

                        <div class="card-corpo">
                            <div class="card-topo">
                                <span class="codigo">
                                    Denúncia #${escapar(denunciaId)}
                                </span>

                                <time class="data-denuncia">
                                    ${escapar(
                                        dataSegura(
                                            item.criado_em ||
                                            item.denunciado_em
                                        )
                                    )}
                                </time>
                            </div>

                            <h3 title="${escapar(titulo)}">
                                ${escapar(titulo)}
                            </h3>

                            <div class="veiculo-meta">
                                <span>
                                    ${escapar(
                                        ano ||
                                        "Ano não informado"
                                    )}
                                </span>

                                <span>•</span>

                                <span>
                                    ${escapar(precoTexto)}
                                </span>
                            </div>

                            <div class="motivo-box">
                                <small>
                                    ${escapar(motivo)}
                                </small>

                                <p>
                                    ${escapar(descricao)}
                                </p>
                            </div>
                        </div>

                        <div class="card-rodape">
                            <button
                                type="button"
                                class="btn-decisao btn-manter"
                                data-acao="manter"
                                data-id="${escapar(denunciaId)}"
                                data-veiculo-id="${escapar(veiculoId || "")}"
                            >
                                <i class="fa-solid fa-check"></i>
                                Manter
                            </button>

                            <button
                                type="button"
                                class="btn-decisao btn-restringir"
                                data-acao="restringir"
                                data-id="${escapar(denunciaId)}"
                                data-veiculo-id="${escapar(veiculoId || "")}"
                            >
                                <i class="fa-solid fa-ban"></i>
                                Restringir
                            </button>
                        </div>
                    </article>
                `;
            })
            .join("");

        container
            .querySelectorAll(
                "img[data-fallback]"
            )
            .forEach((imagem) => {
                imagem.addEventListener(
                    "error",
                    () => {
                        imagem.src =
                            "/imagens/sem-foto.jpg";

                        imagem.removeAttribute(
                            "data-fallback"
                        );
                    },
                    {
                        once: true
                    }
                );
            });
    }

    function atualizarPaginacao() {
        const navegacao =
            $("paginacaoContainer");

        navegacao.hidden =
            estado.totalPaginas <= 1;

        $("btnPagAnterior").disabled =
            estado.pagina <= 1 ||
            estado.carregando;

        $("btnPagProxima").disabled =
            estado.pagina >=
                estado.totalPaginas ||
            estado.carregando;

        $("infoPagina").textContent =
            `Página ${estado.pagina} de ` +
            `${estado.totalPaginas}`;

        $("resultadoContagem").textContent =
            `${formatarNumero.format(
                estado.total
            )} denúncia(s)`;
    }

    async function carregarDenuncias(
        pagina = 1,
        manual = false
    ) {
        if (estado.carregando) {
            estado.controle?.abort();
        }

        estado.controle =
            new AbortController();

        estado.carregando = true;

        skeleton();

        $("avisoErro").hidden = true;

        $("btnAtualizar").disabled =
            true;

        $("btnAtualizar").classList.add(
            "girando"
        );

        $("atualizadoEm").textContent =
            "Atualizando…";

        $("atualizadoEm").classList.remove(
            "erro"
        );

        const parametros =
            new URLSearchParams({
                pagina:
                    String(pagina),

                limite:
                    String(LIMITE),

                ordem:
                    estado.ordem
            });

        if (estado.busca) {
            parametros.set(
                "busca",
                estado.busca
            );
        }

        if (estado.motivo) {
            parametros.set(
                "motivo",
                estado.motivo
            );
        }

        try {
            const dados =
                await requisitar(
                    `${API}?${parametros}`,
                    {
                        signal:
                            estado.controle
                                .signal
                    }
                );

            const lista =
                Array.isArray(dados)
                    ? dados
                    : (
                        dados.denuncias ||
                        dados.dados
                            ?.denuncias ||
                        dados.dados ||
                        dados.data ||
                        []
                    );

            estado.pagina =
                Number(
                    dados.pagina ||
                    dados.paginacao
                        ?.pagina ||
                    pagina
                ) || 1;

            estado.total =
                Number(
                    dados.total ||
                    dados.paginacao
                        ?.total ||
                    lista.length
                ) || 0;

            estado.totalPaginas =
                Math.max(
                    1,
                    Number(
                        dados.totalPaginas ||
                        dados.total_paginas ||
                        dados.paginacao
                            ?.total_paginas ||
                        Math.ceil(
                            estado.total /
                            LIMITE
                        )
                    ) || 1
                );

            renderizarCards(
                Array.isArray(lista)
                    ? lista
                    : []
            );

            atualizarMetricas(
                dados.resumo ||
                dados.metricas ||
                {}
            );

            const horario =
                new Date()
                    .toLocaleTimeString(
                        "pt-BR",
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    );

            $("atualizadoEm").textContent =
                `Atualizado às ${horario}`;

            if (manual) {
                toast(
                    "Fila atualizada"
                );
            }
        } catch (erro) {
            if (
                erro.name ===
                "AbortError"
            ) {
                return;
            }

            console.error(
                "Falha ao carregar a moderação:",
                erro.message
            );

            $("listaDenuncias").innerHTML = `
                <div class="vazio">
                    <div>
                        <i class="fa-solid fa-triangle-exclamation"></i>

                        <h3>
                            Falha ao carregar
                        </h3>

                        <p>
                            Tente novamente em instantes.
                        </p>
                    </div>
                </div>
            `;

            $("avisoErroTexto").textContent =
                erro.status === 403
                    ? (
                        "Sua conta não possui " +
                        "permissão de moderação."
                    )
                    : (
                        erro.message ||
                        "Não foi possível carregar as denúncias."
                    );

            $("avisoErro").hidden =
                false;

            $("atualizadoEm").textContent =
                "Falha ao atualizar";

            $("atualizadoEm").classList.add(
                "erro"
            );
        } finally {
            estado.carregando =
                false;

            $("listaDenuncias")
                .setAttribute(
                    "aria-busy",
                    "false"
                );

            $("btnAtualizar").disabled =
                false;

            $("btnAtualizar")
                .classList.remove(
                    "girando"
                );

            atualizarPaginacao();
        }
    }

        function atualizarConfirmacao() {
        const campo =
            $("justificativaAcao");

        const justificativa =
            campo.value.trim();

        $("contadorJustificativa").textContent =
            String(campo.value.length);

        $("btnConfirmarAcao").disabled =
            justificativa.length < 10;

        $("erroModal").hidden =
            true;
    }

    function abrirDecisao(botao) {
        const card =
            botao.closest(
                ".card-denuncia"
            );

        const acao =
            botao.dataset.acao;

        estado.acao = acao;

        estado.denuncia = {
            id:
                botao.dataset.id,

            veiculoId:
                botao.dataset.veiculoId,

            titulo:
                card
                    .querySelector("h3")
                    ?.textContent ||
                "Veículo",

            motivo:
                card
                    .querySelector(
                        ".motivo-box small"
                    )
                    ?.textContent ||
                "Não informado"
        };

        const restringir =
            acao === "restringir";

        $("iconeModalAcao")
            .classList.toggle(
                "restringir",
                restringir
            );

        $("iconeModalAcao").innerHTML = `
            <i class="fa-solid ${
                restringir
                    ? "fa-ban"
                    : "fa-shield-circle-check"
            }"></i>
        `;

        $("tituloModalAcao").textContent =
            restringir
                ? "Restringir anúncio"
                : "Manter anúncio ativo";

        $("textoModalAcao").textContent =
            restringir
                ? (
                    "O anúncio será ocultado do catálogo " +
                    "e deixará de aparecer para os visitantes."
                )
                : (
                    "A denúncia será encerrada e o anúncio " +
                    "continuará disponível."
                );

        $("resumoDecisao").innerHTML = `
            <div>
                <dt>Denúncia</dt>

                <dd>
                    #${escapar(
                        estado.denuncia.id
                    )}
                </dd>
            </div>

            <div>
                <dt>Veículo</dt>

                <dd>
                    ${escapar(
                        estado.denuncia.titulo
                    )}
                </dd>
            </div>

            <div>
                <dt>Motivo reportado</dt>

                <dd>
                    ${escapar(
                        estado.denuncia.motivo
                    )}
                </dd>
            </div>

            <div>
                <dt>Decisão</dt>

                <dd>
                    ${
                        restringir
                            ? "Restringir"
                            : "Manter"
                    }
                </dd>
            </div>
        `;

        $("justificativaAcao").value =
            "";

        $("btnConfirmarAcao")
            .classList.toggle(
                "restringir",
                restringir
            );

        $("btnConfirmarAcao").textContent =
            restringir
                ? "Confirmar restrição"
                : "Confirmar manutenção";

        atualizarConfirmacao();

        abrirModal(
            $("modalAcaoModeracao")
        );

        setTimeout(
            () => {
                $("justificativaAcao")
                    .focus();
            },
            30
        );
    }

    async function confirmarDecisao() {
        if (
            !estado.denuncia ||
            !estado.acao
        ) {
            return;
        }

        const justificativa =
            $("justificativaAcao")
                .value
                .trim();

        if (
            justificativa.length < 10
        ) {
            $("erroModal").textContent =
                "Informe uma justificativa com pelo menos 10 caracteres.";

            $("erroModal").hidden =
                false;

            return;
        }

        const botao =
            $("btnConfirmarAcao");

        botao.disabled = true;
        botao.textContent =
            "Registrando…";

        try {
            await requisitar(
                `${API}/${encodeURIComponent(
                    estado.denuncia.id
                )}/resolver`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        acao:
                            estado.acao,

                        justificativa,

                        veiculo_id:
                            estado.denuncia
                                .veiculoId ||
                            null,

                        origem:
                            "painel_moderacao",

                        dados_minimizados:
                            true
                    })
                }
            );

            fecharModal(
                $("modalAcaoModeracao")
            );

            if (
                estado.acao ===
                "restringir"
            ) {
                toast(
                    "Anúncio restringido e decisão registrada"
                );
            } else {
                toast(
                    "Denúncia encerrada e anúncio mantido"
                );
            }

            await carregarDenuncias(
                estado.pagina
            );
        } catch (erro) {
            $("erroModal").textContent =
                erro.message ||
                "Não foi possível registrar a decisão.";

            $("erroModal").hidden =
                false;

            botao.disabled = false;

            botao.textContent =
                estado.acao ===
                "restringir"
                    ? "Confirmar restrição"
                    : "Confirmar manutenção";
        }
    }

    function configurarEventos() {
        let atrasoBusca;

        $("campoBusca").addEventListener(
            "input",
            (evento) => {
                clearTimeout(
                    atrasoBusca
                );

                atrasoBusca = setTimeout(
                    () => {
                        estado.busca =
                            evento
                                .target
                                .value
                                .trim();

                        carregarDenuncias(1);
                    },
                    350
                );
            }
        );

        $("filtroMotivo").addEventListener(
            "change",
            (evento) => {
                estado.motivo =
                    evento.target.value;

                carregarDenuncias(1);
            }
        );

        $("filtroOrdem").addEventListener(
            "change",
            (evento) => {
                estado.ordem =
                    evento.target.value;

                carregarDenuncias(1);
            }
        );

        $("btnLimparFiltros")
            .addEventListener(
                "click",
                () => {
                    $("formFiltros")
                        .reset();

                    estado.busca = "";
                    estado.motivo = "";
                    estado.ordem =
                        "mais_antigas";

                    carregarDenuncias(1);
                }
            );

        $("btnAtualizar")
            .addEventListener(
                "click",
                () => {
                    carregarDenuncias(
                        estado.pagina,
                        true
                    );
                }
            );

        $("btnTentar")
            .addEventListener(
                "click",
                () => {
                    carregarDenuncias(
                        estado.pagina,
                        true
                    );
                }
            );

        $("btnPagAnterior")
            .addEventListener(
                "click",
                () => {
                    if (
                        estado.pagina > 1
                    ) {
                        carregarDenuncias(
                            estado.pagina - 1
                        );
                    }
                }
            );

        $("btnPagProxima")
            .addEventListener(
                "click",
                () => {
                    if (
                        estado.pagina <
                        estado.totalPaginas
                    ) {
                        carregarDenuncias(
                            estado.pagina + 1
                        );
                    }
                }
            );

        $("listaDenuncias")
            .addEventListener(
                "click",
                (evento) => {
                    const botao =
                        evento.target.closest(
                            "[data-acao]"
                        );

                    if (botao) {
                        abrirDecisao(
                            botao
                        );
                    }
                }
            );

        $("justificativaAcao")
            .addEventListener(
                "input",
                atualizarConfirmacao
            );

        $("btnConfirmarAcao")
            .addEventListener(
                "click",
                confirmarDecisao
            );

        [
            "btnCancelarAcao",
            "btnFecharModal"
        ].forEach((id) => {
            $(id).addEventListener(
                "click",
                () => {
                    fecharModal(
                        $("modalAcaoModeracao")
                    );
                }
            );
        });

        $("modalAcaoModeracao")
            .addEventListener(
                "mousedown",
                (evento) => {
                    if (
                        evento.target ===
                        evento.currentTarget
                    ) {
                        fecharModal(
                            evento.currentTarget
                        );
                    }
                }
            );

        $("btnCancelarSair")
            .addEventListener(
                "click",
                () => {
                    fecharModal(
                        $("modalSair")
                    );
                }
            );

        $("btnConfirmarSair")
            .addEventListener(
                "click",
                () => {
                    limparSessao();

                    window.location.replace(
                        LOGIN
                    );
                }
            );

        $("modalSair")
            .addEventListener(
                "mousedown",
                (evento) => {
                    if (
                        evento.target ===
                        evento.currentTarget
                    ) {
                        fecharModal(
                            evento.currentTarget
                        );
                    }
                }
            );

        document.addEventListener(
            "keydown",
            (evento) => {
                if (
                    evento.key !==
                    "Escape"
                ) {
                    return;
                }

                if (
                    !$("modalAcaoModeracao")
                        .hidden
                ) {
                    fecharModal(
                        $("modalAcaoModeracao")
                    );
                } else if (
                    !$("modalSair")
                        .hidden
                ) {
                    fecharModal(
                        $("modalSair")
                    );
                }
            }
        );

        const topbar =
            $("topbar");

        window.addEventListener(
            "scroll",
            () => {
                topbar.classList.toggle(
                    "rolou",
                    window.scrollY > 8
                );
            },
            {
                passive: true
            }
        );
    }

    function iniciar() {
        const usuario =
            lerUsuario();

        if (!usuario) {
            window.location.replace(
                LOGIN
            );

            return;
        }

        if (!ehAdmin(usuario)) {
            const destino =
                normalizar(
                    usuario.tipo
                ) === "empresa"
                    ? "/pages/painel-empresa.html"
                    : "/pages/painel-cliente.html";

            window.location.replace(
                destino
            );

            return;
        }

        configurarCabecalho(usuario);
        configurarTema();
        configurarEventos();
        carregarDenuncias(1);
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            iniciar,
            {
                once: true
            }
        );
    } else {
        iniciar();
    }
})();