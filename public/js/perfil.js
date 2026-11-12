"use strict";

// ==========================================================
// CONFIGURAÇÕES
// ==========================================================
const LOGIN_URL = "/pages/login.html";

const PAINEL_POR_TIPO = {
    admin: "/pages/painel-admin.html",
    empresa: "/pages/painel-empresa.html"
};

const PAINEL_PADRAO =
    "/pages/painel-cliente.html";

const ROTULOS_TIPO = {
    admin: "Administrador",
    empresa: "Conta Jurídica",
    individual: "Conta Individual"
};

const ROTULOS_VERIFICACAO = {
    pendente: [
        "Em análise",
        "Estamos analisando os dados da sua empresa."
    ],

    aprovada: [
        "Verificada",
        "Sua empresa foi aprovada."
    ],

    recusada: [
        "Recusada",
        "Sua empresa não foi aprovada."
    ]
};

const SUBTITULO_POR_TIPO = {
    admin:
        "Dados da sua conta de administrador da plataforma.",

    empresa:
        "Dados do responsável e da empresa cadastrada na plataforma.",

    individual:
        "Visualize os dados de cadastro da sua conta na plataforma."
};

const MASCARA_CPF =
    "***.***.***-**";

const MASCARA_SENHA =
    "********";

const AUTO_OCULTAR_MS =
    30000;

// ==========================================================
// ESTADO
// ==========================================================
const $ = (id) =>
    document.getElementById(id);

const dadosReais = {
    email: "",
    cpf: ""
};

const timers = {};

let sessao = null;
let focoAnterior = null;

// ==========================================================
// SESSÃO
// ==========================================================
function obterSessao() {
    const storages = [
        localStorage,
        sessionStorage
    ];

    const chaves = [
        "usuario",
        "usuario_logado"
    ];

    for (
        const storage of storages
    ) {
        for (
            const chave of chaves
        ) {
            const bruto =
                storage.getItem(chave);

            if (!bruto) continue;

            try {
                const dados =
                    JSON.parse(bruto);

                if (
                    dados &&
                    typeof dados ===
                        "object"
                ) {
                    return {
                        dados,
                        storage,
                        chave
                    };
                }
            } catch {
                // Tenta a próxima opção.
            }
        }
    }

    return null;
}

function getToken() {
    return (
        localStorage.getItem("token") ||
        sessionStorage.getItem("token")
    );
}

function authHeaders() {
    const token = getToken();

    return {
        "Content-Type":
            "application/json",

        ...(token && {
            Authorization:
                `Bearer ${token}`
        })
    };
}

function encerrarSessao() {
    [
        localStorage,
        sessionStorage
    ].forEach((storage) => {
        storage.removeItem("token");
        storage.removeItem("usuario");
        storage.removeItem(
            "usuario_logado"
        );
    });

    window.location.replace(
        LOGIN_URL
    );
}

async function fetchAutenticado(
    url,
    opcoes = {}
) {
    if (!getToken()) {
        encerrarSessao();

        throw new Error(
            "Sessão expirada."
        );
    }

    const resposta = await fetch(
        url,
        {
            ...opcoes,

            headers: {
                ...authHeaders(),
                ...opcoes.headers
            }
        }
    );

    if (resposta.status === 401) {
        encerrarSessao();

        throw new Error(
            "Sessão expirada."
        );
    }

    return resposta;
}

function tipoNormalizado(tipo) {
    return String(
        tipo || "individual"
    )
        .toLowerCase()
        .trim();
}

function painelDoTipo(tipo) {
    return (
        PAINEL_POR_TIPO[
            tipoNormalizado(tipo)
        ] ||
        PAINEL_PADRAO
    );
}

function configurarBotaoVoltar(
    tipo
) {
    const destino =
        painelDoTipo(tipo);

    [
        "btnVoltar",
        "logoLink"
    ].forEach((id) => {
        const elemento = $(id);

        if (elemento) {
            elemento.setAttribute(
                "href",
                destino
            );
        }
    });
}

