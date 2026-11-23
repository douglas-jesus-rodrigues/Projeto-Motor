/* ==========================================================================
   MOTORFLEX — PAINEL ADMINISTRATIVO
   ========================================================================== */

(() => {
    "use strict";

    const API_RESUMO = "/api/admin/resumo";
    const LOGIN_URL = "/pages/login.html";
    const CHAVES_USUARIO = ["usuario", "usuario_logado"];
    const CHAVE_TEMA = "mf_admin_tema";
    const CHAVE_AUTO = "mf_admin_auto";
    const TEMPO_AUTO = 60000;
    const TEMPO_LIMITE = 15000;

    const $ = (id) => document.getElementById(id);
    const numero = new Intl.NumberFormat("pt-BR");
    const relativo = new Intl.RelativeTimeFormat("pt-BR", {
        numeric: "auto"
    });

    const movimentoReduzido = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    let carregando = false;
    let possuiDados = false;
    let ultimaAtualizacao = 0;
    let intervaloAutomatico = null;
    let comandosFiltrados = [];
    let comandoSelecionado = 0;
    const modaisAbertos = [];

    function escapar(valor) {
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

    function normalizar(valor) {
        return String(valor ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function formatarDinheiro(valor) {
        const preco = Number(valor);

        if (!Number.isFinite(preco)) {
            return "—";
        }

        return preco.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 0
        });
    }

    function formatarTempo(valor) {
        const data = Date.parse(valor);

        if (!data) {
            return "";
        }

        const segundos = Math.round(
            (data - Date.now()) / 1000
        );

        const absoluto = Math.abs(segundos);

        if (absoluto < 60) {
            return "agora";
        }

        if (absoluto < 3600) {
            return relativo.format(
                Math.round(segundos / 60),
                "minute"
            );
        }

        if (absoluto < 86400) {
            return relativo.format(
                Math.round(segundos / 3600),
                "hour"
            );
        }

        if (absoluto < 2592000) {
            return relativo.format(
                Math.round(segundos / 86400),
                "day"
            );
        }

        return new Date(data).toLocaleDateString("pt-BR");
    }

    function normalizarFoto(valor) {
        if (typeof valor !== "string") {
            return null;
        }

        let caminho = valor.trim();

        if (
            !caminho ||
            ["null", "undefined", "false", "0", "nan"].includes(
                caminho.toLowerCase()
            )
        ) {
            return null;
        }

        if (
            /^(data:image\/|blob:|https?:\/\/|\/\/)/i.test(caminho)
        ) {
            return caminho;
        }

        caminho = caminho
            .replace(/\\/g, "/")
            .replace(/^\.\//, "");

        if (caminho.startsWith("/")) {
            return caminho;
        }

        if (caminho.startsWith("uploads/")) {
            return `/${caminho}`;
        }

        const caminhoSeguro = caminho
            .split("/")
            .map((parte) => encodeURIComponent(parte))
            .join("/");

        return `/uploads/${caminhoSeguro}`;
    }

    function iniciais(nome) {
        return (
            String(nome || "?")
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((parte) => parte.charAt(0))
                .join("")
                .toUpperCase() || "?"
        );
    }

    function corDoNome(nome) {
        let tonalidade = 0;

        for (const caractere of String(nome)) {
            tonalidade =
                (tonalidade * 31 + caractere.charCodeAt(0)) %
                360;
        }

        return `hsl(${tonalidade} 55% 42%)`;
    }

    function icone(id) {
        return (
            `<svg class="i" aria-hidden="true">` +
            `<use href="#${id}"></use>` +
            `</svg>`
        );
    }

    function lerUsuario() {
        const armazenamentos = [
            localStorage,
            sessionStorage
        ];

        for (const armazenamento of armazenamentos) {
            for (const chave of CHAVES_USUARIO) {
                const conteudo = armazenamento.getItem(chave);

                if (
                    !conteudo ||
                    conteudo === "undefined" ||
                    conteudo === "null"
                ) {
                    continue;
                }

                try {
                    const objeto = JSON.parse(conteudo);

                    const usuario =
                        objeto?.usuario ||
                        objeto?.user ||
                        objeto?.dados?.usuario ||
                        objeto?.data?.usuario ||
                        objeto;

                    if (
                        usuario &&
                        typeof usuario === "object"
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

    function usuarioEhAdmin(usuario) {
        const tipo = normalizar(usuario?.tipo);
        const cargo = normalizar(usuario?.cargo);

        const permitidos = [
            "admin",
            "super_admin",
            "superadmin"
        ];

        return (
            permitidos.includes(tipo) ||
            permitidos.includes(cargo)
        );
    }

    function rotaDoUsuario(usuario) {
        return normalizar(usuario?.tipo) === "empresa"
            ? "/pages/painel-empresa.html"
            : "/pages/painel-cliente.html";
    }

    function obterToken() {
        return (
            localStorage.getItem("token") ||
            sessionStorage.getItem("token") ||
            ""
        );
    }

    function limparSessao() {
        [
            ...CHAVES_USUARIO,
            "token"
        ].forEach((chave) => {
            localStorage.removeItem(chave);
            sessionStorage.removeItem(chave);
        });
    }

    function mostrarToast(mensagem, tipo = "ok") {
        const area = $("toastArea");

        if (!area) {
            return;
        }

        while (area.children.length >= 3) {
            area.firstElementChild.remove();
        }

        const toast = document.createElement("div");

        toast.className =
            `toast${tipo === "ok" ? "" : ` ${tipo}`}`;

        toast.textContent = mensagem;
        area.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add("on");
        });

        window.setTimeout(() => {
            toast.classList.remove("on");

            window.setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3200);
    }

    function abrirModal(modal) {
        if (
            !modal ||
            modal.classList.contains("mostrar-modal")
        ) {
            return;
        }

        modal._focoAnterior = document.activeElement;
        modal.classList.add("mostrar-modal");
        modaisAbertos.push(modal);
        document.body.classList.add("travado");
    }

    function fecharModal(modal) {
        if (
            !modal ||
            !modal.classList.contains("mostrar-modal")
        ) {
            return;
        }

        modal.classList.remove("mostrar-modal");

        const indice = modaisAbertos.indexOf(modal);

        if (indice >= 0) {
            modaisAbertos.splice(indice, 1);
        }

        if (!modaisAbertos.length) {
            document.body.classList.remove("travado");
        }

        modal._focoAnterior?.focus?.();
    }

    function preencherCabecalho(usuario) {
        const nomeCompleto =
            [
                usuario.nome,
                usuario.sobrenome
            ]
                .filter(Boolean)
                .join(" ") ||
            "Administrador";

        const primeiroNome = nomeCompleto
            .trim()
            .split(/\s+/)[0];

        const hora = new Date().getHours();

        const saudacao =
            hora < 12
                ? "Bom dia"
                : hora < 18
                    ? "Boa tarde"
                    : "Boa noite";

        const data = new Date().toLocaleDateString(
            "pt-BR",
            {
                weekday: "long",
                day: "numeric",
                month: "long"
            }
        );

        if ($("saudacao")) {
            $("saudacao").textContent =
                `${saudacao} · ${data}`;
        }

        if ($("nomeAdmin")) {
            $("nomeAdmin").innerHTML =
                `Olá, <span class="nome-destaque">` +
                `${escapar(primeiroNome)}` +
                `</span>`;
        }

        if ($("miniNome")) {
            $("miniNome").textContent = primeiroNome;
        }

        if ($("ddNome")) {
            $("ddNome").textContent = nomeCompleto;
        }

        if ($("ddEmail")) {
            $("ddEmail").textContent =
                usuario.email || "";
        }

        const avatar = $("avatarMini");

        if (!avatar) {
            return;
        }

        avatar.textContent =
            primeiroNome.charAt(0).toUpperCase();

        const foto = normalizarFoto(
            usuario.foto_perfil ||
            usuario.foto_url ||
            usuario.fotoUrl
        );

        if (!foto) {
            return;
        }

        const imagem = new Image();

        imagem.className = "av-mini-img";
        imagem.alt = "";

        imagem.addEventListener(
            "load",
            () => {
                avatar.textContent = "";
                avatar.appendChild(imagem);
            },
            { once: true }
        );

        imagem.src = foto;
    }

    function temaAtual() {
        return (
            document.documentElement.dataset.tema ===
            "claro"
                ? "claro"
                : "escuro"
        );
    }

    function aplicarTema(tema) {
        document.documentElement.dataset.tema = tema;

        try {
            localStorage.setItem(CHAVE_TEMA, tema);
        } catch {
            // Armazenamento indisponível.
        }

        const meta = document.querySelector(
            'meta[name="theme-color"]'
        );

        if (meta) {
            meta.content =
                tema === "claro"
                    ? "#f3f5f8"
                    : "#08080b";
        }
    }

    function alternarTema() {
        const novoTema =
            temaAtual() === "claro"
                ? "escuro"
                : "claro";

        aplicarTema(novoTema);

        mostrarToast(
            `Tema ${novoTema} ativado`,
            "info"
        );
    }

    function configurarTema() {
        let temaSalvo = "escuro";

        try {
            temaSalvo =
                localStorage.getItem(CHAVE_TEMA) ||
                document.documentElement.dataset.tema ||
                "escuro";
        } catch {
            temaSalvo = "escuro";
        }

        aplicarTema(
            temaSalvo === "claro"
                ? "claro"
                : "escuro"
        );

        $("btnTema")?.addEventListener(
            "click",
            alternarTema
        );
    }

    function configurarMenuUsuario() {
        const botao = $("btnConfig");
        const menu = $("menuConfig");

        if (!botao || !menu) {
            return;
        }

        function alternarMenu(abrir) {
            const aberto =
                abrir ??
                !menu.classList.contains("mostrar");

            menu.classList.toggle(
                "mostrar",
                aberto
            );

            botao.setAttribute(
                "aria-expanded",
                String(aberto)
            );
        }

        botao.addEventListener("click", (evento) => {
            evento.stopPropagation();
            alternarMenu();
        });

        document.addEventListener("click", (evento) => {
            if (
                !menu.contains(evento.target) &&
                !botao.contains(evento.target)
            ) {
                alternarMenu(false);
            }
        });

        $("gatilhoSair")?.addEventListener(
            "click",
            (evento) => {
                evento.preventDefault();
                alternarMenu(false);

                abrirModal(
                    $("modalSairContainer")
                );

                $("btnCancelarSair")?.focus();
            }
        );
    }

    function configurarSaida() {
        const modal = $("modalSairContainer");

        if (!modal) {
            return;
        }

        $("btnCancelarSair")?.addEventListener(
            "click",
            () => fecharModal(modal)
        );

        modal.addEventListener(
            "mousedown",
            (evento) => {
                if (evento.target === modal) {
                    fecharModal(modal);
                }
            }
        );

        $("btnSair")?.addEventListener("click", () => {
            limparSessao();
            window.location.replace(LOGIN_URL);
        });
    }

    function obterComandos() {
        const navegar = (url) => () => {
            window.location.href = url;
        };

        return [
            {
                grupo: "Ir para",
                icone: "i-shield",
                titulo: "Painel administrativo",
                dica: "Início",
                pesquisa: "inicio painel dashboard resumo",
                acao: navegar("/pages/painel-admin.html")
            },
            {
                grupo: "Ir para",
                icone: "i-users",
                titulo: "Usuários",
                dica: "Contas e bloqueios",
                pesquisa: "usuarios contas clientes empresas",
                acao: navegar("/pages/usuarios.html")
            },
            {
                grupo: "Ir para",
                icone: "i-check",
                titulo: "Moderação",
                dica: "Anúncios e denúncias",
                pesquisa: "moderacao anuncios denuncias",
                acao: navegar("/pages/moderacao.html")
            },
            {
                grupo: "Ir para",
                icone: "i-car",
                titulo: "Catálogo",
                dica: "Veículos",
                pesquisa: "catalogo veiculos carros",
                acao: navegar("/pages/catalogo.html")
            },
            {
                grupo: "Ir para",
                icone: "i-user",
                titulo: "Minha conta",
                dica: "Dados pessoais",
                pesquisa: "perfil minha conta",
                acao: navegar("/pages/perfil.html")
            },
            {
                grupo: "Ir para",
                icone: "i-home",
                titulo: "Ver o site",
                dica: "Página inicial",
                pesquisa: "site home inicio",
                acao: navegar("/pages/index.html")
            },
            {
                grupo: "Ações",
                icone: "i-refresh",
                titulo: "Atualizar dados",
                dica: "Recarregar painel",
                pesquisa: "atualizar recarregar refresh",
                acao: () => atualizarPainel(true)
            },
            {
                grupo: "Ações",
                icone:
                    temaAtual() === "claro"
                        ? "i-moon"
                        : "i-sun",
                titulo: "Alternar tema",
                dica: "Claro ou escuro",
                pesquisa: "tema claro escuro",
                acao: alternarTema
            },
            {
                grupo: "Ações",
                icone: "i-logout",
                titulo: "Sair",
                dica: "Encerrar sessão",
                pesquisa: "sair logout deslogar",
                acao: () => {
                    abrirModal(
                        $("modalSairContainer")
                    );
                }
            }
        ];
    }

    function renderizarPaleta() {
        const lista = $("paletaLista");
        const campo = $("paletaInput");

        if (!lista || !campo) {
            return;
        }

        const termos = normalizar(campo.value)
            .split(/\s+/)
            .filter(Boolean);

        comandosFiltrados = obterComandos().filter(
            (comando) => {
                const conteudo = normalizar(
                    `${comando.grupo} ` +
                    `${comando.titulo} ` +
                    `${comando.dica} ` +
                    `${comando.pesquisa}`
                );

                return termos.every(
                    (termo) =>
                        conteudo.includes(termo)
                );
            }
        );

        if (!comandosFiltrados.length) {
            lista.innerHTML =
                `<li class="paleta-vazia">` +
                `Nenhum resultado encontrado.` +
                `</li>`;

            return;
        }

        comandoSelecionado = Math.min(
            comandoSelecionado,
            comandosFiltrados.length - 1
        );

        let html = "";
        let grupoAtual = "";

        comandosFiltrados.forEach(
            (comando, indice) => {
                if (comando.grupo !== grupoAtual) {
                    grupoAtual = comando.grupo;

                    html +=
                        `<li class="paleta-grupo" ` +
                        `role="presentation">` +
                        `${escapar(grupoAtual)}` +
                        `</li>`;
                }

                html +=
                    `<li role="option" ` +
                    `data-i="${indice}" ` +
                    `aria-selected="${
                        indice === comandoSelecionado
                    }" ` +
                    `class="${
                        indice === comandoSelecionado
                            ? "sel"
                            : ""
                    }">` +
                    `${icone(comando.icone)}` +
                    `<span>${escapar(comando.titulo)}</span>` +
                    `<small>${escapar(comando.dica)}</small>` +
                    `</li>`;
            }
        );

        lista.innerHTML = html;
    }

    function atualizarSelecaoPaleta(rolar = true) {
        const lista = $("paletaLista");

        if (!lista) {
            return;
        }

        lista
            .querySelectorAll("li[data-i]")
            .forEach((item) => {
                const selecionado =
                    Number(item.dataset.i) ===
                    comandoSelecionado;

                item.classList.toggle(
                    "sel",
                    selecionado
                );

                item.setAttribute(
                    "aria-selected",
                    String(selecionado)
                );

                if (selecionado && rolar) {
                    item.scrollIntoView({
                        block: "nearest"
                    });
                }
            });
    }

    function executarComando(indice) {
        const comando =
            comandosFiltrados[indice];

        if (!comando) {
            return;
        }

        fecharModal($("paleta"));

        window.setTimeout(
            comando.acao,
            50
        );
    }

    function abrirPaleta() {
        const modal = $("paleta");
        const campo = $("paletaInput");

        if (!modal || !campo) {
            return;
        }

        campo.value = "";
        comandoSelecionado = 0;

        renderizarPaleta();
        abrirModal(modal);

        window.setTimeout(
            () => campo.focus(),
            40
        );
    }

    function configurarPaleta() {
        const modal = $("paleta");
        const campo = $("paletaInput");
        const lista = $("paletaLista");

        if (!modal || !campo || !lista) {
            return;
        }

        $("btnPaleta")?.addEventListener(
            "click",
            abrirPaleta
        );

        modal.addEventListener(
            "mousedown",
            (evento) => {
                if (evento.target === modal) {
                    fecharModal(modal);
                }
            }
        );

        campo.addEventListener("input", () => {
            comandoSelecionado = 0;
            renderizarPaleta();
        });

        campo.addEventListener("keydown", (evento) => {
            if (!comandosFiltrados.length) {
                return;
            }

            if (evento.key === "ArrowDown") {
                evento.preventDefault();

                comandoSelecionado =
                    (
                        comandoSelecionado + 1
                    ) %
                    comandosFiltrados.length;

                atualizarSelecaoPaleta();
            } else if (evento.key === "ArrowUp") {
                evento.preventDefault();

                comandoSelecionado =
                    (
                        comandoSelecionado -
                        1 +
                        comandosFiltrados.length
                    ) %
                    comandosFiltrados.length;

                atualizarSelecaoPaleta();
            } else if (evento.key === "Enter") {
                evento.preventDefault();
                executarComando(comandoSelecionado);
            }
        });

        lista.addEventListener("mousemove", (evento) => {
            const item =
                evento.target.closest("li[data-i]");

            if (!item) {
                return;
            }

            comandoSelecionado =
                Number(item.dataset.i);

            atualizarSelecaoPaleta(false);
        });

        lista.addEventListener("click", (evento) => {
            const item =
                evento.target.closest("li[data-i]");

            if (item) {
                executarComando(
                    Number(item.dataset.i)
                );
            }
        });
    }

    function configurarAtualizacao() {
        $("btnAtualizar")?.addEventListener(
            "click",
            () => atualizarPainel(true)
        );

        $("btnTentar")?.addEventListener(
            "click",
            () => atualizarPainel(true)
        );

        const automatico = $("autoAtualizar");

        if (!automatico) {
            return;
        }

        try {
            automatico.checked =
                localStorage.getItem(CHAVE_AUTO) === "1";
        } catch {
            automatico.checked = false;
        }

        function aplicarIntervalo() {
            window.clearInterval(intervaloAutomatico);
            intervaloAutomatico = null;

            if (automatico.checked) {
                intervaloAutomatico =
                    window.setInterval(() => {
                        if (!document.hidden) {
                            atualizarPainel();
                        }
                    }, TEMPO_AUTO);
            }
        }

        automatico.addEventListener("change", () => {
            try {
                localStorage.setItem(
                    CHAVE_AUTO,
                    automatico.checked ? "1" : "0"
                );
            } catch {
                // Ignora falha.
            }

            aplicarIntervalo();

            mostrarToast(
                automatico.checked
                    ? "Atualização automática ativada"
                    : "Atualização automática desativada",
                "info"
            );
        });

        aplicarIntervalo();

        document.addEventListener(
            "visibilitychange",
            () => {
                if (
                    !document.hidden &&
                    automatico.checked &&
                    Date.now() - ultimaAtualizacao >
                        TEMPO_AUTO
                ) {
                    atualizarPainel();
                }
            }
        );
    }

    function configurarEventosGlobais() {
        document.addEventListener("keydown", (evento) => {
            if (
                (evento.ctrlKey || evento.metaKey) &&
                evento.key.toLowerCase() === "k"
            ) {
                evento.preventDefault();

                const paleta = $("paleta");

                if (
                    paleta?.classList.contains(
                        "mostrar-modal"
                    )
                ) {
                    fecharModal(paleta);
                } else {
                    abrirPaleta();
                }

                return;
            }

            if (
                evento.key === "Escape" &&
                modaisAbertos.length
            ) {
                fecharModal(
                    modaisAbertos[
                        modaisAbertos.length - 1
                    ]
                );
            }
        });

        const topbar =
            document.querySelector(".topbar");

        function atualizarTopbar() {
            topbar?.classList.toggle(
                "rolou",
                window.scrollY > 8
            );
        }

        window.addEventListener(
            "scroll",
            atualizarTopbar,
            { passive: true }
        );

        atualizarTopbar();

        window.addEventListener("storage", (evento) => {
            if (
                evento.key !== null &&
                !CHAVES_USUARIO.includes(evento.key)
            ) {
                return;
            }

            const usuario = lerUsuario();

            if (!usuario) {
                window.location.replace(LOGIN_URL);
            } else if (!usuarioEhAdmin(usuario)) {
                window.location.replace(
                    rotaDoUsuario(usuario)
                );
            }
        });
    }

    class ErroApi extends Error {
        constructor(mensagem, status = 0) {
            super(mensagem);
            this.name = "ErroApi";
            this.status = status;
        }
    }

    async function buscarResumo() {
        const controle = new AbortController();

        const limite = window.setTimeout(
            () => controle.abort(),
            TEMPO_LIMITE
        );

        try {
            const headers = {
                Accept: "application/json"
            };

            const token = obterToken();

            if (token) {
                headers.Authorization =
                    `Bearer ${token}`;
            }

            const resposta = await fetch(API_RESUMO, {
                method: "GET",
                headers,
                credentials: "same-origin",
                cache: "no-store",
                signal: controle.signal
            });

            let corpo = null;

            try {
                corpo = await resposta.json();
            } catch {
                corpo = null;
            }

            if (
                !resposta.ok ||
                !corpo ||
                corpo.sucesso === false
            ) {
                throw new ErroApi(
                    corpo?.mensagem ||
                    corpo?.erro ||
                    `Falha HTTP ${resposta.status}.`,
                    resposta.status
                );
            }

            const dados =
                corpo.dados ||
                corpo.resumo ||
                corpo.data ||
                corpo;

            if (
                !dados ||
                typeof dados !== "object"
            ) {
                throw new ErroApi(
                    "O servidor retornou dados inválidos.",
                    resposta.status
                );
            }

            return dados;
        } catch (erro) {
            if (erro instanceof ErroApi) {
                throw erro;
            }

            if (erro.name === "AbortError") {
                throw new ErroApi(
                    "O servidor demorou para responder."
                );
            }

            throw new ErroApi(
                "Não foi possível conectar ao servidor."
            );
        } finally {
            window.clearTimeout(limite);
        }
    }

    function definirIndicador(estado, texto) {
        const indicador = $("atualizadoEm");

        if (!indicador) {
            return;
        }

        indicador.textContent = texto;

        indicador.classList.toggle(
            "carregando",
            estado === "carregando"
        );

        indicador.classList.toggle(
            "erro",
            estado === "erro"
        );
    }

    function mostrarErro(mensagem) {
        if ($("avisoErroTexto")) {
            $("avisoErroTexto").textContent = mensagem;
        }

        if ($("avisoErro")) {
            $("avisoErro").hidden = false;
        }
    }

    function ocultarErro() {
        if ($("avisoErro")) {
            $("avisoErro").hidden = true;
        }
    }

    function exibirFalhaInicial() {
        const mensagem =
            `<div class="vazio-lista falha">` +
            `Não foi possível carregar.` +
            `</div>`;

        [
            "grafico",
            "pendencias",
            "donut",
            "listaUsuarios",
            "listaAnuncios"
        ].forEach((id) => {
            if ($(id)) {
                $(id).innerHTML = mensagem;
            }
        });

        document
            .querySelectorAll("[data-kpi]")
            .forEach((elemento) => {
                elemento.textContent = "—";
            });
    }

    async function atualizarPainel(manual = false) {
        if (carregando) {
            return;
        }

        carregando = true;

        const botao = $("btnAtualizar");

        if (botao) {
            botao.disabled = true;
            botao.classList.add("girando");
        }

        definirIndicador(
            "carregando",
            "Atualizando..."
        );

        try {
            const dados = await buscarResumo();

            ocultarErro();
            renderizarPainel(dados);

            possuiDados = true;
            ultimaAtualizacao = Date.now();

            const geradoEm = dados.gerado_em
                ? new Date(dados.gerado_em)
                : new Date();

            definirIndicador(
                "ok",
                `Atualizado às ${geradoEm.toLocaleTimeString(
                    "pt-BR",
                    {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                    }
                )}`
            );

            if (manual) {
                mostrarToast("Dados atualizados");
            }
        } catch (erro) {
            console.error(
                "Erro no painel administrativo:",
                erro
            );

            definirIndicador(
                "erro",
                "Falha ao atualizar"
            );

            let mensagem = erro.message;

            if (erro.status === 401) {
                mensagem =
                    "Sua sessão não foi reconhecida. Saia da conta e entre novamente.";
            } else if (erro.status === 403) {
                mensagem =
                    "Sua conta não possui permissão de administrador.";
            }

            mostrarErro(mensagem);

            if (!possuiDados) {
                exibirFalhaInicial();
            }

            if (manual) {
                mostrarToast(
                    "Não foi possível atualizar",
                    "erro"
                );
            }
        } finally {
            carregando = false;

            if (botao) {
                botao.disabled = false;
                botao.classList.remove("girando");
            }
        }
    }

    function renderizarPainel(dados = {}) {
        const serie =
            dados.serie ||
            dados.crescimento ||
            dados.series ||
            [];

        const recentes =
            dados.recentes ||
            dados.recent ||
            {};

        renderizarKpis(dados);

        renderizarGrafico(
            Array.isArray(serie) ? serie : []
        );

        renderizarPendencias(dados);

        renderizarDonut(
            dados.usuarios || {}
        );

        renderizarUsuarios(
            Array.isArray(recentes.usuarios)
                ? recentes.usuarios
                : Array.isArray(dados.usuarios_recentes)
                    ? dados.usuarios_recentes
                    : []
        );

        renderizarAnuncios(
            Array.isArray(recentes.anuncios)
                ? recentes.anuncios
                : Array.isArray(dados.anuncios_recentes)
                    ? dados.anuncios_recentes
                    : []
        );
    }

    function animarNumero(elemento, alvo) {
        if (!elemento) {
            return;
        }

        const destino = Number(alvo) || 0;
        const inicio =
            Number(elemento.dataset.valor) || 0;

        elemento.dataset.valor = String(destino);

        cancelAnimationFrame(elemento._animacao);

        if (
            movimentoReduzido ||
            inicio === destino
        ) {
            elemento.textContent = numero.format(destino);
            return;
        }

        const inicioAnimacao = performance.now();
        const duracao = 700;

        function animar(tempo) {
            const progresso = Math.min(
                1,
                (tempo - inicioAnimacao) /
                    duracao
            );

            const suavizado =
                1 - Math.pow(1 - progresso, 3);

            const atual = Math.round(
                inicio +
                (destino - inicio) *
                    suavizado
            );

            elemento.textContent =
                numero.format(atual);

            if (progresso < 1) {
                elemento._animacao =
                    requestAnimationFrame(animar);
            }
        }

        elemento._animacao =
            requestAnimationFrame(animar);
    }

    function criarSubKpi(valor, texto) {
        const quantidade = Number(valor) || 0;

        return (
            `<b class="${
                quantidade > 0 ? "up" : "zero"
            }">` +
            `${
                quantidade > 0 ? "+" : ""
            }${numero.format(quantidade)}` +
            `</b> ${texto}`
        );
    }

    function renderizarKpis(dados) {
        const usuarios = dados.usuarios || {};
        const anuncios = dados.anuncios || {};
        const conversas = dados.conversas || {};

        animarNumero(
            document.querySelector(
                '[data-kpi="usuarios"]'
            ),
            usuarios.total
        );

        animarNumero(
            document.querySelector(
                '[data-kpi="anuncios"]'
            ),
            anuncios.total
        );

        animarNumero(
            document.querySelector(
                '[data-kpi="views"]'
            ),
            anuncios.visualizacoes
        );

        animarNumero(
            document.querySelector(
                '[data-kpi="conversas"]'
            ),
            conversas.total
        );

        if ($("kpiUsuariosSub")) {
            $("kpiUsuariosSub").innerHTML =
                criarSubKpi(
                    usuarios.novos_30d,
                    "nos últimos 30 dias"
                );
        }

        if ($("kpiAnunciosSub")) {
            $("kpiAnunciosSub").innerHTML =
                criarSubKpi(
                    anuncios.novos_30d,
                    "nos últimos 30 dias"
                );
        }
    }

    function rotuloMes(valor) {
        const [ano, mes] = String(valor)
            .split("-")
            .map(Number);

        if (!ano || !mes) {
            return "";
        }

        const nome = new Date(
            ano,
            mes - 1,
            1
        )
            .toLocaleDateString("pt-BR", {
                month: "short"
            })
            .replace(".", "");

        return `${nome}/${String(ano).slice(2)}`;
    }

    function nomeCompletoMes(valor) {
        const [ano, mes] = String(valor)
            .split("-")
            .map(Number);

        if (!ano || !mes) {
            return "";
        }

        return new Date(
            ano,
            mes - 1,
            1
        ).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric"
        });
    }

    function calcularPasso(valor) {
        if (
            !Number.isFinite(valor) ||
            valor <= 0
        ) {
            return 1;
        }

        const potencia = Math.pow(
            10,
            Math.floor(Math.log10(valor))
        );

        const fracao = valor / potencia;

        const multiplicador =
            fracao <= 1
                ? 1
                : fracao <= 2
                    ? 2
                    : fracao <= 5
                        ? 5
                        : 10;

        return Math.max(
            1,
            multiplicador * potencia
        );
    }

    function renderizarGrafico(serie) {
        const alvo = $("grafico");

        if (!alvo) {
            return;
        }

        if (!serie.length) {
            alvo.innerHTML =
                `<div class="vazio-lista">` +
                `Sem dados no período.` +
                `</div>`;

            return;
        }

        const largura = 640;
        const altura = 270;

        const margem = {
            topo: 24,
            direita: 14,
            baixo: 34,
            esquerda: 40
        };

        const larguraInterna =
            largura -
            margem.esquerda -
            margem.direita;

        const alturaInterna =
            altura -
            margem.topo -
            margem.baixo;

        const maximo = Math.max(
            1,
            ...serie.flatMap((item) => [
                Number(item.usuarios) || 0,
                Number(item.anuncios) || 0
            ])
        );

        const passo =
            calcularPasso(maximo / 4);

        const topo =
            passo *
            Math.ceil(maximo / passo);

        const posicaoY = (valor) =>
            margem.topo +
            alturaInterna -
            (valor / topo) *
                alturaInterna;

        let linhas = "";

        for (
            let valor = 0;
            valor <= topo;
            valor += passo
        ) {
            linhas +=
                `<line class="grade-y" ` +
                `x1="${margem.esquerda}" ` +
                `x2="${largura - margem.direita}" ` +
                `y1="${posicaoY(valor)}" ` +
                `y2="${posicaoY(valor)}">` +
                `</line>` +
                `<text ` +
                `x="${margem.esquerda - 10}" ` +
                `y="${posicaoY(valor) + 4}" ` +
                `text-anchor="end">` +
                `${numero.format(valor)}` +
                `</text>`;
        }

        const tamanhoGrupo =
            larguraInterna / serie.length;

        const tamanhoBarra = Math.min(
            26,
            tamanhoGrupo * 0.28
        );

        const espaco = 6;

        const grupos = serie.map((item, indice) => {
            const usuarios =
                Number(item.usuarios) || 0;

            const anuncios =
                Number(item.anuncios) || 0;

            const centro =
                margem.esquerda +
                tamanhoGrupo * indice +
                tamanhoGrupo / 2;

            const xUsuarios =
                centro -
                espaco / 2 -
                tamanhoBarra;

            const xAnuncios =
                centro + espaco / 2;

            const alturaUsuarios =
                (usuarios / topo) *
                alturaInterna;

            const alturaAnuncios =
                (anuncios / topo) *
                alturaInterna;

            const atraso = indice * 60;

            function barra(
                classe,
                x,
                valor,
                tamanho
            ) {
                if (valor <= 0) {
                    return "";
                }

                return (
                    `<rect class="${classe}" ` +
                    `x="${x}" ` +
                    `y="${posicaoY(valor)}" ` +
                    `width="${tamanhoBarra}" ` +
                    `height="${tamanho}" ` +
                    `rx="4" ` +
                    `style="animation-delay:${atraso}ms">` +
                    `</rect>` +
                    `<text class="val" ` +
                    `x="${x + tamanhoBarra / 2}" ` +
                    `y="${posicaoY(valor) - 6}" ` +
                    `text-anchor="middle">` +
                    `${numero.format(valor)}` +
                    `</text>`
                );
            }

            return (
                `<g class="grupo">` +
                `<title>` +
                `${escapar(nomeCompletoMes(item.mes))}: ` +
                `${numero.format(usuarios)} usuários e ` +
                `${numero.format(anuncios)} anúncios` +
                `</title>` +
                `<rect class="col" ` +
                `x="${
                    margem.esquerda +
                    tamanhoGrupo * indice +
                    4
                }" ` +
                `y="${margem.topo}" ` +
                `width="${tamanhoGrupo - 8}" ` +
                `height="${alturaInterna}" ` +
                `rx="10"></rect>` +
                `${barra(
                    "barra-u",
                    xUsuarios,
                    usuarios,
                    alturaUsuarios
                )}` +
                `${barra(
                    "barra-a",
                    xAnuncios,
                    anuncios,
                    alturaAnuncios
                )}` +
                `<text class="eixo-x" ` +
                `x="${centro}" ` +
                `y="${altura - 12}" ` +
                `text-anchor="middle">` +
                `${escapar(rotuloMes(item.mes))}` +
                `</text>` +
                `</g>`
            );
        }).join("");

        const totalUsuarios = serie.reduce(
            (soma, item) =>
                soma +
                (Number(item.usuarios) || 0),
            0
        );

        const totalAnuncios = serie.reduce(
            (soma, item) =>
                soma +
                (Number(item.anuncios) || 0),
            0
        );

        alvo.innerHTML =
            `<svg viewBox="0 0 ${largura} ${altura}" ` +
            `role="img" ` +
            `aria-label="Crescimento mensal">` +
            `${linhas}${grupos}` +
            `</svg>` +
            `<div class="grafico-resumo">` +
            `<span><b>${numero.format(totalUsuarios)}</b> ` +
            `novos usuários</span>` +
            `<span><b>${numero.format(totalAnuncios)}</b> ` +
            `novos anúncios</span>` +
            `<span>no período de 6 meses</span>` +
            `</div>`;
    }

    function criarPendencia({
        quantidade,
        nivel,
        iconeId,
        titulo,
        descricao,
        link
    }) {
        const total =
            Number(quantidade) || 0;

        const classes = [
            nivel,
            total === 0 ? "zerado" : ""
        ]
            .filter(Boolean)
            .join(" ");

        return (
            `<a class="pend ${classes}" ` +
            `href="${escapar(link)}">` +
            `<span class="pend-icone">` +
            `${icone(iconeId)}` +
            `</span>` +
            `<span class="pend-txt">` +
            `<strong>${escapar(titulo)}</strong>` +
            `<small>${escapar(descricao)}</small>` +
            `</span>` +
            `<span class="pend-n">` +
            `${numero.format(total)}` +
            `</span>` +
            `</a>`
        );
    }

    function renderizarPendencias(dados) {
        const alvo = $("pendencias");

        if (!alvo) {
            return;
        }

        const pendencias =
            dados.pendencias || {};

        const anuncios =
            dados.anuncios || {};

        const usuarios =
            dados.usuarios || {};

        const atencao = [
            {
                quantidade:
                    pendencias.denuncias_pendentes,
                nivel: "critico",
                iconeId: "i-flag",
                titulo: "Denúncias pendentes",
                descricao:
                    "Anúncios denunciados por usuários",
                link: "/pages/moderacao.html"
            },
            {
                quantidade:
                    pendencias.empresas_pendentes,
                nivel: "alerta",
                iconeId: "i-building",
                titulo:
                    "Empresas aguardando verificação",
                descricao:
                    "Aprove ou recuse os cadastros",
                link: "/pages/moderacao.html"
            },
            {
                quantidade: anuncios.sem_foto,
                nivel: "alerta",
                iconeId: "i-image",
                titulo: "Anúncios sem foto",
                descricao:
                    "Anúncios sem imagem recebem menos contatos",
                link: "/pages/moderacao.html"
            }
        ].filter(
            (item) =>
                Number(item.quantidade) > 0
        );

        const informativos = [
            {
                quantidade: usuarios.bloqueados,
                nivel: "info",
                iconeId: "i-ban",
                titulo: "Usuários bloqueados",
                descricao:
                    "Contas com acesso suspenso",
                link: "/pages/usuarios.html"
            },
            {
                quantidade: usuarios.inativos,
                nivel: "info",
                iconeId: "i-user",
                titulo: "Contas inativas",
                descricao:
                    "Contas sem acesso recente",
                link: "/pages/usuarios.html"
            }
        ];

        const totalAtencao = atencao.reduce(
            (soma, item) =>
                soma +
                (Number(item.quantidade) || 0),
            0
        );

        const blocoAtencao = atencao.length
            ? atencao
                .map(criarPendencia)
                .join("")
            : (
                `<div class="tudo-certo">` +
                `${icone("i-check")}` +
                `<span>` +
                `Tudo certo por aqui.<br>` +
                `Nenhuma pendência para revisar.` +
                `</span>` +
                `</div>`
            );

        alvo.innerHTML =
            `${blocoAtencao}` +
            `<div class="pend-titulo">` +
            `Informativo` +
            `</div>` +
            `${informativos
                .map(criarPendencia)
                .join("")}`;

        const contador = $("contadorPend");

        if (contador) {
            contador.textContent =
                numero.format(totalAtencao);

            contador.hidden =
                totalAtencao === 0;
        }

        document.title =
            `${
                totalAtencao > 0
                    ? `(${totalAtencao}) `
                    : ""
            }Painel Administrativo | MotorFlex`;
    }

    function renderizarDonut(usuarios) {
        const alvo = $("donut");

        if (!alvo) {
            return;
        }

        const tipos = [
            {
                chave: "individual",
                nome: "Pessoa física",
                cor: "var(--ok)"
            },
            {
                chave: "empresa",
                nome: "Empresas",
                cor: "var(--purple)"
            },
            {
                chave: "admin",
                nome: "Administradores",
                cor: "var(--info)"
            }
        ];

        const valores = tipos.map(
            (tipo) =>
                Number(usuarios[tipo.chave]) || 0
        );

        const total = valores.reduce(
            (soma, valor) => soma + valor,
            0
        );

        const raio = 52;
        const circunferencia =
            2 * Math.PI * raio;

        const ativos = valores.filter(
            (valor) => valor > 0
        ).length;

        let acumulado = 0;
        const tamanhos = [];

        const circulos = tipos.map(
            (tipo, indice) => {
                const tamanho = total
                    ? (
                        valores[indice] /
                        total
                    ) * circunferencia
                    : 0;

                const visivel = Math.max(
                    0,
                    tamanho -
                    (ativos > 1 ? 2 : 0)
                );

                tamanhos.push(
                    `${visivel} ${circunferencia}`
                );

                const circulo =
                    `<circle class="seg" ` +
                    `cx="70" cy="70" ` +
                    `r="${raio}" ` +
                    `stroke="${tipo.cor}" ` +
                    `style="` +
                    `stroke-dasharray:0 ${circunferencia};` +
                    `stroke-dashoffset:${-acumulado}">` +
                    `</circle>`;

                acumulado += tamanho;

                return circulo;
            }
        ).join("");

        const legenda = tipos.map(
            (tipo, indice) => {
                const porcentagem = total
                    ? Math.round(
                        (
                            valores[indice] /
                            total
                        ) * 100
                    )
                    : 0;

                return (
                    `<div>` +
                    `<i style="background:${tipo.cor}"></i>` +
                    `${escapar(tipo.nome)}` +
                    `<b>${numero.format(valores[indice])}</b>` +
                    `<small>${porcentagem}%</small>` +
                    `</div>`
                );
            }
        ).join("");

        alvo.innerHTML =
            `<div class="donut">` +
            `<svg viewBox="0 0 140 140" ` +
            `role="img" ` +
            `aria-label="Contas por tipo">` +
            `<circle class="fundo" ` +
            `cx="70" cy="70" r="${raio}">` +
            `</circle>` +
            `${circulos}` +
            `</svg>` +
            `<div class="donut-centro">` +
            `<strong>${numero.format(total)}</strong>` +
            `<small>contas</small>` +
            `</div>` +
            `</div>` +
            `<div class="donut-leg">` +
            `${legenda}` +
            `</div>`;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                alvo
                    .querySelectorAll(".seg")
                    .forEach((circulo, indice) => {
                        circulo.style.strokeDasharray =
                            tamanhos[indice];
                    });
            });
        });
    }

    function rotuloTipo(tipo) {
        return ({
            individual: "Pessoa física",
            empresa: "Empresa",
            admin: "Admin"
        })[normalizar(tipo)] || tipo || "—";
    }

    function criarSelo(usuario) {
        const status = normalizar(usuario.status);
        const tipo = normalizar(usuario.tipo);

        if (status === "bloqueado") {
            return (
                `<span class="badge bloqueado">` +
                `Bloqueado` +
                `</span>`
            );
        }

        if (
            [
                "inativo",
                "inactive_warning",
                "inactive_expired"
            ].includes(status)
        ) {
            return (
                `<span class="badge inativo">` +
                `Inativo` +
                `</span>`
            );
        }

        return (
            `<span class="badge ${escapar(tipo)}">` +
            `${escapar(rotuloTipo(tipo))}` +
            `</span>`
        );
    }

    function tratarImagens(container) {
        container
            .querySelectorAll("img[data-fb]")
            .forEach((imagem) => {
                imagem.addEventListener(
                    "error",
                    () => {
                        if (
                            imagem.dataset.fb ===
                            "thumb"
                        ) {
                            const vazio =
                                document.createElement(
                                    "span"
                                );

                            vazio.className =
                                "thumb vazia";

                            vazio.innerHTML =
                                icone("i-image");

                            imagem.replaceWith(vazio);
                        } else {
                            imagem.remove();
                        }
                    },
                    { once: true }
                );
            });
    }

    function renderizarUsuarios(lista) {
        const alvo = $("listaUsuarios");

        if (!alvo) {
            return;
        }

        if (!lista.length) {
            alvo.innerHTML =
                `<div class="vazio-lista">` +
                `Nenhum usuário cadastrado ainda.` +
                `</div>`;

            return;
        }

        alvo.innerHTML = lista.map((usuario) => {
            const nome =
                [
                    usuario.nome,
                    usuario.sobrenome
                ]
                    .filter(Boolean)
                    .join(" ") ||
                "Sem nome";

            const email =
                usuario.email || "Sem e-mail";

            const foto = normalizarFoto(
                usuario.foto_perfil ||
                usuario.foto_url ||
                usuario.fotoUrl
            );

            return (
                `<div class="item">` +
                `<span class="av" ` +
                `style="background:${corDoNome(nome)}">` +
                `${escapar(iniciais(nome))}` +
                `${
                    foto
                        ? (
                            `<img src="${escapar(foto)}" ` +
                            `alt="" loading="lazy" ` +
                            `data-fb="av">`
                        )
                        : ""
                }` +
                `</span>` +
                `<div class="item-info">` +
                `<strong>${escapar(nome)}</strong>` +
                `<small>${escapar(email)}</small>` +
                `</div>` +
                `<div class="item-meta">` +
                `${criarSelo(usuario)}` +
                `<span>${escapar(
                    formatarTempo(usuario.criado_em)
                )}</span>` +
                `</div>` +
                `</div>`
            );
        }).join("");

        tratarImagens(alvo);
    }

    function renderizarAnuncios(lista) {
        const alvo = $("listaAnuncios");

        if (!alvo) {
            return;
        }

        if (!lista.length) {
            alvo.innerHTML =
                `<div class="vazio-lista">` +
                `Nenhum anúncio cadastrado ainda.` +
                `</div>`;

            return;
        }

        alvo.innerHTML = lista.map((veiculo) => {
            const titulo =
                [
                    veiculo.marca,
                    veiculo.modelo
                ]
                    .filter(Boolean)
                    .join(" ") ||
                "Veículo";

            const ano =
                veiculo.ano_modelo ||
                veiculo.ano_fabricacao;

            const dono =
                veiculo.dono ||
                veiculo.nome_dono;

            const detalhe = [
                ano,
                dono
            ]
                .filter(Boolean)
                .join(" • ");

            const foto = normalizarFoto(
                veiculo.imagem ||
                veiculo.imagem_url ||
                veiculo.foto
            );

            const miniatura = foto
                ? (
                    `<img class="thumb" ` +
                    `src="${escapar(foto)}" ` +
                    `alt="" loading="lazy" ` +
                    `data-fb="thumb">`
                )
                : (
                    `<span class="thumb vazia">` +
                    `${icone("i-image")}` +
                    `</span>`
                );

            const id = encodeURIComponent(
                veiculo.id
            );

            return (
                `<a class="item" ` +
                `href="/pages/detalhes-veiculo.html?id=${id}" ` +
                `title="Abrir anúncio">` +
                `${miniatura}` +
                `<div class="item-info">` +
                `<strong>${escapar(titulo)}</strong>` +
                `<small>${escapar(detalhe || "—")}</small>` +
                `</div>` +
                `<div class="item-meta">` +
                `<b>${escapar(
                    formatarDinheiro(veiculo.preco)
                )}</b>` +
                `<span>` +
                `${numero.format(
                    Number(veiculo.visualizacoes) || 0
                )} vis. · ` +
                `${escapar(
                    formatarTempo(veiculo.criado_em)
                )}` +
                `</span>` +
                `</div>` +
                `</a>`
            );
        }).join("");

        tratarImagens(alvo);
    }

    function iniciar() {
        const usuario = lerUsuario();

        if (!usuario) {
            window.location.replace(LOGIN_URL);
            return;
        }

        if (!usuarioEhAdmin(usuario)) {
            window.location.replace(
                rotaDoUsuario(usuario)
            );

            return;
        }

        preencherCabecalho(usuario);
        configurarTema();
        configurarMenuUsuario();
        configurarSaida();
        configurarPaleta();
        configurarAtualizacao();
        configurarEventosGlobais();

        atualizarPainel();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            iniciar,
            { once: true }
        );
    } else {
        iniciar();
    }
})();