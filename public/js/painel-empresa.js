"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const LOGIN_URL = "/pages/login.html";
    const PAINEL_CLIENTE = "/pages/painel-cliente.html";
    const TAMANHO_MAX_FOTO = 5 * 1024 * 1024;
    const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
    const $ = (id) => document.getElementById(id);

    // ==========================================
    // 1. SESSÃO
    // ==========================================
    function obterSessao() {
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
                    storage.removeItem(chave);
                }
            }
        }

        return null;
    }

    const sessao = obterSessao();

    if (!sessao) {
        window.location.replace(LOGIN_URL);
        return;
    }

    const usuario = sessao.dados;
    const tipo = String(usuario.tipo || "").toLowerCase().trim();

    if (tipo !== "empresa" && tipo !== "admin") {
        window.location.replace(PAINEL_CLIENTE);
        return;
    }

    const usuarioId = usuario.id ?? usuario._id ?? null;

    if (usuarioId === null) {
        window.location.replace(LOGIN_URL);
        return;
    }

    function getToken() {
        return localStorage.getItem("token")
            || sessionStorage.getItem("token");
    }

    function authHeaders() {
        const token = getToken();

        return {
            "Content-Type": "application/json",
            ...(token && {
                Authorization: `Bearer ${token}`
            })
        };
    }

    function salvarSessao() {
        try {
            sessao.storage.setItem(
                sessao.chave,
                JSON.stringify(usuario)
            );
        } catch {
            // Armazenamento cheio ou bloqueado.
        }
    }

    // ==========================================
    // 2. UTILITÁRIOS
    // ==========================================
    function toast(mensagem, tipoToast = "ok") {
        const area = $("toastArea");

        if (!area) {
            console.log(mensagem);
            return;
        }

        const elemento = document.createElement("div");

        elemento.className = `toast toast--${tipoToast}`;

        elemento.innerHTML = `
            <i class="fa-solid ${
                tipoToast === "erro"
                    ? "fa-circle-exclamation"
                    : "fa-circle-check"
            }"></i>
            <span></span>
        `;

        elemento.querySelector("span").textContent = mensagem;
        area.appendChild(elemento);

        requestAnimationFrame(() => {
            elemento.classList.add("visivel");
        });

        setTimeout(() => {
            elemento.classList.remove("visivel");

            setTimeout(() => {
                elemento.remove();
            }, 300);
        }, 3800);
    }

    function limparDadosDaSessao() {
        [localStorage, sessionStorage].forEach((storage) => {
            ["usuario", "usuario_logado", "token"].forEach((chave) => {
                storage.removeItem(chave);
            });
        });
    }

    function sessaoExpirada() {
        toast(
            "Sessão expirada. Faça login novamente.",
            "erro"
        );

        setTimeout(() => {
            limparDadosDaSessao();
            window.location.replace(LOGIN_URL);
        }, 1600);
    }

    if (!getToken()) {
        sessaoExpirada();
        return;
    }

    async function requisitar(
        url,
        opcoes = {},
        tempoMs = 15000
    ) {
        const controle = new AbortController();

        const relogio = setTimeout(() => {
            controle.abort();
        }, tempoMs);

        try {
            const resposta = await fetch(url, {
                ...opcoes,
                signal: controle.signal
            });

            const dados = await resposta
                .json()
                .catch(() => ({}));

            /*
             * Somente 401 encerra a sessão.
             * Um erro 403 será exibido sem desconectar o usuário.
             */
            if (resposta.status === 401) {
                sessaoExpirada();

                throw new Error(
                    "Sessão expirada. Faça login novamente."
                );
            }

            return {
                resp: resposta,
                dados
            };
        } catch (erro) {
            if (erro.name === "AbortError") {
                throw new Error(
                    "O servidor demorou para responder. Tente novamente."
                );
            }

            if (erro instanceof TypeError) {
                throw new Error(
                    "Erro de conexão. Verifique sua internet e tente novamente."
                );
            }

            throw erro;
        } finally {
            clearTimeout(relogio);
        }
    }

    // ==========================================
    // 3. MODAIS
    // ==========================================
    let modaisAbertos = 0;

    function abrirModal(elemento) {
        if (!elemento || !elemento.hidden) return;

        elemento.hidden = false;
        modaisAbertos++;

        document.body.classList.add("sem-scroll");
    }

    function fecharModal(elemento) {
        if (!elemento || elemento.hidden) return;

        elemento.hidden = true;

        modaisAbertos = Math.max(
            0,
            modaisAbertos - 1
        );

        if (!modaisAbertos) {
            document.body.classList.remove("sem-scroll");
        }
    }

    const modalConfirma = $("modalConfirma");

    let resolverConfirma = null;
    let focoAnterior = null;

    function confirmar({
        titulo,
        texto,
        botao = "Confirmar",
        perigo = true
    }) {
        return new Promise((resolve) => {
            if (resolverConfirma) {
                resolverConfirma(false);
            }

            resolverConfirma = resolve;
            focoAnterior = document.activeElement;

            $("confirmaTitulo").textContent = titulo;
            $("confirmaTexto").textContent = texto;
            $("confirmaOk").textContent = botao;

            abrirModal(modalConfirma);

            const elementoParaFocar = perigo
                ? $("confirmaCancelar")
                : $("confirmaOk");

            elementoParaFocar?.focus();
        });
    }

    function responderConfirma(resposta) {
        if (!resolverConfirma) return;

        const resolver = resolverConfirma;

        resolverConfirma = null;

        fecharModal(modalConfirma);

        if (focoAnterior?.focus) {
            focoAnterior.focus();
        }

        resolver(resposta);
    }

    $("confirmaOk")?.addEventListener("click", () => {
        responderConfirma(true);
    });

    $("confirmaCancelar")?.addEventListener("click", () => {
        responderConfirma(false);
    });

    modalConfirma?.addEventListener("click", (evento) => {
        if (evento.target === modalConfirma) {
            responderConfirma(false);
        }
    });

    // ==========================================
    // 4. CABEÇALHO DA EMPRESA
    // ==========================================
    const empresa = usuario.empresa || {};

    const nomeEmpresa =
        empresa.nome_empresa
        || usuario.nome_empresa
        || usuario.nome
        || "Empresa";

    if ($("nomeEmpresa")) {
        $("nomeEmpresa").textContent = nomeEmpresa;
    }

    document.title =
        `${nomeEmpresa} | Painel da Empresa | MotorFlex`;

    // ==========================================
    // 5. FOTO E AVATAR
    // ==========================================
    const imgPerfil = $("imgPerfil");
    const iniciaisEl = $("avatarIniciais");
    const btnRemoverFoto = $("btnRemoverFoto");
    const inputFoto = $("inputFotoPerfil");
    const avatarWrapper = $("avatarWrapper");

    let fotoAtual = null;
    let enviando = false;

    const partesNome = nomeEmpresa
        .split(/\s+/)
        .filter(Boolean);

    if (iniciaisEl) {
        iniciaisEl.textContent = partesNome.length
            ? (
                partesNome[0][0]
                + (
                    partesNome[1]
                        ? partesNome[1][0]
                        : ""
                )
            ).toUpperCase()
            : "E";
    }

    function resolverUrlFoto(foto) {
        if (!foto) return "";

        return /^(https?:\/\/|\/)/.test(foto)
            ? foto
            : `/uploads/${foto}`;
    }

    function comCacheBuster(url) {
        return `${url}${
            url.includes("?") ? "&" : "?"
        }v=${Date.now()}`;
    }

    function mostrarIniciais() {
        if (imgPerfil) {
            imgPerfil.onload = null;
            imgPerfil.onerror = null;
            imgPerfil.hidden = true;
            imgPerfil.removeAttribute("src");
        }

        if (iniciaisEl) {
            iniciaisEl.hidden = false;
        }

        if (btnRemoverFoto) {
            btnRemoverFoto.hidden = true;
        }
    }

    function mostrarFoto(url, mostrarRemover = true) {
        if (!imgPerfil || !url) {
            mostrarIniciais();
            return;
        }

        imgPerfil.onload = () => {
            imgPerfil.hidden = false;

            if (iniciaisEl) {
                iniciaisEl.hidden = true;
            }

            if (btnRemoverFoto) {
                btnRemoverFoto.hidden = !mostrarRemover;
            }
        };

        imgPerfil.onerror = () => {
            fotoAtual = null;
            mostrarIniciais();
        };

        imgPerfil.src = url;
    }

    function restaurarFoto() {
        if (fotoAtual) {
            mostrarFoto(fotoAtual);
        } else {
            mostrarIniciais();
        }
    }

    function setEnviando(sim) {
        enviando = sim;

        avatarWrapper?.classList.toggle(
            "enviando",
            sim
        );

        if ($("btnConfirmarRecorte")) {
            $("btnConfirmarRecorte").disabled = sim;
        }
    }

    const fotoSalva =
        usuario.fotoUrl
        || usuario.foto_perfil;

    if (fotoSalva) {
        fotoAtual = resolverUrlFoto(fotoSalva);
        mostrarFoto(fotoAtual);
    } else {
        mostrarIniciais();
    }

    // ==========================================
    // 6. MENU E SAÍDA
    // ==========================================
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

        const aberto = menuConfig?.classList.toggle(
            "mostrar"
        );

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

    function sair() {
        limparDadosDaSessao();
        window.location.replace(LOGIN_URL);
    }

    $("gatilhoSair")?.addEventListener(
        "click",
        async (evento) => {
            evento.preventDefault();

            fecharMenu();

            const confirmado = await confirmar({
                titulo: "Confirmar saída",
                texto: "Tem certeza que deseja encerrar sua sessão na MotorFlex?",
                botao: "Sim, sair"
            });

            if (confirmado) {
                sair();
            }
        }
    );

    // ==========================================
    // 7. UPLOAD COM RECORTE
    // ==========================================
    const modalRecorte = $("modalRecorte");
    const imagemParaCortar = $("imagemParaCortar");

    let cropper = null;

    function fecharRecorte() {
        fecharModal(modalRecorte);

        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        imagemParaCortar?.removeAttribute("src");

        if (inputFoto) {
            inputFoto.value = "";
        }
    }

    $("btnTrocarFoto")?.addEventListener("click", () => {
        if (!enviando) {
            inputFoto?.click();
        }
    });

    inputFoto?.addEventListener("change", (evento) => {
        const arquivo = evento.target.files?.[0];

        if (!arquivo) return;

        if (typeof Cropper === "undefined") {
            toast(
                "O editor de imagem não carregou. Verifique sua conexão e recarregue a página.",
                "erro"
            );

            inputFoto.value = "";
            return;
        }

        if (!TIPOS_FOTO.includes(arquivo.type)) {
            toast(
                "Envie uma imagem JPEG, PNG ou WEBP.",
                "erro"
            );

            inputFoto.value = "";
            return;
        }

        if (arquivo.size > TAMANHO_MAX_FOTO) {
            toast(
                "A foto deve ter no máximo 5 MB.",
                "erro"
            );

            inputFoto.value = "";
            return;
        }

        const leitor = new FileReader();

        leitor.onload = (eventoLeitura) => {
            if (!imagemParaCortar) return;

            imagemParaCortar.src =
                eventoLeitura.target.result;

            abrirModal(modalRecorte);

            if (cropper) {
                cropper.destroy();
            }

            cropper = new Cropper(
                imagemParaCortar,
                {
                    aspectRatio: 1,
                    viewMode: 1,
                    dragMode: "move",
                    autoCropArea: 0.8,
                    guides: false,
                    responsive: true,
                    toggleDragModeOnDblclick: false
                }
            );
        };

        leitor.onerror = () => {
            toast(
                "Não foi possível ler a imagem.",
                "erro"
            );

            inputFoto.value = "";
        };

        leitor.readAsDataURL(arquivo);
    });

    $("btnCancelarRecorte")?.addEventListener(
        "click",
        fecharRecorte
    );

    modalRecorte?.addEventListener("click", (evento) => {
        if (evento.target === modalRecorte) {
            fecharRecorte();
        }
    });

    $("btnConfirmarRecorte")?.addEventListener(
        "click",
        () => {
            if (!cropper || enviando) return;

            const canvas = cropper.getCroppedCanvas({
                width: 400,
                height: 400,
                imageSmoothingQuality: "high"
            });

            if (!canvas) {
                toast(
                    "Não foi possível recortar a imagem.",
                    "erro"
                );

                return;
            }

            setEnviando(true);

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    toast(
                        "Não foi possível processar a imagem.",
                        "erro"
                    );

                    setEnviando(false);
                    return;
                }

                const arquivo = new File(
                    [blob],
                    "foto-perfil.png",
                    { type: "image/png" }
                );

                const preview =
                    URL.createObjectURL(arquivo);

                fecharRecorte();
                mostrarFoto(preview, false);

                const formData = new FormData();

                /*
                 * O ID não é enviado.
                 * O backend identifica o usuário pelo token.
                 */
                formData.append(
                    "fotoPerfil",
                    arquivo
                );

                try {
                    const token = getToken();

                    const { resp, dados } =
                        await requisitar(
                            "/api/usuarios/upload-foto",
                            {
                                method: "POST",

                                /*
                                 * Não definir Content-Type aqui.
                                 * O navegador criará o multipart/form-data.
                                 */
                                headers: token
                                    ? {
                                        Authorization:
                                            `Bearer ${token}`
                                    }
                                    : {},

                                body: formData
                            },
                            30000
                        );

                    if (
                        !resp.ok
                        || dados.sucesso === false
                    ) {
                        throw new Error(
                            dados.mensagem
                            || dados.erro
                            || "Erro no servidor ao salvar a imagem."
                        );
                    }

                    const novaFoto =
                        dados.fotoUrl
                        || dados.foto_perfil
                        || dados.url;

                    if (!novaFoto) {
                        throw new Error(
                            "A foto foi enviada, mas o servidor não informou o novo endereço."
                        );
                    }

                    fotoAtual =
                        resolverUrlFoto(novaFoto);

                    usuario.fotoUrl = novaFoto;
                    usuario.foto_perfil = novaFoto;

                    salvarSessao();

                    mostrarFoto(
                        comCacheBuster(fotoAtual)
                    );

                    toast(
                        "Foto atualizada com sucesso!"
                    );
                } catch (erro) {
                    console.error(
                        "Falha no upload:",
                        erro
                    );

                    toast(
                        erro.message
                        || "Não foi possível salvar a foto.",
                        "erro"
                    );

                    restaurarFoto();
                } finally {
                    URL.revokeObjectURL(preview);
                    setEnviando(false);
                }
            }, "image/png");
        }
    );

    // ==========================================
    // 8. REMOVER FOTO
    // ==========================================
    btnRemoverFoto?.addEventListener(
        "click",
        async () => {
            if (enviando) return;

            const confirmado = await confirmar({
                titulo: "Remover foto?",
                texto: "A foto da empresa será removida e o painel voltará a mostrar as iniciais.",
                botao: "Sim, remover"
            });

            if (!confirmado) return;

            setEnviando(true);

            try {
                /*
                 * O ID não é enviado.
                 * O servidor identifica o usuário pelo token.
                 */
                const { resp, dados } =
                    await requisitar(
                        "/api/usuarios/remover-foto",
                        {
                            method: "DELETE",
                            headers: authHeaders()
                        }
                    );

                if (
                    !resp.ok
                    || dados.sucesso === false
                ) {
                    throw new Error(
                        dados.mensagem
                        || dados.erro
                        || `Não foi possível remover a foto. Erro ${resp.status}.`
                    );
                }

                fotoAtual = null;
                usuario.fotoUrl = null;
                usuario.foto_perfil = null;

                salvarSessao();
                mostrarIniciais();

                toast(
                    "Foto removida com sucesso!"
                );
            } catch (erro) {
                console.error(
                    "Falha ao remover foto:",
                    erro
                );

                toast(
                    erro.message
                    || "Erro de conexão ao remover a foto.",
                    "erro"
                );
            } finally {
                setEnviando(false);
            }
        }
    );

    // ==========================================
    // 9. TECLA ESC
    // ==========================================
    document.addEventListener("keydown", (evento) => {
        if (evento.key !== "Escape") return;

        if (
            modalConfirma
            && !modalConfirma.hidden
        ) {
            responderConfirma(false);
        } else if (
            modalRecorte
            && !modalRecorte.hidden
        ) {
            fecharRecorte();
        } else {
            fecharMenu();
        }
    });

    // ==========================================
    // 10. RESUMO
    // ==========================================
    function formatarNumero(numero) {
        return Number(numero).toLocaleString(
            "pt-BR"
        );
    }

    async function carregarResumo() {
        const elVeiculos = $("totalVeiculos");
        const elVisualizacoes =
            $("totalVisualizacoes");

        try {
            const { resp, dados } =
                await requisitar(
                    "/api/veiculos",
                    {
                        method: "GET",
                        headers: authHeaders()
                    }
                );

            if (
                !resp.ok
                || !dados.sucesso
                || !Array.isArray(dados.veiculos)
            ) {
                throw new Error(
                    dados.mensagem
                    || "Resposta inválida do servidor."
                );
            }

            const meusVeiculos =
                dados.veiculos.filter((veiculo) => {
                    return String(veiculo.usuario_id)
                        === String(usuarioId);
                });

            if (elVeiculos) {
                elVeiculos.textContent =
                    formatarNumero(
                        meusVeiculos.length
                    );
            }

            const obterVisualizacoes = (veiculo) => {
                return veiculo.total_visualizacoes
                    ?? veiculo.visualizacoes
                    ?? veiculo.views;
            };

            if (elVisualizacoes) {
                const possuiVisualizacoes =
                    meusVeiculos.some((veiculo) => {
                        return obterVisualizacoes(
                            veiculo
                        ) != null;
                    });

                elVisualizacoes.textContent =
                    possuiVisualizacoes
                        ? formatarNumero(
                            meusVeiculos.reduce(
                                (total, veiculo) => {
                                    return total
                                        + (
                                            Number(
                                                obterVisualizacoes(
                                                    veiculo
                                                )
                                            ) || 0
                                        );
                                },
                                0
                            )
                        )
                        : "–";
            }
        } catch (erro) {
            console.error(
                "Erro ao carregar resumo:",
                erro
            );

            if (elVeiculos) {
                elVeiculos.textContent = "–";
            }

            if (elVisualizacoes) {
                elVisualizacoes.textContent = "–";
            }
        } finally {
            $("stats")?.classList.remove(
                "carregando"
            );
        }
    }

    carregarResumo();
});