// ==========================================================
// AVISOS
// ==========================================================
function toast(
    mensagem,
    tipo = "ok"
) {
    const area =
        $("toastArea");

    if (!area) return;

    const elemento =
        document.createElement(
            "div"
        );

    elemento.className =
        `toast toast--${tipo}`;

    const icone =
        document.createElement("i");

    icone.className =
        tipo === "erro"
            ? "fa-solid fa-circle-exclamation"
            : "fa-solid fa-circle-check";

    const texto =
        document.createElement(
            "span"
        );

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

    setTimeout(() => {
        elemento.classList.remove(
            "visivel"
        );

        setTimeout(() => {
            elemento.remove();
        }, 300);
    }, 3500);
}

// ==========================================================
// FORMATAÇÃO
// ==========================================================
function gerarMascaraEmail(email) {
    if (
        !email ||
        !email.includes("@")
    ) {
        return "******";
    }

    const [
        usuario,
        dominio
    ] = email.split("@");

    if (usuario.length <= 3) {
        return (
            `${usuario}***@${dominio}`
        );
    }

    return (
        `${usuario.substring(
            0,
            3
        )}***@${dominio}`
    );
}

function formatarCPF(cpf) {
    if (!cpf) return "";

    return String(cpf)
        .replace(/\D/g, "")
        .replace(
            /(\d{3})(\d{3})(\d{3})(\d{2})/,
            "$1.$2.$3-$4"
        );
}

function formatarCNPJ(cnpj) {
    if (!cnpj) return "";

    return String(cnpj)
        .replace(/\D/g, "")
        .replace(
            /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
            "$1.$2.$3/$4-$5"
        );
}

function formatarTelefone(
    telefone
) {
    if (!telefone) return "";

    const limpo =
        String(telefone)
            .replace(/\D/g, "");

    if (limpo.length === 11) {
        return limpo.replace(
            /(\d{2})(\d{5})(\d{4})/,
            "($1) $2-$3"
        );
    }

    return limpo.replace(
        /(\d{2})(\d{4})(\d{4})/,
        "($1) $2-$3"
    );
}

function formatarCEP(cep) {
    const limpo =
        String(cep || "")
            .replace(/\D/g, "");

    if (limpo.length === 8) {
        return limpo.replace(
            /(\d{5})(\d{3})/,
            "$1-$2"
        );
    }

    return cep || "";
}

function formatarData(data) {
    if (!data) return "";

    const objetoData =
        new Date(data);

    if (
        Number.isNaN(
            objetoData.getTime()
        )
    ) {
        return "";
    }

    return objetoData
        .toLocaleString(
            "pt-BR",
            {
                dateStyle: "short",
                timeStyle: "short"
            }
        );
}

function setValor(
    id,
    valor
) {
    const elemento = $(id);

    if (elemento) {
        elemento.value =
            valor || "";
    }
}

// ==========================================================
// FOTO E AVATAR
// ==========================================================
function urlUpload(foto) {
    if (!foto) return "";

    if (
        /^(https?:)?\//.test(
            foto
        )
    ) {
        return foto;
    }

    return `/uploads/${foto}`;
}

function montarAvatar(
    foto,
    nomeCompleto
) {
    const avatar =
        $("heroAvatar");

    const iniciais =
        $("heroIniciais");

    if (
        !avatar ||
        !iniciais
    ) {
        return;
    }

    const partes =
        String(nomeCompleto || "")
            .split(/\s+/)
            .filter(Boolean);

    iniciais.textContent =
        partes.length
            ? (
                partes[0][0] +
                (
                    partes[1]
                        ? partes[1][0]
                        : ""
                )
            ).toUpperCase()
            : "?";

    const imagemAnterior =
        avatar.querySelector("img");

    if (imagemAnterior) {
        imagemAnterior.remove();
    }

    iniciais.hidden = false;

    if (!foto) return;

    const imagem = new Image();

    imagem.alt =
        `Foto de ${nomeCompleto || "perfil"}`;

    imagem.src =
        urlUpload(foto);

    imagem.onload = () => {
        iniciais.hidden = true;
        avatar.appendChild(imagem);
    };
}

