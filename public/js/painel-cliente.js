"use strict";

/* ==========================================================================
   MOTORFLEX — PAINEL DO CLIENTE
   ========================================================================== */

(() => {
    const LOGIN = "/pages/login.html";

    const PAINEIS = {
        admin: "/pages/painel-admin.html",
        empresa: "/pages/painel-empresa.html"
    };

    const API_FAVORITOS = null;

    const $ = (id) => document.getElementById(id);

    const esc = (valor) => String(valor ?? "").replace(
        /[&<>'"]/g,
        (caractere) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
        })[caractere]
    );

    // ==========================================================
    // SESSÃO
    // ==========================================================

    function lerSessao() {
        for (const storage of [localStorage, sessionStorage]) {
            for (const chave of ["usuario", "usuario_logado"]) {
                const bruto = storage.getItem(chave);

                if (!bruto) continue;

                try {
                    const dados = JSON.parse(bruto);

                    if (dados && typeof dados === "object") {
                        return { dados, storage, chave };
                    }
                } catch {
                    // Tenta a próxima chave.
                }
            }
        }

        return null;
    }

    const sessao = lerSessao();

    if (!sessao) {
        window.location.replace(LOGIN);
        return;
    }

    const usuario = sessao.dados;
    const uid = usuario.id ?? usuario._id;
    const tipo = String(
        usuario.tipo || "individual"
    ).toLowerCase();

    if (PAINEIS[tipo]) {
        window.location.replace(PAINEIS[tipo]);
        return;
    }

    function obterToken() {
        return localStorage.getItem("token")
            || sessionStorage.getItem("token");
    }

    function authHeaders() {
        const token = obterToken();

        return token
            ? { Authorization: `Bearer ${token}` }
            : {};
    }

    function salvarSessao() {
        try {
            sessao.storage.setItem(
                sessao.chave,
                JSON.stringify(usuario)
            );
        } catch {
            // Armazenamento cheio ou indisponível.
        }
    }

    function encerrarSessao() {
        ["usuario", "usuario_logado", "token"].forEach((chave) => {
            localStorage.removeItem(chave);
            sessionStorage.removeItem(chave);
        });

        window.location.replace(LOGIN);
    }

    if (!obterToken()) {
        encerrarSessao();
        return;
    }

    async function get(url) {
        const resposta = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
                ...authHeaders()
            }
        });

        const dados = await resposta
            .json()
            .catch(() => ({}));

        /*
         * Somente 401 representa sessão inválida.
         * Um erro 403 será exibido sem desconectar a conta.
         */
        if (resposta.status === 401) {
            encerrarSessao();

            throw new Error(
                "Sua sessão expirou. Entre novamente."
            );
        }

        if (!resposta.ok || dados.sucesso === false) {
            throw new Error(
                dados.mensagem
                || `Erro HTTP ${resposta.status}`
            );
        }

        return dados;
    }

    // ==========================================================
    // AVISOS
    // ==========================================================

    function toast(mensagem, tipoMensagem = "ok") {
        const area = $("toastArea");

        if (!area) {
            console.log(mensagem);
            return;
        }

        const elemento = document.createElement("div");

        elemento.className = `toast ${
            tipoMensagem === "erro" ? "erro" : ""
        }`;

        elemento.textContent = mensagem;
        area.appendChild(elemento);

        requestAnimationFrame(() => {
            elemento.classList.add("on");
        });

        setTimeout(() => {
            elemento.classList.remove("on");

            setTimeout(() => {
                elemento.remove();
            }, 300);
        }, 3500);
    }

    // ==========================================================
    // MODAIS
    // ==========================================================

    const modais = [
        "modalSairContainer",
        "modalRemoverFoto",
        "modalRecorte"
    ];

    function abrirModal(id) {
        const modal = $(id);

        if (!modal) return;

        modal.classList.add("mostrar-modal");
        document.body.classList.add("travado");
    }

    function fecharModal(id) {
        const modal = $(id);

        if (!modal) return;

        modal.classList.remove("mostrar-modal");

        const existeModalAberto = modais.some((modalId) => {
            return $(modalId)?.classList.contains(
                "mostrar-modal"
            );
        });

        if (!existeModalAberto) {
            document.body.classList.remove("travado");
        }
    }

    modais.forEach((id) => {
        const modal = $(id);

        modal?.addEventListener("click", (evento) => {
            if (
                evento.target.id === id
                && id !== "modalRecorte"
            ) {
                fecharModal(id);
            }
        });
    });

    document.addEventListener("keydown", (evento) => {
        if (evento.key !== "Escape") return;

        modais.forEach((id) => {
            if (
                !$(id)?.classList.contains(
                    "mostrar-modal"
                )
            ) {
                return;
            }

            if (id === "modalRecorte") {
                cancelarRecorte();
            } else {
                fecharModal(id);
            }
        });

        fecharMenu();
    });

    // ==========================================================
    // FOTO E AVATAR
    // ==========================================================

    function imgSrc(caminho) {
        if (
            typeof caminho !== "string"
            || !caminho
        ) {
            return "";
        }

        if (/^(\/|https?:|blob:|data:)/.test(caminho)) {
            return caminho;
        }

        return `/uploads/${caminho}`;
    }

    function avatarPadrao(nome) {
        return `https://ui-avatars.com/api/?name=${
            encodeURIComponent(nome || "Cliente")
        }&background=181824&color=ff1e27&size=150`;
    }

    function definirFoto(url) {
        const src =
            imgSrc(url)
            || avatarPadrao(usuario.nome);

        if ($("imgPerfil")) {
            $("imgPerfil").src = src;
        }

        if ($("miniAvatar")) {
            $("miniAvatar").src = src;
        }

        if ($("btnRemoverFoto")) {
            $("btnRemoverFoto").style.display =
                url ? "grid" : "none";
        }
    }

    ["imgPerfil", "miniAvatar"].forEach((id) => {
        $(id)?.addEventListener("error", (evento) => {
            if (
                !evento.target.src.includes(
                    "ui-avatars.com"
                )
            ) {
                evento.target.src =
                    avatarPadrao(usuario.nome);

                if (
                    id === "imgPerfil"
                    && $("btnRemoverFoto")
                ) {
                    $("btnRemoverFoto").style.display =
                        "none";
                }
            }
        });
    });

    // ==========================================================
    // CABEÇALHO E PERFIL
    // ==========================================================

    function preencherPerfil() {
        const nome = String(
            usuario.nome || "Cliente"
        ).trim();

        const sobrenome = String(
            usuario.sobrenome || ""
        ).trim();

        if ($("nomeUsuario")) {
            $("nomeUsuario").textContent =
                `${nome} ${sobrenome}`.trim();
        }

        if ($("miniNome")) {
            $("miniNome").textContent =
                nome.split(/\s+/)[0];
        }

        const hora = new Date().getHours();

        if ($("saudacao")) {
            $("saudacao").textContent =
                hora < 12
                    ? "Bom dia"
                    : hora < 18
                        ? "Boa tarde"
                        : "Boa noite";
        }

        const criadoEm = new Date(
            usuario.criado_em
        );

        if (
            usuario.criado_em
            && !Number.isNaN(criadoEm.getTime())
            && $("tagDesde")
        ) {
            $("tagDesde").textContent =
                `Membro desde ${criadoEm.getFullYear()}`;

            $("tagDesde").hidden = false;
        }

        definirFoto(
            usuario.fotoUrl
            || usuario.foto_perfil
        );

        montarChecklist();
    }

    // ==========================================================
    // MENU E LOGOUT
    // ==========================================================

    const btnConfig = $("btnConfig");
    const menuConfig = $("menuConfig");

    function fecharMenu() {
        menuConfig?.classList.remove("mostrar");

        btnConfig?.setAttribute(
            "aria-expanded",
            "false"
        );
    }

    btnConfig?.addEventListener("click", (evento) => {
        evento.stopPropagation();

        const aberto =
            menuConfig?.classList.toggle("mostrar");

        btnConfig.setAttribute(
            "aria-expanded",
            String(Boolean(aberto))
        );
    });

    document.addEventListener("click", (evento) => {
        if (
            menuConfig
            && btnConfig
            && !menuConfig.contains(evento.target)
            && !btnConfig.contains(evento.target)
        ) {
            fecharMenu();
        }
    });

    $("gatilhoSair")?.addEventListener(
        "click",
        (evento) => {
            evento.preventDefault();
            fecharMenu();
            abrirModal("modalSairContainer");
        }
    );

    $("btnCancelarSair")?.addEventListener(
        "click",
        () => {
            fecharModal("modalSairContainer");
        }
    );

    $("btnSair")?.addEventListener(
        "click",
        encerrarSessao
    );

    // ==========================================================
    // FOTO: RECORTE E ENVIO
    // ==========================================================

    const inputFoto = $("inputFotoPerfil");
    let cropper = null;

    function cancelarRecorte() {
        fecharModal("modalRecorte");

        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        if (inputFoto) {
            inputFoto.value = "";
        }
    }

    inputFoto?.addEventListener(
        "change",
        (evento) => {
            const arquivo =
                evento.target.files?.[0];

            if (!arquivo) return;

            const tiposPermitidos = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];

            if (
                !tiposPermitidos.includes(
                    arquivo.type
                )
            ) {
                toast(
                    "Selecione uma imagem JPEG, PNG ou WEBP.",
                    "erro"
                );

                inputFoto.value = "";
                return;
            }

            if (arquivo.size > 5 * 1024 * 1024) {
                toast(
                    "A foto deve ter no máximo 5 MB.",
                    "erro"
                );

                inputFoto.value = "";
                return;
            }

            if (typeof Cropper === "undefined") {
                toast(
                    "O editor de imagem não carregou. Recarregue a página.",
                    "erro"
                );

                inputFoto.value = "";
                return;
            }

            const leitor = new FileReader();

            leitor.onload = (eventoLeitura) => {
                const imagem =
                    $("imagemParaCortar");

                if (!imagem) return;

                imagem.src =
                    eventoLeitura.target.result;

                abrirModal("modalRecorte");

                if (cropper) {
                    cropper.destroy();
                }

                cropper = new Cropper(imagem, {
                    aspectRatio: 1,
                    viewMode: 1,
                    dragMode: "move",
                    autoCropArea: 0.8,
                    restore: false,
                    guides: true,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                    minCropBoxWidth: 120,
                    minCropBoxHeight: 120
                });
            };

            leitor.onerror = () => {
                toast(
                    "Não foi possível ler a imagem.",
                    "erro"
                );

                inputFoto.value = "";
            };

            leitor.readAsDataURL(arquivo);
        }
    );

    $("btnCancelarRecorte")?.addEventListener(
        "click",
        cancelarRecorte
    );

    $("btnConfirmarRecorte")?.addEventListener(
        "click",
        () => {
            if (!cropper) return;

            const botao =
                $("btnConfirmarRecorte");

            const textoOriginal =
                botao.textContent;

            botao.disabled = true;
            botao.textContent = "Salvando...";

            cropper.getCroppedCanvas({
                width: 400,
                height: 400
            }).toBlob(async (blob) => {
                if (!blob) {
                    toast(
                        "Não foi possível processar a imagem.",
                        "erro"
                    );

                    botao.disabled = false;
                    botao.textContent = textoOriginal;
                    return;
                }

                fecharModal("modalRecorte");

                const arquivo = new File(
                    [blob],
                    "foto-perfil.png",
                    { type: "image/png" }
                );

                const previa =
                    URL.createObjectURL(arquivo);

                const fotoAnterior =
                    usuario.fotoUrl
                    || usuario.foto_perfil
                    || "";

                definirFoto(previa);

                const formData = new FormData();

                /*
                 * O ID não é enviado.
                 * O servidor identifica o usuário
                 * através do token.
                 */
                formData.append(
                    "fotoPerfil",
                    arquivo
                );

                try {
                    const resposta = await fetch(
                        "/api/usuarios/upload-foto",
                        {
                            method: "POST",

                            /*
                             * Não definir Content-Type.
                             * O navegador configura o
                             * multipart/form-data.
                             */
                            headers: authHeaders(),
                            body: formData
                        }
                    );

                    const dados = await resposta
                        .json()
                        .catch(() => ({}));

                    /*
                     * Somente 401 encerra a sessão.
                     */
                    if (resposta.status === 401) {
                        encerrarSessao();

                        throw new Error(
                            "Sua sessão expirou. Entre novamente."
                        );
                    }

                    if (
                        !resposta.ok
                        || dados.sucesso === false
                    ) {
                        throw new Error(
                            dados.mensagem
                            || dados.erro
                            || `Erro ${resposta.status} ao salvar a imagem.`
                        );
                    }

                    const novaFoto =
                        dados.fotoUrl
                        || dados.foto_perfil
                        || dados.url;

                    if (!novaFoto) {
                        throw new Error(
                            "O servidor não retornou o endereço da foto."
                        );
                    }

                    usuario.fotoUrl = novaFoto;
                    usuario.foto_perfil = novaFoto;

                    salvarSessao();
                    definirFoto(novaFoto);
                    montarChecklist();

                    toast(
                        "✨ Foto de perfil atualizada!"
                    );
                } catch (erro) {
                    console.error(
                        "Falha no upload:",
                        erro
                    );

                    definirFoto(fotoAnterior);

                    toast(
                        erro.message
                        || "Não foi possível salvar a nova foto.",
                        "erro"
                    );
                } finally {
                    URL.revokeObjectURL(previa);

                    if (cropper) {
                        cropper.destroy();
                        cropper = null;
                    }

                    inputFoto.value = "";
                    botao.disabled = false;
                    botao.textContent =
                        textoOriginal;
                }
            }, "image/png");
        }
    );

    // ==========================================================
    // FOTO: REMOVER
    // ==========================================================

    $("btnRemoverFoto")?.addEventListener(
        "click",
        () => {
            abrirModal("modalRemoverFoto");
        }
    );

    $("btnNaoRemover")?.addEventListener(
        "click",
        () => {
            fecharModal("modalRemoverFoto");
        }
    );

    $("btnSimRemover")?.addEventListener(
        "click",
        async () => {
            const botao =
                $("btnSimRemover");

            botao.disabled = true;

            try {
                const resposta = await fetch(
                    "/api/usuarios/remover-foto",
                    {
                        method: "DELETE",
                        headers: authHeaders()
                    }
                );

                const dados = await resposta
                    .json()
                    .catch(() => ({}));

                /*
                 * Somente 401 encerra a sessão.
                 * Um 403 exibirá o erro sem sair da conta.
                 */
                if (resposta.status === 401) {
                    encerrarSessao();

                    throw new Error(
                        "Sua sessão expirou. Entre novamente."
                    );
                }

                if (
                    !resposta.ok
                    || dados.sucesso === false
                ) {
                    throw new Error(
                        dados.mensagem
                        || dados.erro
                        || `Não foi possível remover a foto. Erro ${resposta.status}.`
                    );
                }

                usuario.fotoUrl = null;
                usuario.foto_perfil = null;

                salvarSessao();
                definirFoto(null);
                montarChecklist();

                toast(
                    "🗑️ Foto de perfil removida."
                );
            } catch (erro) {
                console.error(
                    "Erro ao remover foto:",
                    erro
                );

                toast(
                    erro.message
                    || "Erro de conexão ao remover a foto.",
                    "erro"
                );
            } finally {
                botao.disabled = false;

                fecharModal(
                    "modalRemoverFoto"
                );
            }
        }
    );

    // ==========================================================
    // RESUMO
    // ==========================================================

    const estado = {
        anuncios: null,
        conversas: null
    };

    const LIDAS_KEY = `mf_lidas_${uid}`;
    let lidas = {};

    try {
        lidas = JSON.parse(
            localStorage.getItem(LIDAS_KEY)
        ) || {};
    } catch {
        lidas = {};
    }

    function animarNumero(elemento, alvo) {
        if (!elemento) return;

        if (typeof alvo !== "number") {
            elemento.textContent = "—";
            return;
        }

        const inicio = performance.now();
        const duracao = 700;

        function passo(tempo) {
            const progresso = Math.min(
                1,
                (tempo - inicio) / duracao
            );

            elemento.textContent = Math.round(
                alvo * (
                    1 - Math.pow(
                        1 - progresso,
                        3
                    )
                )
            ).toLocaleString("pt-BR");

            if (progresso < 1) {
                requestAnimationFrame(passo);
            }
        }

        requestAnimationFrame(passo);
    }

    function stat(nome, valor) {
        const elemento =
            document.querySelector(
                `[data-stat="${nome}"]`
            );

        animarNumero(elemento, valor);
    }

    function brl(valor) {
        return `R$ ${Number(
            valor || 0
        ).toLocaleString(
            "pt-BR",
            { maximumFractionDigits: 0 }
        )}`;
    }

    function vazio(icone, texto, link) {
        return `
            <div class="vazio">
                <svg class="i">
                    <use href="#${icone}"></use>
                </svg>

                ${texto}

                ${
                    link
                        ? `<br><a href="${link[0]}">${link[1]}</a>`
                        : ""
                }
            </div>
        `;
    }

    function renderAnuncios(lista) {
        const elemento = $("listaAnuncios");

        if (!elemento) return;

        if (!lista.length) {
            elemento.innerHTML = vazio(
                "i-car",
                "Você ainda não anunciou nenhum veículo.",
                [
                    "/pages/catalogo.html?tab=cadastrar",
                    "Anunciar meu primeiro carro"
                ]
            );

            return;
        }

        elemento.innerHTML = [...lista]
            .sort((a, b) => b.id - a.id)
            .slice(0, 3)
            .map((veiculo) => {
                const foto =
                    imgSrc(veiculo.imagem);

                const ano =
                    veiculo.ano_fabricacao
                    && veiculo.ano_modelo
                        ? `${veiculo.ano_fabricacao}/${veiculo.ano_modelo}`
                        : veiculo.ano_fabricacao || "";

                return `
                    <a
                        class="item"
                        href="/pages/editar-anuncio.html?id=${
                            encodeURIComponent(
                                veiculo.id
                            )
                        }"
                    >
                        ${
                            foto
                                ? `
                                    <img
                                        class="item-foto"
                                        src="${esc(foto)}"
                                        alt=""
                                        loading="lazy"
                                    >
                                `
                                : `
                                    <span class="item-foto vazia">
                                        <svg class="i">
                                            <use href="#i-car"></use>
                                        </svg>
                                    </span>
                                `
                        }

                        <div class="item-info">
                            <h4>
                                ${esc(veiculo.marca)}
                                ${esc(veiculo.modelo)}
                            </h4>

                            <p>
                                ${esc(
                                    [
                                        veiculo.versao,
                                        ano
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")
                                )}
                            </p>
                        </div>

                        <div class="item-meta">
                            <strong>
                                ${brl(veiculo.preco)}
                            </strong>

                            <span class="views">
                                <svg class="i">
                                    <use href="#i-eye"></use>
                                </svg>

                                ${Number(
                                    veiculo.total_visualizacoes
                                    || 0
                                )}
                            </span>
                        </div>
                    </a>
                `;
            })
            .join("");
    }

    function naoLidas(conversa) {
        if (conversa.nao_lidas != null) {
            return Number(
                conversa.nao_lidas
            ) || 0;
        }

        if (
            conversa.ultimo_remetente_id != null
            && String(
                conversa.ultimo_remetente_id
            ) === String(uid)
        ) {
            return 0;
        }

        const ultimaLida =
            lidas[conversa.id];

        if (ultimaLida == null) {
            return 0;
        }

        const total = Number(
            conversa.total_mensagens
        );

        if (
            !Number.isNaN(total)
            && !Number.isNaN(
                Number(ultimaLida)
            )
        ) {
            return Math.max(
                0,
                total - Number(ultimaLida)
            );
        }

        return String(ultimaLida) !== String(
            conversa.total_mensagens
            ?? conversa.ultima_mensagem
            ?? ""
        ) ? 1 : 0;
    }

    function horaCurta(valor) {
        const data = new Date(valor);

        if (Number.isNaN(data.getTime())) {
            return "";
        }

        const hoje = new Date();

        if (
            data.toDateString()
            === hoje.toDateString()
        ) {
            return data.toLocaleTimeString(
                "pt-BR",
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );
        }

        const ontem =
            new Date(Date.now() - 86400000);

        if (
            data.toDateString()
            === ontem.toDateString()
        ) {
            return "Ontem";
        }

        return data.toLocaleDateString(
            "pt-BR",
            {
                day: "2-digit",
                month: "2-digit"
            }
        );
    }

    function avatarConversa(nome, foto) {
        const nomeSeguro =
            String(nome || "?").trim();

        const partes =
            nomeSeguro.split(/\s+/);

        let cor = 0;

        for (const caractere of nomeSeguro) {
            cor = (
                cor * 31
                + caractere.charCodeAt(0)
            ) % 360;
        }

        const src = imgSrc(foto);

        const iniciais = (
            (partes[0]?.[0] || "?")
            + (partes[1]?.[0] || "")
        ).toUpperCase();

        return `
            <span
                class="av"
                style="
                    background:
                    linear-gradient(
                        135deg,
                        hsl(${cor} 45% 28%),
                        hsl(${(cor + 40) % 360} 50% 20%)
                    );
                "
            >
                ${esc(iniciais)}

                ${
                    src
                        ? `
                            <img
                                src="${esc(src)}"
                                alt=""
                                loading="lazy"
                                onerror="this.remove()"
                            >
                        `
                        : ""
                }
            </span>
        `;
    }

    function renderConversas(lista) {
        const elemento =
            $("listaConversas");

        if (!elemento) return;

        if (!lista.length) {
            elemento.innerHTML = vazio(
                "i-chat",
                "Nenhuma conversa por enquanto.<br>Fale com um vendedor pelo anúncio.",
                [
                    "/pages/catalogo.html",
                    "Explorar catálogo"
                ]
            );

            return;
        }

        const ordenadas = [...lista]
            .sort((a, b) => {
                const dataB =
                    new Date(
                        b.ultimo_envio
                    ).getTime() || 0;

                const dataA =
                    new Date(
                        a.ultimo_envio
                    ).getTime() || 0;

                return dataB - dataA;
            })
            .slice(0, 4);

        elemento.innerHTML = ordenadas
            .map((conversa) => {
                const quantidadeNaoLidas =
                    naoLidas(conversa);

                return `
                    <a
                        class="item ${
                            quantidadeNaoLidas
                                ? "tem-nova"
                                : ""
                        }"
                        href="/pages/mensagens.html?conversa=${
                            encodeURIComponent(
                                conversa.id
                            )
                        }"
                    >
                        ${avatarConversa(
                            conversa.outro_usuario_nome,
                            conversa.outro_usuario_foto
                        )}

                        <div class="item-info">
                            <h4>
                                ${esc(
                                    conversa.outro_usuario_nome
                                    || "Usuário"
                                )}
                            </h4>

                            <p>
                                ${esc(
                                    conversa.ultima_mensagem
                                    || "Inicie a conversa..."
                                )}

                                ${
                                    conversa.veiculo_nome
                                        ? ` · ${esc(
                                            conversa.veiculo_nome
                                        )}`
                                        : ""
                                }
                            </p>
                        </div>

                        <div class="item-meta">
                            <span>
                                ${esc(
                                    horaCurta(
                                        conversa.ultimo_envio
                                    )
                                )}
                            </span>

                            ${
                                quantidadeNaoLidas
                                    ? `
                                        <span class="nova-badge">
                                            ${
                                                quantidadeNaoLidas > 99
                                                    ? "99+"
                                                    : quantidadeNaoLidas
                                            }
                                        </span>
                                    `
                                    : ""
                            }
                        </div>
                    </a>
                `;
            })
            .join("");
    }

    async function carregarResumo() {
        const resultados =
            await Promise.allSettled([
                get(
                    `/api/veiculos/usuario/${
                        encodeURIComponent(uid)
                    }`
                ),

                get(
                    `/api/mensagens/conversas?usuarioId=${
                        encodeURIComponent(uid)
                    }`
                ),

                API_FAVORITOS
                    ? get(
                        API_FAVORITOS
                        + encodeURIComponent(uid)
                    )
                    : Promise.reject(
                        new Error(
                            "API de favoritos indisponível"
                        )
                    )
            ]);

        const [
            resultadoVeiculos,
            resultadoConversas,
            resultadoFavoritos
        ] = resultados;

        if (
            resultadoVeiculos.status
            === "fulfilled"
        ) {
            const lista = Array.isArray(
                resultadoVeiculos.value.veiculos
            )
                ? resultadoVeiculos.value.veiculos
                : [];

            estado.anuncios = lista;

            stat("anuncios", lista.length);

            stat(
                "views",
                lista.reduce(
                    (total, item) =>
                        total
                        + Number(
                            item.total_visualizacoes
                            || 0
                        ),
                    0
                )
            );

            renderAnuncios(lista);
        } else {
            stat("anuncios");
            stat("views");

            if ($("listaAnuncios")) {
                $("listaAnuncios").innerHTML =
                    vazio(
                        "i-alert",
                        "Não foi possível carregar seus anúncios."
                    );
            }
        }

        if (
            resultadoConversas.status
            === "fulfilled"
        ) {
            const lista = Array.isArray(
                resultadoConversas.value.conversas
            )
                ? resultadoConversas.value.conversas
                : [];

            estado.conversas = lista;

            const totalNaoLidas = lista.reduce(
                (total, conversa) =>
                    total + naoLidas(conversa),
                0
            );

            stat(
                "naolidas",
                totalNaoLidas
            );

            if ($("pontoMsg")) {
                $("pontoMsg").hidden =
                    !totalNaoLidas;

                $("pontoMsg").textContent =
                    totalNaoLidas > 99
                        ? "99+"
                        : totalNaoLidas;
            }

            renderConversas(lista);
        } else {
            stat("naolidas");

            if ($("listaConversas")) {
                $("listaConversas").innerHTML =
                    vazio(
                        "i-alert",
                        "Não foi possível carregar suas conversas."
                    );
            }
        }

        if (
            resultadoFavoritos.status
            === "fulfilled"
        ) {
            const dados =
                resultadoFavoritos.value;

            const lista =
                Array.isArray(dados)
                    ? dados
                    : dados.favoritos
                        || dados.dados
                        || [];

            stat(
                "favoritos",
                lista.length
            );
        } else {
            stat("favoritos");
        }

        montarChecklist();
    }

    // ==========================================================
    // CHECKLIST DO PERFIL
    // ==========================================================

    function montarChecklist() {
        const itens = [
            {
                ok: Boolean(
                    usuario.fotoUrl
                    || usuario.foto_perfil
                ),
                txt: "Adicionar foto de perfil",
                acao: "foto"
            },
            {
                ok: Boolean(
                    String(
                        usuario.telefone || ""
                    ).trim()
                ),
                txt: "Cadastrar telefone de contato",
                href: "/pages/perfil.html"
            },
            {
                ok: Boolean(
                    estado.anuncios
                    && estado.anuncios.length
                ),
                txt: "Publicar o primeiro anúncio",
                href: "/pages/catalogo.html?tab=cadastrar"
            },
            {
                ok: Boolean(
                    estado.conversas
                    && estado.conversas.length
                ),
                txt: "Iniciar uma conversa",
                href: "/pages/catalogo.html"
            }
        ];

        const concluidos =
            itens.filter(
                (item) => item.ok
            ).length;

        const percentual = Math.round(
            (concluidos / itens.length) * 100
        );

        if ($("percentual")) {
            $("percentual").textContent =
                `${percentual}%`;
        }

        if ($("barraProgresso")) {
            $("barraProgresso").style.width =
                `${percentual}%`;
        }

        if (!$("checklist")) return;

        $("checklist").innerHTML = itens
            .map((item) => {
                const marca = `
                    <span class="check">
                        <svg class="i">
                            <use href="#i-check"></use>
                        </svg>
                    </span>
                `;

                const corpo = item.ok
                    ? `
                        <span>
                            ${marca}
                            ${esc(item.txt)}
                        </span>
                    `
                    : `
                        <a
                            href="${item.href || "#"}"
                            ${
                                item.acao
                                    ? `data-acao="${item.acao}"`
                                    : ""
                            }
                        >
                            ${marca}
                            ${esc(item.txt)}
                        </a>
                    `;

                return `
                    <li class="${
                        item.ok ? "feito" : ""
                    }">
                        ${corpo}
                    </li>
                `;
            })
            .join("");
    }

    $("checklist")?.addEventListener(
        "click",
        (evento) => {
            const linkFoto =
                evento.target.closest(
                    '[data-acao="foto"]'
                );

            if (!linkFoto) return;

            evento.preventDefault();
            inputFoto?.click();
        }
    );

    // ==========================================================
    // SINCRONIZAÇÃO COM O SERVIDOR
    // ==========================================================

    async function sincronizarConta() {
        try {
            const dados = await get(
                "/api/perfil/meu-perfil"
            );

            if (!dados.usuario) return;

            const {
                senha,
                token_verificacao,
                token_recuperacao,
                token_expiracao,
                ...dadosAtualizados
            } = dados.usuario;

            Object.assign(
                usuario,
                dadosAtualizados
            );

            delete usuario.senha;
            delete usuario.token_verificacao;
            delete usuario.token_recuperacao;
            delete usuario.token_expiracao;

            if (
                dadosAtualizados.foto_perfil
            ) {
                usuario.fotoUrl =
                    dadosAtualizados.foto_perfil;
            }

            salvarSessao();
            preencherPerfil();
        } catch (erro) {
            console.error(
                "Não foi possível sincronizar o perfil:",
                erro
            );
        }
    }

    // ==========================================================
    // SINCRONIZAÇÃO ENTRE ABAS
    // ==========================================================

    window.addEventListener(
        "storage",
        (evento) => {
            if (
                evento.key !== "usuario"
                && evento.key !== "usuario_logado"
                && evento.key !== null
            ) {
                return;
            }

            const novaSessao =
                lerSessao();

            if (!novaSessao) {
                window.location.replace(LOGIN);
                return;
            }

            const novoUsuarioId =
                novaSessao.dados.id
                ?? novaSessao.dados._id;

            if (
                String(novoUsuarioId)
                !== String(uid)
            ) {
                window.location.reload();
            }
        }
    );

    document.addEventListener(
        "visibilitychange",
        () => {
            if (!document.hidden) {
                carregarResumo();
            }
        }
    );

    // ==========================================================
    // INICIALIZAÇÃO
    // ==========================================================

    preencherPerfil();
    carregarResumo();
    sincronizarConta();
})();