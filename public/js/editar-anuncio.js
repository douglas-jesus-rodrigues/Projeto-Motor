"use strict";

/* ==========================================================================
   MOTORFLEX — EDITAR ANÚNCIO
   Envia PUT multipart para /api/veiculos/:id.
   A identidade do proprietário vem exclusivamente do token.
   ========================================================================== */

(() => {
    const LOGIN =
        "/pages/login.html";

    const LISTA =
        "/pages/meus-anuncios.html";

    const MAX_FOTO_BYTES =
        5 * 1024 * 1024;

    const FOTO_MAX_LADO =
        1600;

    const $ = (id) =>
        document.getElementById(id);

    const ANO_MAX =
        new Date().getFullYear() + 1;

    const CAMPOS = [
        "marca",
        "modelo",
        "versao",
        "ano_fabricacao",
        "ano_modelo",
        "combustivel",
        "cambio",
        "carroceria",
        "portas",
        "cor",
        "quilometragem",
        "preco",
        "descricao"
    ];

    let me = null;
    let veiculoId = null;

    let original = "";
    let fotoOriginal = "";
    let fotoArquivo = null;
    let fotoBlobUrl = "";

    let salvando = false;
    let salvo = false;

    // ==========================================
    // SESSÃO
    // ==========================================

    function lerUsuario() {
        for (
            const storage
            of [localStorage, sessionStorage]
        ) {
            for (
                const chave
                of ["usuario", "usuario_logado"]
            ) {
                try {
                    const valor =
                        storage.getItem(chave);

                    if (!valor) continue;

                    const dados =
                        JSON.parse(valor);

                    const usuario =
                        dados
                        && typeof dados.usuario
                            === "object"
                            ? dados.usuario
                            : dados;

                    if (
                        usuario
                        && usuario.id != null
                    ) {
                        return {
                            ...usuario,

                            tipo: String(
                                usuario.tipo
                                || "individual"
                            ).toLowerCase()
                        };
                    }
                } catch {
                    // Tenta a próxima chave.
                }
            }
        }

        return null;
    }

    function token() {
        return localStorage.getItem("token")
            || sessionStorage.getItem("token");
    }

    function authHeaders() {
        const tokenAtual = token();

        return tokenAtual
            ? {
                Authorization:
                    `Bearer ${tokenAtual}`
            }
            : {};
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

    function sessaoExpirada() {
        limparSessao();

        toast(
            "Sua sessão expirou. Entre novamente.",
            "erro"
        );

        setTimeout(() => {
            window.location.replace(
                LOGIN
            );
        }, 1400);
    }

    // ==========================================
    // AVISOS
    // ==========================================

    function toast(
        mensagem,
        tipo = "ok"
    ) {
        const area =
            $("toastArea");

        if (!area) {
            console.log(mensagem);
            return;
        }

        const elemento =
            document.createElement("div");

        elemento.className =
            `toast ${
                tipo === "erro"
                    ? "erro"
                    : ""
            }`;

        elemento.textContent =
            (
                tipo === "erro"
                    ? "⚠️ "
                    : "✨ "
            )
            + mensagem;

        area.appendChild(
            elemento
        );

        requestAnimationFrame(() => {
            elemento.classList.add(
                "on"
            );
        });

        setTimeout(() => {
            elemento.classList.remove(
                "on"
            );

            setTimeout(() => {
                elemento.remove();
            }, 300);
        }, 3600);
    }

    // ==========================================
    // FUNÇÕES AUXILIARES
    // ==========================================

    function soDigitos(valorRecebido) {
        return String(
            valorRecebido ?? ""
        ).replace(/\D/g, "");
    }

    function milhar(numero) {
        if (
            numero === ""
            || numero == null
        ) {
            return "";
        }

        return String(numero).replace(
            /\B(?=(\d{3})+(?!\d))/g,
            "."
        );
    }

    function valor(id) {
        return (
            $(id)?.value ?? ""
        ).trim();
    }

    function brl(numero) {
        return "R$ "
            + Number(
                numero || 0
            ).toLocaleString(
                "pt-BR",
                {
                    maximumFractionDigits: 0
                }
            );
    }

    function urlFoto(foto) {
        if (!foto) return "";

        return /^(\/|https?:)/.test(
            foto
        )
            ? foto
            : `/uploads/${foto}`;
    }

    function setSelect(
        id,
        valorRecebido
    ) {
        const elemento =
            $(id);

        if (
            !elemento
            || valorRecebido == null
            || valorRecebido === ""
        ) {
            return;
        }

        const existe =
            [...elemento.options].some(
                (opcao) => {
                    return opcao.value
                        === String(
                            valorRecebido
                        );
                }
            );

        if (!existe) {
            const opcao =
                document.createElement(
                    "option"
                );

            opcao.value =
                String(valorRecebido);

            opcao.textContent =
                String(valorRecebido);

            elemento.appendChild(
                opcao
            );
        }

        elemento.value =
            String(valorRecebido);
    }

    function snapshot() {
        return JSON.stringify(
            CAMPOS.map(valor)
        );
    }

    function sujo() {
        return (
            snapshot() !== original
            || Boolean(fotoArquivo)
        );
    }

    function atualizarEstado() {
        const estado =
            $("estadoSalvo");

        if (!estado) return;

        const alterado =
            sujo();

        estado.textContent =
            alterado
                ? "Alterações não salvas"
                : "Sem alterações";

        estado.classList.toggle(
            "sujo",
            alterado
        );
    }

    function atualizarResumo() {
        const titulo =
            `${valor("marca")} ${valor("modelo")}`
                .trim();

        if ($("resumoTitulo")) {
            $("resumoTitulo").textContent =
                titulo || "—";
        }

        if ($("resumoVersao")) {
            $("resumoVersao").textContent =
                valor("versao");
        }

        if ($("resumoPreco")) {
            $("resumoPreco").textContent =
                brl(
                    soDigitos(
                        valor("preco")
                    )
                );
        }

        const chips = [];

        const anoFabricacao =
            valor("ano_fabricacao");

        const anoModelo =
            valor("ano_modelo");

        if (anoFabricacao) {
            chips.push(
                anoModelo
                && anoModelo !== anoFabricacao
                    ? `${anoFabricacao}/${anoModelo}`
                    : anoFabricacao
            );
        }

        const quilometragem =
            soDigitos(
                valor("quilometragem")
            );

        if (quilometragem) {
            chips.push(
                `${milhar(quilometragem)} km`
            );
        }

        const combustivel =
            $("combustivel")
                ?.selectedOptions?.[0];

        if (
            combustivel
            && combustivel.value
        ) {
            chips.push(
                combustivel.textContent
            );
        }

        const cambio =
            $("cambio")
                ?.selectedOptions?.[0];

        if (
            cambio
            && cambio.value
        ) {
            chips.push(
                cambio.textContent
            );
        }

        if (valor("carroceria")) {
            chips.push(
                valor("carroceria")
            );
        }

        if (valor("cor")) {
            chips.push(
                valor("cor")
            );
        }

        const resumoChips =
            $("resumoChips");

        if (!resumoChips) return;

        resumoChips.innerHTML = "";

        chips.forEach((texto) => {
            const elemento =
                document.createElement(
                    "span"
                );

            elemento.className =
                "chip";

            elemento.textContent =
                texto;

            resumoChips.appendChild(
                elemento
            );
        });
    }

    // ==========================================
    // VALIDAÇÃO
    // ==========================================

    function erro(
        id,
        mensagem
    ) {
        const campo =
            $(id);

        const grupo =
            campo?.closest(
                ".input-group"
            );

        if (!grupo) return;

        grupo.classList.toggle(
            "invalido",
            Boolean(mensagem)
        );

        grupo
            .querySelector(
                ".msg-erro"
            )
            ?.remove();

        if (mensagem) {
            const paragrafo =
                document.createElement(
                    "p"
                );

            paragrafo.className =
                "msg-erro";

            paragrafo.textContent =
                mensagem;

            grupo.appendChild(
                paragrafo
            );
        }
    }

    function validar() {
        const erros = {};

        if (!valor("marca")) {
            erros.marca =
                "Informe a marca.";
        }

        if (!valor("modelo")) {
            erros.modelo =
                "Informe o modelo.";
        }

        const anoFabricacao =
            Number(
                valor(
                    "ano_fabricacao"
                )
            );

        const anoModelo =
            Number(
                valor(
                    "ano_modelo"
                )
            );

        if (
            !anoFabricacao
            || anoFabricacao < 1900
            || anoFabricacao > ANO_MAX
        ) {
            erros.ano_fabricacao =
                `Ano entre 1900 e ${ANO_MAX}.`;
        }

        if (
            !anoModelo
            || anoModelo < 1900
            || anoModelo > ANO_MAX + 1
        ) {
            erros.ano_modelo =
                `Ano entre 1900 e ${ANO_MAX + 1}.`;
        } else if (
            anoFabricacao
            && (
                anoModelo < anoFabricacao
                || anoModelo
                    > anoFabricacao + 1
            )
        ) {
            erros.ano_modelo =
                "O ano do modelo deve ser igual ou até um ano maior que o de fabricação.";
        }

        if (!valor("combustivel")) {
            erros.combustivel =
                "Selecione o combustível.";
        }

        if (!valor("cambio")) {
            erros.cambio =
                "Selecione o câmbio.";
        }

        if (
            !Number(
                soDigitos(
                    valor("preco")
                )
            )
        ) {
            erros.preco =
                "Informe um valor maior que zero.";
        }

        CAMPOS.forEach((id) => {
            erro(
                id,
                erros[id]
            );
        });

        const primeiro =
            Object.keys(erros)[0];

        if (primeiro) {
            $(primeiro)?.focus();

            $(primeiro)?.scrollIntoView({
                block: "center",
                behavior: "smooth"
            });
        }

        return !primeiro;
    }

    // ==========================================
    // MÁSCARAS DOS CAMPOS
    // ==========================================

    function mascaras() {
        [
            "ano_fabricacao",
            "ano_modelo"
        ].forEach((id) => {
            $(id)?.addEventListener(
                "input",
                (evento) => {
                    evento.target.value =
                        soDigitos(
                            evento.target.value
                        ).slice(0, 4);
                }
            );
        });

        [
            "preco",
            "quilometragem"
        ].forEach((id) => {
            $(id)?.addEventListener(
                "input",
                (evento) => {
                    const digitos =
                        soDigitos(
                            evento.target.value
                        ).replace(
                            /^0+(?=\d)/,
                            ""
                        );

                    evento.target.value =
                        milhar(digitos);
                }
            );
        });

        $("descricao")?.addEventListener(
            "input",
            () => {
                if (
                    $("contadorDescricao")
                ) {
                    $("contadorDescricao")
                        .textContent =
                        `${
                            $("descricao")
                                .value
                                .length
                        } / 1000`;
                }
            }
        );

        const formulario =
            $("form-editar-anuncio");

        formulario?.addEventListener(
            "click",
            (evento) => {
                const botao =
                    evento.target.closest(
                        ".btn-step"
                    );

                if (!botao) return;

                const input =
                    $(botao.dataset.alvo);

                if (!input) return;

                const passo =
                    Number(
                        botao.dataset.passo
                    );

                const minimo =
                    Number(
                        botao.dataset.min
                    );

                const base =
                    Number(
                        soDigitos(
                            input.value
                        )
                    )
                    || (
                        minimo === 1900
                            ? new Date()
                                .getFullYear()
                            : 0
                    );

                const maximo =
                    botao.dataset.alvo
                        .startsWith("ano")
                        ? ANO_MAX + 1
                        : Infinity;

                const novo =
                    Math.min(
                        maximo,
                        Math.max(
                            minimo,
                            base + passo
                        )
                    );

                input.value =
                    botao.dataset.alvo
                        === "quilometragem"
                        ? milhar(novo)
                        : String(novo);

                input.dispatchEvent(
                    new Event(
                        "input",
                        {
                            bubbles: true
                        }
                    )
                );
            }
        );
    }

    // ==========================================
    // DADOS AUXILIARES
    // ==========================================

    async function carregarOpcoes() {
        async function preencher(
            url,
            id,
            rotulo
        ) {
            const select =
                $(id);

            if (!select) return;

            try {
                const resposta =
                    await fetch(url);

                const dados =
                    await resposta
                        .json()
                        .catch(() => ({}));

                if (!resposta.ok) {
                    throw new Error(
                        dados.mensagem
                        || `Erro ${resposta.status}`
                    );
                }

                const lista =
                    Array.isArray(dados)
                        ? dados
                        : dados.combustiveis
                            || dados.cambios
                            || dados.dados
                            || [];

                select.innerHTML = "";

                const primeiraOpcao =
                    document.createElement(
                        "option"
                    );

                primeiraOpcao.value = "";
                primeiraOpcao.textContent =
                    rotulo;

                select.appendChild(
                    primeiraOpcao
                );

                lista.forEach((opcao) => {
                    const elemento =
                        document.createElement(
                            "option"
                        );

                    elemento.value =
                        opcao.id;

                    elemento.textContent =
                        opcao.nome;

                    select.appendChild(
                        elemento
                    );
                });
            } catch (erroCarregamento) {
                console.error(
                    "Erro ao carregar:",
                    url,
                    erroCarregamento
                );

                select.innerHTML =
                    '<option value="">Erro ao carregar</option>';
            }
        }

        await Promise.all([
            preencher(
                "/api/combustiveis",
                "combustivel",
                "Selecione o combustível..."
            ),

            preencher(
                "/api/cambios",
                "cambio",
                "Selecione o câmbio..."
            )
        ]);
    }

    // ==========================================
    // VEÍCULO
    // ==========================================

    function mostrarFoto(
        src,
        nova
    ) {
        const imagem =
            $("fotoPreview");

        if (imagem) {
            if (src) {
                imagem.src = src;
                imagem.hidden = false;
            } else {
                imagem.removeAttribute(
                    "src"
                );

                imagem.hidden = true;
            }
        }

        if ($("fotoVazia")) {
            $("fotoVazia").hidden =
                Boolean(src);
        }

        if ($("fotoBadge")) {
            $("fotoBadge").hidden =
                !nova;
        }

        if ($("btnDesfazerFoto")) {
            $("btnDesfazerFoto").hidden =
                !nova;
        }

        if ($("btnTrocarFoto")) {
            $("btnTrocarFoto").textContent =
                src
                    ? "Trocar foto"
                    : "Adicionar foto";
        }
    }

    async function carregarVeiculo() {
        try {
            const resposta =
                await fetch(
                    `/api/veiculos/${
                        encodeURIComponent(
                            veiculoId
                        )
                    }`,
                    {
                        headers:
                            authHeaders()
                    }
                );

            const dados =
                await resposta
                    .json()
                    .catch(() => ({}));

            if (
                resposta.status === 401
            ) {
                sessaoExpirada();
                return false;
            }

            const veiculo =
                dados.veiculo || null;

            if (
                !resposta.ok
                || !veiculo
            ) {
                throw new Error(
                    dados.mensagem
                    || "Veículo não encontrado."
                );
            }

            /*
             * Esta verificação melhora a experiência,
             * mas a autorização real também é feita
             * pelo backend usando o token.
             */
            if (
                veiculo.usuario_id != null
                && String(
                    veiculo.usuario_id
                ) !== String(me.id)
                && me.tipo !== "admin"
            ) {
                toast(
                    "Você não tem permissão para editar este anúncio.",
                    "erro"
                );

                setTimeout(() => {
                    window.location.replace(
                        LISTA
                    );
                }, 1500);

                return false;
            }

            $("veiculo-id").value =
                veiculo.id;

            $("marca").value =
                veiculo.marca
                || veiculo.marca_nome
                || "";

            $("modelo").value =
                veiculo.modelo
                || veiculo.modelo_nome
                || "";

            $("versao").value =
                veiculo.versao || "";

            $("ano_fabricacao").value =
                veiculo.ano_fabricacao
                || veiculo.ano
                || "";

            $("ano_modelo").value =
                veiculo.ano_modelo
                || "";

            $("quilometragem").value =
                milhar(
                    veiculo.quilometragem
                    ?? ""
                );

            $("preco").value =
                milhar(
                    Math.round(
                        Number(
                            veiculo.preco
                        ) || 0
                    ) || ""
                );

            $("cor").value =
                veiculo.cor || "";

            $("descricao").value =
                veiculo.descricao || "";

            setSelect(
                "combustivel",
                veiculo.tipo_combustivel_id
            );

            setSelect(
                "cambio",
                veiculo.tipo_transmissao_id
            );

            setSelect(
                "carroceria",
                veiculo.carroceria
            );

            setSelect(
                "portas",
                veiculo.portas
            );

            fotoOriginal =
                urlFoto(
                    veiculo.imagem
                );

            mostrarFoto(
                fotoOriginal,
                false
            );

            if (
                $("contadorDescricao")
            ) {
                $("contadorDescricao")
                    .textContent =
                    `${
                        $("descricao")
                            .value
                            .length
                    } / 1000`;
            }

            return true;
        } catch (erroCarregamento) {
            console.error(
                "Erro ao carregar veículo:",
                erroCarregamento
            );

            toast(
                erroCarregamento.message
                || "Erro ao carregar o anúncio.",
                "erro"
            );

            setTimeout(() => {
                window.location.replace(
                    LISTA
                );
            }, 1800);

            return false;
        }
    }

    // ==========================================
    // IMAGEM DO VEÍCULO
    // ==========================================

    function comprimir(file) {
        return new Promise((resolve) => {
            if (
                file.size < 700 * 1024
                && /jpe?g|webp/.test(
                    file.type
                )
            ) {
                resolve(file);
                return;
            }

            const url =
                URL.createObjectURL(file);

            const imagem =
                new Image();

            imagem.onload = () => {
                const escala =
                    Math.min(
                        1,
                        FOTO_MAX_LADO
                        / Math.max(
                            imagem.width,
                            imagem.height
                        )
                    );

                const canvas =
                    document.createElement(
                        "canvas"
                    );

                canvas.width =
                    Math.round(
                        imagem.width
                        * escala
                    );

                canvas.height =
                    Math.round(
                        imagem.height
                        * escala
                    );

                const contexto =
                    canvas.getContext(
                        "2d"
                    );

                contexto.fillStyle =
                    "#ffffff";

                contexto.fillRect(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

                contexto.drawImage(
                    imagem,
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

                URL.revokeObjectURL(
                    url
                );

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve(file);
                            return;
                        }

                        const nome =
                            file.name.replace(
                                /\.\w+$/,
                                ""
                            ) + ".jpg";

                        resolve(
                            new File(
                                [blob],
                                nome,
                                {
                                    type:
                                        "image/jpeg"
                                }
                            )
                        );
                    },
                    "image/jpeg",
                    0.86
                );
            };

            imagem.onerror = () => {
                URL.revokeObjectURL(
                    url
                );

                resolve(file);
            };

            imagem.src = url;
        });
    }

    async function escolherFoto(file) {
        if (!file) return;

        if (
            !/^image\/(jpeg|png|webp)$/.test(
                file.type
            )
        ) {
            toast(
                "Use uma imagem JPG, PNG ou WebP.",
                "erro"
            );

            return;
        }

        const arquivoPronto =
            await comprimir(file);

        if (
            arquivoPronto.size
            > MAX_FOTO_BYTES
        ) {
            toast(
                "A imagem continua acima de 5 MB. Escolha outra.",
                "erro"
            );

            return;
        }

        if (fotoBlobUrl) {
            URL.revokeObjectURL(
                fotoBlobUrl
            );
        }

        fotoArquivo =
            arquivoPronto;

        fotoBlobUrl =
            URL.createObjectURL(
                arquivoPronto
            );

        mostrarFoto(
            fotoBlobUrl,
            true
        );

        atualizarEstado();
    }

    function desfazerFoto() {
        fotoArquivo = null;

        if (fotoBlobUrl) {
            URL.revokeObjectURL(
                fotoBlobUrl
            );

            fotoBlobUrl = "";
        }

        if ($("inputFoto")) {
            $("inputFoto").value = "";
        }

        mostrarFoto(
            fotoOriginal,
            false
        );

        atualizarEstado();
    }

    function eventosFoto() {
        const dropzone =
            $("dropzone");

        const input =
            $("inputFoto");

        if (!dropzone || !input) {
            return;
        }

        const abrir = () => {
            input.click();
        };

        dropzone.addEventListener(
            "click",
            abrir
        );

        dropzone.addEventListener(
            "keydown",
            (evento) => {
                if (
                    evento.key === "Enter"
                    || evento.key === " "
                ) {
                    evento.preventDefault();
                    abrir();
                }
            }
        );

        $("btnTrocarFoto")
            ?.addEventListener(
                "click",
                (evento) => {
                    /*
                     * Evita o clique subir até a
                     * dropzone e abrir duas vezes.
                     */
                    evento.stopPropagation();
                    abrir();
                }
            );

        $("btnDesfazerFoto")
            ?.addEventListener(
                "click",
                (evento) => {
                    evento.stopPropagation();
                    desfazerFoto();
                }
            );

        input.addEventListener(
            "change",
            () => {
                escolherFoto(
                    input.files?.[0]
                );
            }
        );

        [
            "dragenter",
            "dragover"
        ].forEach((eventoNome) => {
            dropzone.addEventListener(
                eventoNome,
                (evento) => {
                    evento.preventDefault();

                    dropzone.classList.add(
                        "arrastando"
                    );
                }
            );
        });

        [
            "dragleave",
            "drop"
        ].forEach((eventoNome) => {
            dropzone.addEventListener(
                eventoNome,
                (evento) => {
                    evento.preventDefault();

                    dropzone.classList.remove(
                        "arrastando"
                    );
                }
            );
        });

        dropzone.addEventListener(
            "drop",
            (evento) => {
                escolherFoto(
                    evento.dataTransfer
                        ?.files?.[0]
                );
            }
        );
    }

    // ==========================================
    // SALVAR ALTERAÇÕES
    // ==========================================

    function configurarBotao(
        carregando
    ) {
        const botao =
            $("btnSalvar");

        if (!botao) return;

        botao.disabled =
            carregando;

        const spinner =
            botao.querySelector(
                ".spinner"
            );

        if (spinner) {
            spinner.hidden =
                !carregando;
        }

        const texto =
            botao.querySelector(
                ".txt"
            );

        if (texto) {
            texto.textContent =
                carregando
                    ? "Salvando..."
                    : "Salvar alterações";
        }
    }

    async function salvar() {
        if (salvando) return;

        const usuarioAtual =
            lerUsuario();

        if (
            !usuarioAtual
            || !token()
            || String(
                usuarioAtual.id
            ) !== String(me.id)
        ) {
            sessaoExpirada();
            return;
        }

        if (!validar()) {
            return;
        }

        salvando = true;

        configurarBotao(
            true
        );

        const formData =
            new FormData();

        /*
         * usuario_id não é enviado.
         * O backend obtém o proprietário
         * exclusivamente pelo token.
         */
        formData.append(
            "marca",
            valor("marca")
        );

        formData.append(
            "modelo",
            valor("modelo")
        );

        formData.append(
            "versao",
            valor("versao")
        );

        formData.append(
            "ano_fabricacao",
            valor("ano_fabricacao")
        );

        formData.append(
            "ano_modelo",
            valor("ano_modelo")
        );

        formData.append(
            "combustivel",
            valor("combustivel")
        );

        formData.append(
            "cambio",
            valor("cambio")
        );

        formData.append(
            "carroceria",
            valor("carroceria")
        );

        formData.append(
            "portas",
            valor("portas")
        );

        formData.append(
            "cor",
            valor("cor")
        );

        formData.append(
            "quilometragem",
            soDigitos(
                valor("quilometragem")
            ) || "0"
        );

        formData.append(
            "preco",
            soDigitos(
                valor("preco")
            )
        );

        formData.append(
            "descricao",
            valor("descricao")
        );

        if (fotoArquivo) {
            formData.append(
                "imagem",
                fotoArquivo,
                fotoArquivo.name
            );
        }

        try {
            const resposta =
                await fetch(
                    `/api/veiculos/${
                        encodeURIComponent(
                            veiculoId
                        )
                    }`,
                    {
                        method: "PUT",

                        /*
                         * Não definir Content-Type.
                         * O navegador gera o multipart.
                         */
                        headers:
                            authHeaders(),

                        body: formData
                    }
                );

            const dados =
                await resposta
                    .json()
                    .catch(() => ({}));

            if (
                resposta.status === 401
            ) {
                sessaoExpirada();
                return;
            }

            /*
             * 403 não encerra a sessão.
             * Apenas informa que o usuário
             * não é proprietário/admin.
             */
            if (
                !resposta.ok
                || dados.sucesso === false
            ) {
                throw new Error(
                    dados.mensagem
                    || dados.erro
                    || "Erro ao atualizar o anúncio."
                );
            }

            salvo = true;

            toast(
                dados.mensagem
                || "Anúncio atualizado com sucesso!"
            );

            setTimeout(() => {
                window.location.href =
                    LISTA;
            }, 1200);
        } catch (erroSalvar) {
            console.error(
                "Erro ao salvar:",
                erroSalvar
            );

            toast(
                erroSalvar.message
                || "Erro de conexão.",
                "erro"
            );

            configurarBotao(
                false
            );
        } finally {
            salvando = false;
        }
    }

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================

    document.addEventListener(
        "DOMContentLoaded",
        async () => {
            me = lerUsuario();

            if (
                !me
                || !token()
            ) {
                limparSessao();

                window.location.replace(
                    LOGIN
                );

                return;
            }

            veiculoId =
                new URLSearchParams(
                    window.location.search
                ).get("id");

            if (!veiculoId) {
                toast(
                    "ID do veículo não encontrado!",
                    "erro"
                );

                setTimeout(() => {
                    window.location.replace(
                        LISTA
                    );
                }, 1500);

                return;
            }

            mascaras();
            eventosFoto();

            await carregarOpcoes();

            const carregado =
                await carregarVeiculo();

            if (!carregado) {
                return;
            }

            original =
                snapshot();

            atualizarResumo();
            atualizarEstado();

            $("form-editar-anuncio")
                ?.classList.remove(
                    "carregando"
                );

            const formulario =
                $("form-editar-anuncio");

            formulario?.addEventListener(
                "input",
                (evento) => {
                    if (
                        evento.target.closest(
                            ".input-group.invalido"
                        )
                    ) {
                        erro(
                            evento.target.id,
                            ""
                        );
                    }

                    atualizarResumo();
                    atualizarEstado();
                }
            );

            formulario?.addEventListener(
                "change",
                () => {
                    atualizarResumo();
                    atualizarEstado();
                }
            );

            formulario?.addEventListener(
                "submit",
                (evento) => {
                    evento.preventDefault();
                    salvar();
                }
            );

            document.addEventListener(
                "keydown",
                (evento) => {
                    if (
                        (
                            evento.ctrlKey
                            || evento.metaKey
                        )
                        && evento.key
                            .toLowerCase()
                            === "s"
                    ) {
                        evento.preventDefault();

                        formulario
                            ?.requestSubmit();
                    }
                }
            );

            window.addEventListener(
                "beforeunload",
                (evento) => {
                    if (
                        !salvo
                        && sujo()
                    ) {
                        evento.preventDefault();

                        evento.returnValue =
                            "";
                    }
                }
            );

            const sair =
                (evento) => {
                    if (
                        sujo()
                        && !window.confirm(
                            "Você tem alterações não salvas. Deseja sair mesmo assim?"
                        )
                    ) {
                        evento.preventDefault();
                    } else {
                        salvo = true;
                    }
                };

            $("btnCancelar")
                ?.addEventListener(
                    "click",
                    sair
                );

            $("linkVoltar")
                ?.addEventListener(
                    "click",
                    sair
                );
        }
    );
})();