// ==========================================================
// SEÇÕES DO PERFIL
// ==========================================================
function aplicarSecoes(
    tipo,
    temEndereco
) {
    const secaoEmpresa =
        $("secaoEmpresa");

    const secaoAdmin =
        $("secaoAdmin");

    const secaoEndereco =
        $("secaoEndereco");

    const tituloPessoal =
        $("tituloPessoal");

    if (secaoEmpresa) {
        secaoEmpresa.hidden =
            tipo !== "empresa";
    }

    if (secaoAdmin) {
        secaoAdmin.hidden =
            tipo !== "admin";
    }

    if (secaoEndereco) {
        secaoEndereco.hidden =
            !temEndereco;
    }

    if (tituloPessoal) {
        tituloPessoal.textContent =
            tipo === "empresa"
                ? "Dados do responsável"
                : "Dados pessoais";
    }
}

function preencherEmpresa(usuario) {
    setValor(
        "cnpj",
        formatarCNPJ(
            usuario.cnpj
        )
    );

    setValor(
        "nomeEmpresa",
        usuario.nome_empresa
    );

    setValor(
        "razaoSocial",
        usuario.razao_social
    );

    setValor(
        "inscricaoEstadual",
        usuario.inscricao_estadual
    );

    setValor(
        "site",
        usuario.site
    );

    const status =
        String(
            usuario.status_verificacao ||
            ""
        ).toLowerCase();

    const configuracao =
        ROTULOS_VERIFICACAO[
            status
        ] || ["—", ""];

    const [
        rotulo,
        nota
    ] = configuracao;

    const badge =
        $("badgeVerificacao");

    if (badge) {
        badge.className =
            `badge badge--${
                ROTULOS_VERIFICACAO[
                    status
                ]
                    ? status
                    : "neutro"
            }`;

        badge.textContent =
            rotulo;
    }

    const notaVerificacao =
        $("notaVerificacao");

    if (notaVerificacao) {
        notaVerificacao.textContent =
            nota;
    }

    const recusada =
        status === "recusada" &&
        Boolean(
            usuario.motivo_recusa
        );

    const grupoMotivo =
        $("grupoMotivo");

    if (grupoMotivo) {
        grupoMotivo.hidden =
            !recusada;
    }

    setValor(
        "motivoRecusa",
        recusada
            ? usuario.motivo_recusa
            : ""
    );
}

function preencherEndereco(
    endereco
) {
    setValor(
        "cep",
        formatarCEP(
            endereco.cep
        )
    );

    [
        "estado",
        "cidade",
        "bairro",
        "rua",
        "numero",
        "complemento"
    ].forEach((campo) => {
        setValor(
            campo,
            endereco[campo]
        );
    });
}

