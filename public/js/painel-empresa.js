"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const LOGIN_URL = "/pages/login.html";
    const PAINEL_CLIENTE_URL =
        "/pages/painel-cliente.html";

    const MAX_FOTO_BYTES =
        5 * 1024 * 1024;

    const TIPOS_FOTO = new Set([
        "image/jpeg",
        "image/png",
        "image/webp"
    ]);

    const $ = (id) =>
        document.getElementById(id);

    let sessaoExpirando = false;
    let modalAtivo = null;
    let resolverConfirmacao = null;
    let focoAnterior = null;
    let cropper = null;
    let enviandoFoto = false;
    let fotoAtual = "";

    // ======================================================
    // SESSÃO
    // ======================================================

    function obterSessao() {
        for (
            const storage of
            [localStorage, sessionStorage]
        ) {
            for (
                const chave of
                ["usuario", "usuario_logado"]
            ) {
                const valor =
                    storage.getItem(chave);

                if (!valor) continue;

                try {
                    const dados =
                        JSON.parse(valor);

                    if (
                        dados &&
                        typeof dados === "object"
                    ) {
                        return {
                            dados,
                            storage,
                            chave
                        };
                    }
                } catch {
                    storage.removeItem(chave);
                }
            }
        }

        return null;
    }

    const sessao = obterSessao();

    if (!sessao) {
        window.location.replace(
            LOGIN_URL
        );

        return;
    }

    const usuario = sessao.dados;

    const usuarioId = Number(
        usuario.id ??
        usuario._id ??
        usuario.usuario_id
    );

    const tipoUsuario = String(
        usuario.tipo || ""
    )
        .trim()
        .toLowerCase();

    if (
        !Number.isInteger(usuarioId) ||
        usuarioId <= 0
    ) {
        window.location.replace(
            LOGIN_URL
        );

        return;
    }

    if (
        ![
            "empresa",
            "admin",
            "super_admin"
        ].includes(tipoUsuario)
    ) {
        window.location.replace(
            PAINEL_CLIENTE_URL
        );

        return;
    }

    function obterToken() {
        return (
            localStorage.getItem("token") ||
            sessionStorage.getItem("token") ||
            ""
        );
    }

    function limparSessao() {
        for (
            const storage of
            [localStorage, sessionStorage]
        ) {
            for (
                const chave of
                [
                    "usuario",
                    "usuario_logado",
                    "token"
                ]
            ) {
                storage.removeItem(chave);
            }
        }
    }

    function salvarSessao() {
        try {
            sessao.storage.setItem(
                sessao.chave,
                JSON.stringify(usuario)
            );
        } catch (erro) {
            console.warn(
                "Não foi possível atualizar a sessão local:",
                erro
            );
        }
    }

    // ======================================================
    // AVISOS
    // ======================================================

    function toast(
        mensagem,
        tipo = "ok"
    ) {
        const area = $("toastArea");

        if (!area) return;

        const elemento =
            document.createElement("div");

        const icone =
            document.createElement("i");

        const texto =
            document.createElement("span");

        elemento.className =
            `toast toast--${tipo}`;

        elemento.setAttribute(
            "role",
            tipo === "erro"
                ? "alert"
                : "status"
        );

        icone.className =
            `fa-solid ${
                tipo === "erro"
                    ? "fa-circle-exclamation"
                    : "fa-circle-check"
            }`;

        texto.textContent =
            String(mensagem || "");

        elemento.append(
            icone,
            texto
        );

        area.appendChild(elemento);

        requestAnimationFrame(() => {
            elemento.classList.add(
                "visivel"
            );
        });

        window.setTimeout(() => {
            elemento.classList.remove(
                "visivel"
            );

            window.setTimeout(
                () => elemento.remove(),
                220
            );
        }, 3800);
    }

    function encerrarSessaoExpirada() {
        if (sessaoExpirando) return;

        sessaoExpirando = true;

        toast(
            "Sua sessão expirou. Entre novamente.",
            "erro"
        );

        window.setTimeout(() => {
            limparSessao();

            window.location.replace(
                LOGIN_URL
            );
        }, 1100);
    }

    // ======================================================
    // REQUISIÇÕES
    // ======================================================

    async function requisitar(
        url,
        opcoes = {},
        tempoLimite = 20000
    ) {
        const token = obterToken();

        const controle =
            new AbortController();

        const temporizador =
            window.setTimeout(
                () => controle.abort(),
                tempoLimite
            );

        const headers =
            new Headers(
                opcoes.headers || {}
            );

        if (
            token &&
            !headers.has("Authorization")
        ) {
            headers.set(
                "Authorization",
                `Bearer ${token}`
            );
        }

        if (
            opcoes.body &&
            !(
                opcoes.body
                instanceof FormData
            ) &&
            !headers.has("Content-Type")
        ) {
            headers.set(
                "Content-Type",
                "application/json"
            );
        }

        try {
            const resposta =
                await fetch(url, {
                    ...opcoes,
                    headers,
                    signal:
                        controle.signal,
                    credentials:
                        "same-origin"
                });

            const tipoConteudo =
                resposta.headers.get(
                    "content-type"
                ) || "";

            const dados =
                tipoConteudo.includes(
                    "application/json"
                )
                    ? await resposta
                        .json()
                        .catch(() => ({}))
                    : {
                        mensagem:
                            await resposta
                                .text()
                                .catch(
                                    () => ""
                                )
                    };

            if (
                resposta.status === 401
            ) {
                encerrarSessaoExpirada();

                throw new Error(
                    "Sessão expirada."
                );
            }

            if (
                !resposta.ok ||
                dados.sucesso === false
            ) {
                throw new Error(
                    dados.mensagem ||
                    dados.erro ||
                    `Não foi possível concluir a solicitação (erro ${resposta.status}).`
                );
            }

            return dados;
        } catch (erro) {
            if (
                erro.name ===
                "AbortError"
            ) {
                throw new Error(
                    "O servidor demorou para responder. Tente novamente."
                );
            }

            if (
                erro instanceof TypeError
            ) {
                throw new Error(
                    "Não foi possível conectar ao servidor."
                );
            }

            throw erro;
        } finally {
            window.clearTimeout(
                temporizador
            );
        }
    }

    // ======================================================
    // MODAIS
    // ======================================================

    function abrirModal(elemento) {
        if (!elemento) return;

        if (
            modalAtivo &&
            modalAtivo !== elemento
        ) {
            fecharModal(
                modalAtivo,
                false
            );
        }

        focoAnterior =
            document.activeElement;

        modalAtivo = elemento;

        elemento.hidden = false;

        elemento.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "sem-scroll"
        );
    }

    function fecharModal(
        elemento,
        restaurarFoco = true
    ) {
        if (
            !elemento ||
            elemento.hidden
        ) {
            return;
        }

        elemento.hidden = true;

        elemento.setAttribute(
            "aria-hidden",
            "true"
        );

        if (
            modalAtivo === elemento
        ) {
            modalAtivo = null;
        }

        if (!modalAtivo) {
            document.body.classList.remove(
                "sem-scroll"
            );
        }

        if (
            restaurarFoco &&
            focoAnterior
                instanceof HTMLElement
        ) {
            focoAnterior.focus();
        }
    }

    function confirmar({
        titulo,
        texto,
        botao = "Confirmar"
    }) {
        const modal =
            $("modalConfirma");

        return new Promise(
            (resolve) => {
                if (!modal) {
                    resolve(
                        window.confirm(
                            texto
                        )
                    );

                    return;
                }

                if (
                    resolverConfirmacao
                ) {
                    resolverConfirmacao(
                        false
                    );
                }

                resolverConfirmacao =
                    resolve;

                $("confirmaTitulo")
                    .textContent =
                    titulo;

                $("confirmaTexto")
                    .textContent =
                    texto;

                $("confirmaOk")
                    .textContent =
                    botao;

                abrirModal(modal);

                requestAnimationFrame(
                    () => {
                        $("confirmaCancelar")
                            ?.focus();
                    }
                );
            }
        );
    }

    function responderConfirmacao(
        resposta
    ) {
        if (
            !resolverConfirmacao
        ) {
            return;
        }

        const resolver =
            resolverConfirmacao;

        resolverConfirmacao = null;

        fecharModal(
            $("modalConfirma")
        );

        resolver(
            Boolean(resposta)
        );
    }

    $("confirmaOk")
        ?.addEventListener(
            "click",
            () => {
                responderConfirmacao(
                    true
                );
            }
        );

    $("confirmaCancelar")
        ?.addEventListener(
            "click",
            () => {
                responderConfirmacao(
                    false
                );
            }
        );

    $("modalConfirma")
        ?.addEventListener(
            "click",
            (evento) => {
                if (
                    evento.target ===
                    $("modalConfirma")
                ) {
                    responderConfirmacao(
                        false
                    );
                }
            }
        );

    // ======================================================
    // DADOS DA EMPRESA
    // ======================================================

    const empresa =
        usuario.empresa || {};

    const nomeEmpresa = String(
        empresa.nome_fantasia ||
        empresa.nome_empresa ||
        usuario.nome_empresa ||
        usuario.nome ||
        "Empresa"
    ).trim();

    if ($("nomeEmpresa")) {
        $("nomeEmpresa").textContent =
            nomeEmpresa;
    }

    document.title =
        `${nomeEmpresa} | Painel da Empresa | MotorFlex`;

    const iniciais = (
        nomeEmpresa
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((parte) =>
                parte.charAt(0)
            )
            .join("")
            .toUpperCase()
        || "E"
    );

    if ($("avatarIniciais")) {
        $("avatarIniciais")
            .textContent =
            iniciais;
    }

    // ======================================================
    // FOTO DA EMPRESA
    // ======================================================

    function resolverUrlFoto(foto) {
        const valor = String(
            foto || ""
        ).trim();

        if (!valor) return "";

        if (
            /^(https?:|data:|blob:)/i
                .test(valor) ||
            valor.startsWith("/")
        ) {
            return valor;
        }

        return `/uploads/${
            valor.replace(
                /^uploads\//i,
                ""
            )
        }`;
    }

    function adicionarCacheBuster(
        url
    ) {
        if (
            !url ||
            /^blob:|^data:/i
                .test(url)
        ) {
            return url;
        }

        return (
            `${url}${
                url.includes("?")
                    ? "&"
                    : "?"
            }v=${Date.now()}`
        );
    }

    function mostrarIniciais() {
        const imagem =
            $("imgPerfil");

        if (imagem) {
            imagem.onload = null;
            imagem.onerror = null;
            imagem.hidden = true;

            imagem.removeAttribute(
                "src"
            );
        }

        if ($("avatarIniciais")) {
            $("avatarIniciais")
                .hidden = false;
        }

        if ($("btnRemoverFoto")) {
            $("btnRemoverFoto")
                .hidden = true;
        }
    }

    function mostrarFoto(
        url,
        permitirRemocao = true
    ) {
        const imagem =
            $("imgPerfil");

        if (!imagem || !url) {
            mostrarIniciais();
            return;
        }

        imagem.onload = () => {
            imagem.hidden = false;

            if (
                $("avatarIniciais")
            ) {
                $("avatarIniciais")
                    .hidden = true;
            }

            if (
                $("btnRemoverFoto")
            ) {
                $("btnRemoverFoto")
                    .hidden =
                    !permitirRemocao;
            }
        };

        imagem.onerror = () => {
            fotoAtual = "";
            mostrarIniciais();
        };

        imagem.src = url;
    }

    function definirEnviandoFoto(
        estado
    ) {
        enviandoFoto =
            Boolean(estado);

        $("avatarWrapper")
            ?.classList.toggle(
                "enviando",
                enviandoFoto
            );

        for (
            const id of [
                "btnTrocarFoto",
                "btnRemoverFoto",
                "btnConfirmarRecorte"
            ]
        ) {
            if ($(id)) {
                $(id).disabled =
                    enviandoFoto;
            }
        }
    }

    const fotoSessao =
        usuario.foto_perfil ||
        usuario.fotoUrl ||
        usuario.foto_url ||
        empresa.foto_perfil ||
        "";

    fotoAtual =
        resolverUrlFoto(
            fotoSessao
        );

    if (fotoAtual) {
        mostrarFoto(fotoAtual);
    } else {
        mostrarIniciais();
    }

    // ======================================================
    // MENU E SAÍDA
    // ======================================================

    const btnConfig =
        $("btnConfig");

    const menuConfig =
        $("menuConfig");

    function fecharMenu() {
        menuConfig
            ?.classList.remove(
                "mostrar"
            );

        btnConfig
            ?.setAttribute(
                "aria-expanded",
                "false"
            );
    }

    btnConfig
        ?.addEventListener(
            "click",
            (evento) => {
                evento.stopPropagation();

                const aberto =
                    menuConfig
                        ?.classList
                        .toggle(
                            "mostrar"
                        );

                btnConfig.setAttribute(
                    "aria-expanded",
                    String(
                        Boolean(aberto)
                    )
                );
            }
        );

    document.addEventListener(
        "click",
        (evento) => {
            if (
                menuConfig &&
                btnConfig &&
                !menuConfig.contains(
                    evento.target
                ) &&
                !btnConfig.contains(
                    evento.target
                )
            ) {
                fecharMenu();
            }
        }
    );

    $("gatilhoSair")
        ?.addEventListener(
            "click",
            async (evento) => {
                evento.preventDefault();

                fecharMenu();

                const confirmado =
                    await confirmar({
                        titulo:
                            "Encerrar sessão?",

                        texto:
                            "Você precisará entrar novamente para acessar o painel.",

                        botao:
                            "Sim, sair"
                    });

                if (confirmado) {
                    limparSessao();

                    window.location
                        .replace(
                            LOGIN_URL
                        );
                }
            }
        );

    // ======================================================
    // RECORTE DA FOTO
    // ======================================================

    const inputFoto =
        $("inputFotoPerfil");

    const imagemParaCortar =
        $("imagemParaCortar");

    function destruirCropper() {
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
    }

    function fecharRecorte() {
        destruirCropper();

        fecharModal(
            $("modalRecorte")
        );

        if (
            imagemParaCortar
        ) {
            imagemParaCortar.onload =
                null;

            imagemParaCortar
                .removeAttribute(
                    "src"
                );
        }

        if (inputFoto) {
            inputFoto.value = "";
        }
    }

    $("btnTrocarFoto")
        ?.addEventListener(
            "click",
            () => {
                if (
                    !enviandoFoto
                ) {
                    inputFoto?.click();
                }
            }
        );

    inputFoto
        ?.addEventListener(
            "change",
            (evento) => {
                const arquivo =
                    evento.target
                        .files?.[0];

                if (!arquivo) return;

                if (
                    typeof window.Cropper
                    !== "function"
                ) {
                    toast(
                        "O editor de imagem não carregou. Recarregue a página.",
                        "erro"
                    );

                    inputFoto.value =
                        "";

                    return;
                }

                if (
                    !TIPOS_FOTO.has(
                        arquivo.type
                    )
                ) {
                    toast(
                        "Selecione uma imagem JPEG, PNG ou WEBP.",
                        "erro"
                    );

                    inputFoto.value =
                        "";

                    return;
                }

                if (
                    arquivo.size >
                    MAX_FOTO_BYTES
                ) {
                    toast(
                        "A imagem deve ter no máximo 5 MB.",
                        "erro"
                    );

                    inputFoto.value =
                        "";

                    return;
                }

                const leitor =
                    new FileReader();

                leitor.onload = () => {
                    if (
                        !imagemParaCortar
                    ) {
                        return;
                    }

                    destruirCropper();

                    imagemParaCortar
                        .onload = () => {
                            cropper =
                                new window
                                    .Cropper(
                                        imagemParaCortar,
                                        {
                                            aspectRatio: 1,
                                            viewMode: 1,
                                            dragMode: "move",
                                            autoCropArea: 0.88,
                                            responsive: true,
                                            guides: false,
                                            background: false,
                                            toggleDragModeOnDblclick: false
                                        }
                                    );
                        };

                    imagemParaCortar.src =
                        String(
                            leitor.result ||
                            ""
                        );

                    abrirModal(
                        $("modalRecorte")
                    );
                };

                leitor.onerror = () => {
                    toast(
                        "Não foi possível abrir a imagem selecionada.",
                        "erro"
                    );

                    inputFoto.value =
                        "";
                };

                leitor.readAsDataURL(
                    arquivo
                );
            }
        );

    $("btnCancelarRecorte")
        ?.addEventListener(
            "click",
            fecharRecorte
        );

    $("modalRecorte")
        ?.addEventListener(
            "click",
            (evento) => {
                if (
                    evento.target ===
                        $("modalRecorte") &&
                    !enviandoFoto
                ) {
                    fecharRecorte();
                }
            }
        );

    // ======================================================
    // ENVIAR FOTO
    // ======================================================

    $("btnConfirmarRecorte")
        ?.addEventListener(
            "click",
            () => {
                if (
                    !cropper ||
                    enviandoFoto
                ) {
                    return;
                }

                const canvas =
                    cropper
                        .getCroppedCanvas({
                            width: 500,
                            height: 500,
                            imageSmoothingEnabled: true,
                            imageSmoothingQuality: "high"
                        });

                if (!canvas) {
                    toast(
                        "Não foi possível processar o recorte.",
                        "erro"
                    );

                    return;
                }

                definirEnviandoFoto(
                    true
                );

                canvas.toBlob(
                    async (blob) => {
                        if (!blob) {
                            definirEnviandoFoto(
                                false
                            );

                            toast(
                                "Não foi possível gerar a nova foto.",
                                "erro"
                            );

                            return;
                        }

                        const arquivo =
                            new File(
                                [blob],
                                "foto-empresa.webp",
                                {
                                    type:
                                        "image/webp"
                                }
                            );

                        const preview =
                            URL.createObjectURL(
                                arquivo
                            );

                        const formData =
                            new FormData();

                        formData.append(
                            "fotoPerfil",
                            arquivo
                        );

                        fecharRecorte();

                        mostrarFoto(
                            preview,
                            false
                        );

                        try {
                            const dados =
                                await requisitar(
                                    "/api/usuarios/upload-foto",
                                    {
                                        method:
                                            "POST",

                                        body:
                                            formData
                                    },
                                    45000
                                );

                            const novaFoto =
                                dados.fotoUrl ||
                                dados.foto_perfil ||
                                dados.foto_url ||
                                dados.url ||
                                dados.usuario
                                    ?.foto_perfil ||
                                dados.usuario
                                    ?.foto_url;

                            if (!novaFoto) {
                                throw new Error(
                                    "A imagem foi enviada, mas o servidor não retornou seu endereço."
                                );
                            }

                            fotoAtual =
                                resolverUrlFoto(
                                    novaFoto
                                );

                            usuario.foto_perfil =
                                novaFoto;

                            usuario.fotoUrl =
                                novaFoto;

                            usuario.foto_url =
                                novaFoto;

                            salvarSessao();

                            mostrarFoto(
                                adicionarCacheBuster(
                                    fotoAtual
                                )
                            );

                            toast(
                                "Foto da empresa atualizada."
                            );
                        } catch (erro) {
                            console.error(
                                "Erro ao atualizar foto:",
                                erro
                            );

                            toast(
                                erro.message ||
                                "Não foi possível atualizar a foto.",
                                "erro"
                            );

                            if (fotoAtual) {
                                mostrarFoto(
                                    fotoAtual
                                );
                            } else {
                                mostrarIniciais();
                            }
                        } finally {
                            URL.revokeObjectURL(
                                preview
                            );

                            definirEnviandoFoto(
                                false
                            );
                        }
                    },
                    "image/webp",
                    0.9
                );
            }
        );

    // ======================================================
    // REMOVER FOTO
    // ======================================================

    $("btnRemoverFoto")
        ?.addEventListener(
            "click",
            async () => {
                if (
                    enviandoFoto
                ) {
                    return;
                }

                const confirmado =
                    await confirmar({
                        titulo:
                            "Remover foto?",

                        texto:
                            "A imagem atual será removida e as iniciais da empresa voltarão a aparecer.",

                        botao:
                            "Remover foto"
                    });

                if (!confirmado) {
                    return;
                }

                definirEnviandoFoto(
                    true
                );

                try {
                    await requisitar(
                        "/api/usuarios/remover-foto",
                        {
                            method:
                                "DELETE"
                        }
                    );

                    fotoAtual = "";

                    usuario.foto_perfil =
                        null;

                    usuario.fotoUrl =
                        null;

                    usuario.foto_url =
                        null;

                    salvarSessao();
                    mostrarIniciais();

                    toast(
                        "Foto removida com sucesso."
                    );
                } catch (erro) {
                    console.error(
                        "Erro ao remover foto:",
                        erro
                    );

                    toast(
                        erro.message ||
                        "Não foi possível remover a foto.",
                        "erro"
                    );
                } finally {
                    definirEnviandoFoto(
                        false
                    );
                }
            }
        );

    // ======================================================
    // INDICADORES
    // ======================================================

    function formatarNumero(
        valor
    ) {
        return new Intl
            .NumberFormat(
                "pt-BR",
                {
                    maximumFractionDigits: 0
                }
            )
            .format(
                Number(valor) || 0
            );
    }

    function extrairLista(
        dados,
        chaves
    ) {
        if (
            Array.isArray(dados)
        ) {
            return dados;
        }

        for (
            const chave of chaves
        ) {
            if (
                Array.isArray(
                    dados?.[chave]
                )
            ) {
                return dados[chave];
            }
        }

        return [];
    }

    function veiculoPertenceAoUsuario(
        veiculo
    ) {
        const proprietario =
            veiculo.usuario_id ??
            veiculo.usuarioId ??
            veiculo.empresa_usuario_id ??
            veiculo.vendedor_id ??
            veiculo.anunciante_id;

        return (
            proprietario == null ||
            String(proprietario) ===
                String(usuarioId)
        );
    }

    async function carregarResumo() {
        const elementoVeiculos =
            $("totalVeiculos");

        const elementoConversas =
            $("totalConversas");

        const elementoVisualizacoes =
            $("totalVisualizacoes");

        const [
            resultadoVeiculos,
            resultadoConversas
        ] = await Promise.allSettled([
            requisitar(
                "/api/veiculos",
                {
                    method: "GET"
                }
            ),

            requisitar(
                "/api/conversas",
                {
                    method: "GET"
                }
            )
        ]);

        if (
            resultadoVeiculos.status ===
            "fulfilled"
        ) {
            const veiculos =
                extrairLista(
                    resultadoVeiculos
                        .value,
                    [
                        "veiculos",
                        "dados",
                        "resultados"
                    ]
                )
                    .filter(
                        veiculoPertenceAoUsuario
                    );

            const visualizacoes =
                veiculos.reduce(
                    (
                        total,
                        veiculo
                    ) => {
                        const quantidade =
                            veiculo.total_visualizacoes ??
                            veiculo.visualizacoes ??
                            veiculo.views ??
                            0;

                        return (
                            total +
                            (
                                Number(
                                    quantidade
                                ) || 0
                            )
                        );
                    },
                    0
                );

            if (
                elementoVeiculos
            ) {
                elementoVeiculos
                    .textContent =
                    formatarNumero(
                        veiculos.length
                    );
            }

            if (
                elementoVisualizacoes
            ) {
                elementoVisualizacoes
                    .textContent =
                    formatarNumero(
                        visualizacoes
                    );
            }
        } else {
            console.error(
                "Erro ao carregar veículos:",
                resultadoVeiculos.reason
            );

            if (
                elementoVeiculos
            ) {
                elementoVeiculos
                    .textContent =
                    "–";
            }

            if (
                elementoVisualizacoes
            ) {
                elementoVisualizacoes
                    .textContent =
                    "–";
            }
        }

        if (
            resultadoConversas.status ===
            "fulfilled"
        ) {
            const conversas =
                extrairLista(
                    resultadoConversas
                        .value,
                    [
                        "conversas",
                        "dados",
                        "resultados"
                    ]
                );

            const usuarios =
                new Set();

            for (
                const conversa
                of conversas
            ) {
                const outroUsuarioId =
                    Number(
                        conversa
                            .outro_usuario_id
                    );

                if (
                    Number.isInteger(
                        outroUsuarioId
                    ) &&
                    outroUsuarioId > 0
                ) {
                    usuarios.add(
                        outroUsuarioId
                    );
                }
            }

            const totalConversas =
                usuarios.size ||
                conversas.length;

            if (
                elementoConversas
            ) {
                elementoConversas
                    .textContent =
                    formatarNumero(
                        totalConversas
                    );
            }
        } else {
            console.error(
                "Erro ao carregar conversas:",
                resultadoConversas.reason
            );

            if (
                elementoConversas
            ) {
                elementoConversas
                    .textContent =
                    "–";
            }
        }

        $("stats")
            ?.classList.remove(
                "carregando"
            );

        if (
            resultadoVeiculos.status ===
                "rejected" &&
            resultadoConversas.status ===
                "rejected"
        ) {
            toast(
                "Não foi possível atualizar o resumo do painel.",
                "erro"
            );
        }
    }

    // ======================================================
    // TECLADO
    // ======================================================

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
                $("modalConfirma") &&
                !$("modalConfirma")
                    .hidden
            ) {
                responderConfirmacao(
                    false
                );

                return;
            }

            if (
                $("modalRecorte") &&
                !$("modalRecorte")
                    .hidden &&
                !enviandoFoto
            ) {
                fecharRecorte();
                return;
            }

            fecharMenu();
        }
    );

    // ======================================================
    // INICIALIZAÇÃO
    // ======================================================

    carregarResumo()
        .catch((erro) => {
            console.error(
                "Erro inesperado ao montar o painel:",
                erro
            );

            $("stats")
                ?.classList.remove(
                    "carregando"
                );
        });
});