function preencherPerfil(usuario) {
    const tipo =
        tipoNormalizado(
            usuario.tipo
        );

    const nomeCompleto =
        `${usuario.nome || ""} ${
            usuario.sobrenome || ""
        }`.trim();

    const enderecoValido =
        usuario.endereco &&
        Object.values(
            usuario.endereco
        ).some(Boolean);

    const endereco =
        enderecoValido
            ? usuario.endereco
            : null;

    const badge =
        $("badgeTipoConta");

    if (badge) {
        badge.className =
            `badge badge--${
                ROTULOS_TIPO[tipo]
                    ? tipo
                    : "individual"
            }`;

        badge.textContent =
            ROTULOS_TIPO[tipo] ||
            "Conta Individual";
    }

    const heroSub =
        $("heroSub");

    if (heroSub) {
        heroSub.textContent =
            SUBTITULO_POR_TIPO[
                tipo
            ] ||
            SUBTITULO_POR_TIPO
                .individual;
    }

    const tituloHero =
        tipo === "empresa" &&
        usuario.nome_empresa
            ? usuario.nome_empresa
            : nomeCompleto;

    const heroNome =
        $("heroNome");

    if (heroNome) {
        heroNome.textContent =
            tituloHero ||
            "Meu perfil";
    }

    montarAvatar(
        usuario.fotoUrl ||
        usuario.foto_perfil ||
        (
            tipo === "empresa"
                ? usuario.logo_empresa
                : ""
        ),
        tituloHero
    );

    dadosReais.email =
        usuario.email || "";

    dadosReais.cpf =
        formatarCPF(
            usuario.cpf
        );

    setValor(
        "nome",
        usuario.nome
    );

    setValor(
        "sobrenome",
        usuario.sobrenome
    );

    setValor(
        "telefone",
        formatarTelefone(
            usuario.telefone
        )
    );

    document
        .querySelectorAll(
            ".btn-revelar"
        )
        .forEach((botao) => {
            ocultar(botao);
        });

    aplicarSecoes(
        tipo,
        Boolean(endereco)
    );

    if (tipo === "empresa") {
        preencherEmpresa(
            usuario
        );
    }

    if (tipo === "admin") {
        setValor(
            "adminStatus",

            usuario.status
                ? (
                    usuario.status
                        .charAt(0)
                        .toUpperCase() +
                    usuario.status
                        .slice(1)
                )
                : ""
        );

        setValor(
            "adminUltimoLogin",
            formatarData(
                usuario.ultimo_login
            )
        );
    }

    if (endereco) {
        preencherEndereco(
            endereco
        );
    }
}

// ==========================================================
// CARREGAR PERFIL
// ==========================================================
async function carregarPerfil() {
    const formulario =
        $("formPerfil");

    if (formulario) {
        formulario.classList.add(
            "carregando"
        );
    }

    const avisoErro =
        $("avisoErro");

    if (avisoErro) {
        avisoErro.hidden = true;
    }

    try {
        const resposta =
            await fetchAutenticado(
                "/api/perfil/meu-perfil"
            );

        const dados =
            await resposta
                .json()
                .catch(() => ({}));

        if (
            !resposta.ok ||
            !dados.sucesso ||
            !dados.usuario
        ) {
            throw new Error(
                dados.mensagem ||
                dados.erro ||
                "Não foi possível carregar as informações atualizadas do servidor."
            );
        }

        const {
            senha,
            ...usuario
        } = dados.usuario;

        Object.assign(
            sessao.dados,
            usuario
        );

        delete sessao.dados.senha;

        sessao.storage.setItem(
            sessao.chave,
            JSON.stringify(
                sessao.dados
            )
        );

        configurarBotaoVoltar(
            usuario.tipo
        );

        preencherPerfil(usuario);
    } catch (erro) {
        console.error(
            "Erro ao carregar perfil:",
            erro
        );

        const avisoErroTexto =
            $("avisoErroTexto");

        if (avisoErroTexto) {
            avisoErroTexto.textContent =
                `${erro.message} Mostrando os dados salvos neste navegador.`;
        }

        if (avisoErro) {
            avisoErro.hidden = false;
        }

        const {
            senha,
            ...cache
        } = sessao.dados;

        preencherPerfil(cache);
    } finally {
        if (formulario) {
            formulario.classList.remove(
                "carregando"
            );
        }
    }
}

// ==========================================================
// BOTÕES VER E OCULTAR
// ==========================================================
function marcarBotao(
    botao,
    visivel
) {
    if (!botao) return;

    botao.dataset.visivel =
        visivel ? "1" : "0";

    botao.textContent =
        visivel
            ? "Ocultar"
            : "Ver";

    botao.classList.toggle(
        "ativo",
        visivel
    );

    botao.setAttribute(
        "aria-pressed",
        String(visivel)
    );
}

function ocultar(botao) {
    if (!botao) return;

    const alvo =
        botao.dataset.alvo;

    const input = $(alvo);

    clearTimeout(
        timers[alvo]
    );

    if (input) {
        if (alvo === "email") {
            input.value =
                dadosReais.email
                    ? gerarMascaraEmail(
                        dadosReais.email
                    )
                    : "";
        } else if (
            alvo === "cpf"
        ) {
            input.value =
                dadosReais.cpf
                    ? MASCARA_CPF
                    : "";
        } else if (
            alvo ===
            "senhaAtualPerfil"
        ) {
            input.value =
                MASCARA_SENHA;

            input.type =
                "password";
        }
    }

    marcarBotao(
        botao,
        false
    );
}

function revelar(botao) {
    const alvo =
        botao.dataset.alvo;

    const input = $(alvo);

    if (!input) return;

    if (
        botao.dataset.visivel ===
        "1"
    ) {
        ocultar(botao);
        return;
    }

    if (
        alvo ===
        "senhaAtualPerfil"
    ) {
        abrirModalSenha();
        return;
    }

    if (
        !dadosReais[alvo]
    ) {
        return;
    }

    input.value =
        dadosReais[alvo];

    marcarBotao(
        botao,
        true
    );

    clearTimeout(
        timers[alvo]
    );

    timers[alvo] =
        setTimeout(
            () => {
                ocultar(botao);
            },
            AUTO_OCULTAR_MS
        );
}

function configurarBotoesRevelar() {
    document
        .querySelectorAll(
            ".btn-revelar"
        )
        .forEach((botao) => {
            botao.addEventListener(
                "click",
                () => {
                    revelar(botao);
                }
            );
        });
}

// ==========================================================
// MODAL DE SENHA
// ==========================================================
function mostrarErroSenha(
    mensagem
) {
    const erro =
        $("erroSenha");

    if (erro) {
        erro.textContent =
            mensagem || "";

        erro.hidden =
            !mensagem;
    }

    const campoModal =
        document.querySelector(
            ".campo-modal"
        );

    if (campoModal) {
        campoModal.classList.toggle(
            "invalido",
            Boolean(mensagem)
        );
    }
}

function abrirModalSenha() {
    focoAnterior =
        document.activeElement;

    const input =
        $("senhaDigitadaModal");

    if (!input) return;

    input.value = "";
    input.type = "password";

    const botaoVer =
        $("btnVerSenhaModal");

    if (botaoVer) {
        botaoVer.textContent =
            "Ver";

        botaoVer.setAttribute(
            "aria-pressed",
            "false"
        );
    }

    mostrarErroSenha("");

    const modal =
        $("modalSenha");

    if (modal) {
        modal.hidden = false;
    }

    input.focus();
}

function fecharModalSenha() {
    const modal =
        $("modalSenha");

    if (modal) {
        modal.hidden = true;
    }

    const input =
        $("senhaDigitadaModal");

    if (input) {
        input.value = "";
    }

    if (
        focoAnterior &&
        typeof focoAnterior.focus ===
            "function"
    ) {
        focoAnterior.focus();
    }
}

function toggleSenhaModal() {
    const input =
        $("senhaDigitadaModal");

    const botao =
        $("btnVerSenhaModal");

    if (!input || !botao) {
        return;
    }

    const mostrar =
        input.type === "password";

    input.type =
        mostrar
            ? "text"
            : "password";

    botao.textContent =
        mostrar
            ? "Ocultar"
            : "Ver";

    botao.setAttribute(
        "aria-pressed",
        String(mostrar)
    );
}

async function confirmarSenhaModal() {
    const input =
        $("senhaDigitadaModal");

    const botao =
        $("btnConfirmarModal");

    if (!input || !botao) {
        return;
    }

    const senhaDigitada =
        input.value;

    if (!senhaDigitada) {
        mostrarErroSenha(
            "Por favor, digite sua senha atual."
        );

        input.focus();
        return;
    }

    if (!getToken()) {
        toast(
            "Sessão expirada. Faça login novamente.",
            "erro"
        );

        encerrarSessao();
        return;
    }

    botao.disabled = true;
    botao.textContent =
        "Verificando...";

    mostrarErroSenha("");

    try {
        const resposta =
            await fetchAutenticado(
                "/api/usuarios/verificar-senha",
                {
                    method: "POST",

                    body: JSON.stringify({
                        senha:
                            senhaDigitada
                    })
                }
            );

        const resultado =
            await resposta
                .json()
                .catch(() => ({}));

        if (
            resposta.ok &&
            resultado.sucesso
        ) {
            const campo =
                $("senhaAtualPerfil");

            const botaoSenha =
                document.querySelector(
                    '[data-alvo="senhaAtualPerfil"]'
                );

            if (campo) {
                campo.value =
                    senhaDigitada;

                campo.type =
                    "text";
            }

            if (botaoSenha) {
                marcarBotao(
                    botaoSenha,
                    true
                );

                clearTimeout(
                    timers
                        .senhaAtualPerfil
                );

                timers
                    .senhaAtualPerfil =
                    setTimeout(
                        () => {
                            ocultar(
                                botaoSenha
                            );
                        },

                        AUTO_OCULTAR_MS
                    );
            }

            fecharModalSenha();
        } else {
            mostrarErroSenha(
                resultado.erro ||
                resultado.mensagem ||
                "Senha incorreta."
            );

            input.value = "";
            input.focus();
        }
    } catch (erro) {
        console.error(
            "Erro ao validar senha:",
            erro
        );

        mostrarErroSenha(
            "Erro de conexão ao tentar validar a senha."
        );
    } finally {
        botao.disabled = false;
        botao.textContent =
            "Confirmar";
    }
}

function configurarModal() {
    const modal =
        $("modalSenha");

    const btnCancelar =
        $("btnCancelarModal");

    const btnConfirmar =
        $("btnConfirmarModal");

    const btnVer =
        $("btnVerSenhaModal");

    const input =
        $("senhaDigitadaModal");

    if (btnCancelar) {
        btnCancelar.addEventListener(
            "click",
            fecharModalSenha
        );
    }

    if (btnConfirmar) {
        btnConfirmar.addEventListener(
            "click",
            confirmarSenhaModal
        );
    }

    if (btnVer) {
        btnVer.addEventListener(
            "click",
            toggleSenhaModal
        );
    }

    if (modal) {
        modal.addEventListener(
            "click",
            (evento) => {
                if (
                    evento.target === modal
                ) {
                    fecharModalSenha();
                }
            }
        );
    }

    if (input) {
        input.addEventListener(
            "input",
            () => {
                mostrarErroSenha("");
            }
        );
    }

    document.addEventListener(
        "keydown",
        (evento) => {
            if (
                !modal ||
                modal.hidden
            ) {
                return;
            }

            if (
                evento.key === "Escape"
            ) {
                fecharModalSenha();
            } else if (
                evento.key === "Enter" &&
                document.activeElement ===
                    input
            ) {
                evento.preventDefault();
                confirmarSenhaModal();
            }
        }
    );
}

// ==========================================================
// INICIALIZAÇÃO
// ==========================================================
document.addEventListener(
    "DOMContentLoaded",
    async () => {
        sessao = obterSessao();

        if (
            !sessao ||
            !getToken()
        ) {
            encerrarSessao();
            return;
        }

        configurarBotaoVoltar(
            sessao.dados.tipo
        );

        const formulario =
            $("formPerfil");

        if (formulario) {
            formulario.addEventListener(
                "submit",
                (evento) => {
                    evento.preventDefault();
                }
            );
        }

        const tentarNovamente =
            $("btnTentarNovamente");

        if (tentarNovamente) {
            tentarNovamente
                .addEventListener(
                    "click",
                    carregarPerfil
                );
        }

        configurarBotoesRevelar();
        configurarModal();

        await carregarPerfil();
    }
);