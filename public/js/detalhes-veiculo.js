"use strict";

// ==========================================
// ESTADO E UTILITÁRIOS
// ==========================================
const CHAVES_SESSAO = ["usuario", "usuario_logado"];

const IMAGEM_PADRAO =
    "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=800&q=80";

let veiculoAtual = null;
let veiculoIdAtual = null;

// ==========================================
// COMBUSTÍVEL E CÂMBIO
// ==========================================
const ICONES = {
    raio: { classe: "fa-bolt" },
    folha: { classe: "fa-leaf" }
};

const COMBUSTIVEIS = {
    gasolina: {
        rotulo: "Gasolina",
        grupo: "liquido",
        tipo: "Combustível líquido",
        icones: ["folha"],
        descricao:
            "O combustível fóssil mais comum para veículos leves, derivado do petróleo, que oferece uma boa resposta de desempenho e autonomia."
    },

    etanol: {
        rotulo: "Etanol",
        grupo: "liquido",
        tipo: "Combustível líquido",
        icones: ["folha"],
        descricao:
            "Um biocombustível renovável produzido a partir da cana-de-açúcar, que emite menos poluentes."
    },

    flex: {
        rotulo: "Flex",
        grupo: "liquido",
        tipo: "Combustível líquido",
        icones: ["folha"],
        descricao:
            "Veículos equipados com motores capazes de funcionar com gasolina, etanol ou uma mistura dos dois combustíveis."
    },

    diesel: {
        rotulo: "Diesel",
        grupo: "liquido",
        tipo: "Combustível líquido",
        icones: ["folha"],
        descricao:
            "Combustível utilizado em motores que oferecem maior torque e eficiência em longas distâncias."
    },

    eletrico: {
        rotulo: "Elétrico",
        grupo: "eletrico",
        tipo: "Energia elétrica",
        icones: ["raio"],
        descricao:
            "Veículos que funcionam exclusivamente com energia elétrica armazenada em baterias recarregáveis."
    },

    hibrido: {
        rotulo: "Híbrido",
        grupo: "hibrido",
        tipo: "Combustível + elétrico",
        icones: ["raio", "folha"],
        descricao:
            "Veículos que combinam um motor tradicional com um motor elétrico para melhorar a eficiência energética."
    }
};

const nomesCombustivel = {
    1: "Gasolina",
    2: "Etanol",
    3: "Flex",
    4: "Diesel",
    5: "Elétrico",
    6: "Híbrido"
};

const nomesCambio = {
    1: "Manual",
    2: "Automático",
    3: "Semi-automático"
};

async function carregarListaAuxiliar(url, destino) {
    try {
        const resposta = await fetch(url);

        if (!resposta.ok) return;

        const lista = await resposta.json();

        if (!Array.isArray(lista)) return;

        lista.forEach((item) => {
            if (item && item.id != null && item.nome) {
                destino[item.id] = String(item.nome);
            }
        });
    } catch {
        // Mantém os nomes padrões definidos acima.
    }
}

function carregarListasAuxiliares() {
    return Promise.all([
        carregarListaAuxiliar(
            "/api/combustiveis",
            nomesCombustivel
        ),

        carregarListaAuxiliar(
            "/api/cambios",
            nomesCambio
        )
    ]);
}

function nomeValido(valor) {
    if (typeof valor !== "string") return null;

    const texto = valor.trim();

    return texto && !/^\d+$/.test(texto)
        ? texto
        : null;
}

function normalizarTexto(valor) {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function infoCombustivel(nomeBanco) {
    const nome = normalizarTexto(nomeBanco);

    let chave = null;

    if (nome.includes("hibrid")) {
        chave = "hibrido";
    } else if (nome.includes("eletric")) {
        chave = "eletrico";
    } else if (
        nome.includes("flex") ||
        (
            nome.includes("gasolina") &&
            (
                nome.includes("etanol") ||
                nome.includes("alcool")
            )
        )
    ) {
        chave = "flex";
    } else if (nome.includes("gasolina")) {
        chave = "gasolina";
    } else if (
        nome.includes("etanol") ||
        nome.includes("alcool")
    ) {
        chave = "etanol";
    } else if (nome.includes("diesel")) {
        chave = "diesel";
    }

    return chave
        ? COMBUSTIVEIS[chave]
        : null;
}

function aplicarIcones(id, icones) {
    const elemento = document.getElementById(id);

    if (!elemento) return;

    const lista =
        Array.isArray(icones) && icones.length
            ? icones
            : ["bomba"];

    const elementos = lista.map((nome) => {
        const icone = document.createElement("i");

        icone.setAttribute("aria-hidden", "true");

        icone.className =
            nome === "bomba"
                ? "fa-solid fa-gas-pump"
                : `fa-solid ${ICONES[nome].classe} ic-${nome}`;

        return icone;
    });

    elemento.replaceChildren(...elementos);
}

function mostrarTipoCombustivel(nomeBanco) {
    const info = infoCombustivel(nomeBanco);
    const icones = info ? info.icones : null;

    aplicarIcones("chipCombIcones", icones);
    aplicarIcones("specCombIcones", icones);

    const caixa = document.getElementById(
        "combustivelInfo"
    );

    if (!caixa) return;

    if (!info) {
        caixa.hidden = true;
        return;
    }

    aplicarIcones(
        "combustivelInfoIcones",
        icones
    );

    definirTexto(
        "combustivelInfoNome",
        nomeBanco
    );

    definirTexto(
        "combustivelInfoTipo",
        info.tipo
    );

    definirTexto(
        "combustivelInfoTexto",
        info.descricao
    );

    caixa.className =
        `combustivel-info combustivel-info--${info.grupo}`;

    caixa.hidden = false;

    const chip = document.getElementById(
        "chipCombustivel"
    );

    if (chip) {
        chip.title =
            `${info.rotulo}: ${info.tipo}`;
    }
}

// ==========================================
// SESSÃO E AUTENTICAÇÃO
// ==========================================
function lerUsuario() {
    for (const chave of CHAVES_SESSAO) {
        const valor =
            localStorage.getItem(chave) ||
            sessionStorage.getItem(chave);

        if (
            !valor ||
            valor === "undefined" ||
            valor === "null"
        ) {
            continue;
        }

        try {
            const usuario = JSON.parse(valor);

            if (
                usuario &&
                typeof usuario === "object"
            ) {
                return usuario;
            }
        } catch {
            // Tenta a próxima chave.
        }
    }

    return null;
}

function obterToken() {
    return (
        localStorage.getItem("token") ||
        sessionStorage.getItem("token")
    );
}

function usuarioEstaLogado() {
    const usuario = lerUsuario();
    const token = obterToken();

    return Boolean(
        usuario?.id &&
        token
    );
}

function obterRotaPainel(usuario) {
    if (!usuario) {
        return "/pages/login.html";
    }

    if (usuario.tipo === "empresa") {
        return "/pages/painel-empresa.html";
    }

    if (
        ["admin", "super_admin"].includes(
            usuario.tipo
        ) ||
        usuario.cargo === "admin"
    ) {
        return "/pages/painel-admin.html";
    }

    return "/pages/painel-cliente.html";
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================
function normalizarUrlImagem(valor) {
    if (typeof valor !== "string") {
        return null;
    }

    let caminho = valor.trim();

    if (
        !caminho ||
        ["null", "undefined", "false", "0"].includes(
            caminho.toLowerCase()
        )
    ) {
        return null;
    }

    if (
        /^(data:image\/|blob:|https?:\/\/|\/\/)/i.test(
            caminho
        )
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

    return `/uploads/${encodeURIComponent(caminho)}`;
}

function formatarPreco(valor) {
    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
        return "R$ --";
    }

    return numero.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function definirTexto(id, texto) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = texto;
    }
}

async function lerRespostaJson(resposta) {
    try {
        return await resposta.json();
    } catch {
        return {};
    }
}

let temporizadorToast = null;

function mostrarToast(mensagem) {
    const toast = document.getElementById("toast");

    if (!toast) {
        console.log(mensagem);
        return;
    }

    toast.textContent = mensagem;
    toast.hidden = false;

    clearTimeout(temporizadorToast);

    temporizadorToast = setTimeout(() => {
        toast.hidden = true;
    }, 3500);
}

function atualizarBloqueioScroll() {
    const propostaAberta =
        !document.getElementById(
            "modalProposta"
        )?.hidden;

    const loginAberto =
        !document.getElementById(
            "modalLoginNecessario"
        )?.hidden;

    const imagemAberta =
        document.getElementById(
            "modalImagem"
        )?.classList.contains("ativo");

    document.body.classList.toggle(
        "modal-aberto",
        Boolean(
            propostaAberta ||
            loginAberto ||
            imagemAberta
        )
    );
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener(
    "DOMContentLoaded",
    async () => {
        window.addEventListener(
            "pageshow",
            (evento) => {
                if (evento.persisted) {
                    window.location.reload();
                }
            }
        );

        const parametros =
            new URLSearchParams(
                window.location.search
            );

        veiculoIdAtual =
            parametros.get("id");

        if (!veiculoIdAtual) {
            alert("Veículo não especificado!");

            window.location.href =
                "/pages/catalogo.html";

            return;
        }

        configurarModais();

        await carregarDetalhesDoCarro(
            veiculoIdAtual
        );

        configurarBotaoFavorito(
            veiculoIdAtual
        );

        registrarVisualizacaoUnica(
            veiculoIdAtual
        );
    }
);

// ==========================================
// BUSCAR VEÍCULO
// ==========================================
async function carregarDetalhesDoCarro(id) {
    const loadingEl =
        document.getElementById("loading");

    const conteudoEl =
        document.getElementById(
            "conteudoVeiculo"
        );

    try {
        const [resposta] =
            await Promise.all([
                fetch(
                    `/api/veiculos/${encodeURIComponent(id)}`
                ),

                carregarListasAuxiliares()
            ]);

        const dados =
            await lerRespostaJson(resposta);

        if (
            !resposta.ok ||
            !dados.sucesso ||
            !dados.veiculo
        ) {
            alert("Veículo não encontrado.");

            window.location.href =
                "/pages/catalogo.html";

            return;
        }

        const veiculo = dados.veiculo;

        veiculoAtual = veiculo;

        const marca =
            veiculo.marca_nome ||
            veiculo.marca ||
            "Marca";

        const modelo =
            veiculo.modelo_nome ||
            veiculo.modelo ||
            "Modelo";

        const titulo =
            `${marca} ${modelo}`.trim();

        document.title =
            `${titulo} - MotorFlex`;

        definirTexto(
            "breadcrumbAtual",
            titulo
        );

        definirTexto(
            "marcaModeloBadge",
            `${marca} / ${modelo}`
        );

        definirTexto(
            "tituloVeiculo",
            titulo
        );

        definirTexto(
            "versaoVeiculo",
            veiculo.versao ||
            "Versão padrão"
        );

        definirTexto(
            "precoVeiculo",
            formatarPreco(veiculo.preco)
        );

        const ano =
            `${veiculo.ano_fabricacao || "--"} / ` +
            `${veiculo.ano_modelo || "--"}`;

        const quilometragem =
            Number(veiculo.quilometragem) > 0
                ? `${Number(
                    veiculo.quilometragem
                ).toLocaleString("pt-BR")} km`
                : "0 km";

        const combustivel =
            nomeValido(
                veiculo.combustivel_nome
            ) ||
            nomeValido(
                veiculo.combustivel
            ) ||
            nomesCombustivel[
                veiculo.tipo_combustivel_id
            ] ||
            "Não informado";

        const cambio =
            nomeValido(
                veiculo.cambio_nome
            ) ||
            nomeValido(
                veiculo.cambio
            ) ||
            nomeValido(
                veiculo.transmissao_nome
            ) ||
            nomesCambio[
                veiculo.tipo_transmissao_id
            ] ||
            "Não informado";

        definirTexto("specAno", ano);

        definirTexto(
            "specQuilometragem",
            quilometragem
        );

        definirTexto(
            "specCombustivel",
            combustivel
        );

        definirTexto(
            "specCambio",
            cambio
        );

        definirTexto(
            "specCor",
            veiculo.cor ||
            "Não informada"
        );

        definirTexto(
            "specPortas",
            veiculo.portas
                ? `${veiculo.portas} portas`
                : "Não informado"
        );

        definirTexto(
            "chipAno",
            veiculo.ano_modelo ||
            veiculo.ano_fabricacao ||
            "--"
        );

        definirTexto(
            "chipKm",
            quilometragem
        );

        definirTexto(
            "chipComb",
            combustivel
        );

        mostrarTipoCombustivel(
            combustivel
        );

        if (
            veiculo.descricao &&
            String(
                veiculo.descricao
            ).trim()
        ) {
            definirTexto(
                "descricaoVeiculo",
                veiculo.descricao
            );
        }

        montarGaleria(veiculo);
        renderizarCardContato(veiculo);

        if (loadingEl) {
            loadingEl.style.display = "none";
        }

        if (conteudoEl) {
            conteudoEl.style.display = "block";
        }
    } catch (erro) {
        console.error(
            "Erro ao carregar detalhes:",
            erro
        );

        if (loadingEl) {
            loadingEl.innerHTML = `
                <p style="color: #e50914;">
                    Erro ao carregar os dados do veículo.
                </p>
            `;
        }
    }
}

// ==========================================
// GALERIA
// ==========================================
function montarGaleria(veiculo) {
    const fotoEl =
        document.getElementById(
            "fotoPrincipal"
        );

    const miniaturasEl =
        document.getElementById(
            "miniaturas"
        );

    if (!fotoEl) return;

    const principal =
        normalizarUrlImagem(
            veiculo.imagem
        ) ||
        IMAGEM_PADRAO;

    const listaBruta =
        Array.isArray(veiculo.fotos)
            ? veiculo.fotos
            : [];

    const fotos = listaBruta
        .map((foto) => {
            if (typeof foto === "string") {
                return foto;
            }

            return (
                foto?.url ||
                foto?.caminho ||
                foto?.caminho_arquivo ||
                foto?.imagem
            );
        })
        .map(normalizarUrlImagem)
        .filter(Boolean);

    if (!fotos.includes(principal)) {
        fotos.unshift(principal);
    }

    fotoEl.onerror = () => {
        fotoEl.onerror = null;
        fotoEl.src = IMAGEM_PADRAO;
    };

    fotoEl.src = principal;

    fotoEl.alt = (
        `Foto de ${
            veiculo.marca_nome ||
            veiculo.marca ||
            ""
        } ${
            veiculo.modelo_nome ||
            veiculo.modelo ||
            ""
        }`
    ).trim();

    if (
        miniaturasEl &&
        fotos.length > 1
    ) {
        miniaturasEl.innerHTML = "";

        fotos.forEach((url, indice) => {
            const botao =
                document.createElement(
                    "button"
                );

            botao.type = "button";

            botao.className =
                indice === 0
                    ? "ativa"
                    : "";

            botao.setAttribute(
                "aria-label",
                `Ver foto ${indice + 1}`
            );

            const imagem =
                document.createElement("img");

            imagem.src = url;
            imagem.alt = "";

            imagem.onerror = () => {
                botao.remove();
            };

            botao.appendChild(imagem);

            botao.addEventListener(
                "click",
                () => {
                    fotoEl.src = url;

                    miniaturasEl
                        .querySelectorAll("button")
                        .forEach((item) => {
                            item.classList.remove(
                                "ativa"
                            );
                        });

                    botao.classList.add(
                        "ativa"
                    );
                }
            );

            miniaturasEl.appendChild(
                botao
            );
        });

        miniaturasEl.hidden = false;
    } else if (miniaturasEl) {
        miniaturasEl.hidden = true;
    }
}

// ==========================================
// CARD DE CONTATO
// ==========================================
function renderizarCardContato(veiculo) {
    const card =
        document.getElementById(
            "contatoCard"
        );

    if (!card) return;

    const usuario = lerUsuario();

    const idDono = Number(
        veiculo.usuario_id ||
        veiculo.proprietario_id ||
        0
    );

    const idAtual =
        usuario?.id
            ? Number(usuario.id)
            : null;

    const ehDono =
        Boolean(
            idAtual &&
            idDono > 0 &&
            idAtual === idDono
        );

    if (ehDono) {
        const destino =
            `${obterRotaPainel(usuario)}` +
            `?editar=${encodeURIComponent(
                veiculo.id ||
                veiculoIdAtual
            )}`;

        card.innerHTML = `
            <span class="selo-dono">
                <i class="fa-solid fa-circle-check"></i>
                Este anúncio é seu
            </span>

            <h3>
                <i class="fa-solid fa-sliders"></i>
                Gestão do Anúncio
            </h3>

            <p>
                Você é o proprietário deste veículo.
                Clique abaixo para editar as informações,
                fotos e preço no seu painel.
            </p>

            <a
                href="${destino}"
                class="btn-proposta secundario"
            >
                <i class="fa-solid fa-pen-to-square"></i>
                Editar meu anúncio
            </a>
        `;

        return;
    }

    card.innerHTML = `
        <h3>
            <i class="fa-solid fa-headset"></i>
            Interessado neste carro?
        </h3>

        <p>
            Envie uma mensagem diretamente ao anunciante.
            Deixamos a mensagem pronta para você.
        </p>

        <button
            type="button"
            class="btn-proposta"
            id="btnAbrirProposta"
        >
            <i class="fa-solid fa-paper-plane"></i>
            Enviar mensagem
        </button>
    `;

    document
        .getElementById("btnAbrirProposta")
        ?.addEventListener(
            "click",
            abrirFluxoProposta
        );
}

// ==========================================
// REGISTRAR VISUALIZAÇÃO
// ==========================================
async function registrarVisualizacaoUnica(
    veiculoId
) {
    try {
        const usuario = lerUsuario();
        const token = obterToken();

        if (!usuario?.id || !token) {
            return;
        }

        const resposta = await fetch(
            `/api/veiculos/${encodeURIComponent(
                veiculoId
            )}/visualizar`,
            {
                method: "POST",

                headers: {
                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );

        if (
            !resposta.ok &&
            resposta.status !== 401 &&
            resposta.status !== 403
        ) {
            console.warn(
                "Não foi possível registrar a visualização."
            );
        }
    } catch (erro) {
        console.error(
            "Erro ao registrar visualização:",
            erro
        );
    }
}

// ==========================================
// FAVORITOS
// ==========================================
function lerFavoritos() {
    try {
        const lista = JSON.parse(
            localStorage.getItem(
                "favoritos_veiculos"
            )
        );

        return Array.isArray(lista)
            ? lista
            : [];
    } catch {
        return [];
    }
}

function configurarBotaoFavorito(
    veiculoId
) {
    const botao =
        document.getElementById(
            "btnFavoritarDetalhe"
        );

    const icone =
        document.getElementById(
            "iconeFavorito"
        );

    if (!botao || !icone) return;

    const idNumerico =
        Number(veiculoId);

    atualizarVisualBotaoFavorito(
        usuarioEstaLogado() &&
        lerFavoritos().includes(
            idNumerico
        ),
        botao,
        icone
    );

    botao.addEventListener(
        "click",
        (evento) => {
            evento.stopPropagation();

            if (!usuarioEstaLogado()) {
                abrirModalLoginNecessario();
                return;
            }

            let favoritos =
                lerFavoritos();

            let ehFavorito;

            if (
                favoritos.includes(
                    idNumerico
                )
            ) {
                favoritos =
                    favoritos.filter(
                        (id) =>
                            id !== idNumerico
                    );

                ehFavorito = false;
            } else {
                favoritos.push(
                    idNumerico
                );

                ehFavorito = true;
            }

            localStorage.setItem(
                "favoritos_veiculos",
                JSON.stringify(favoritos)
            );

            atualizarVisualBotaoFavorito(
                ehFavorito,
                botao,
                icone
            );

            mostrarToast(
                ehFavorito
                    ? "Adicionado aos favoritos"
                    : "Removido dos favoritos"
            );
        }
    );
}

function atualizarVisualBotaoFavorito(
    ehFavorito,
    botao,
    icone
) {
    if (ehFavorito) {
        icone.className =
            "fa-solid fa-heart";

        icone.style.color =
            "#ff2b36";

        botao.setAttribute(
            "aria-pressed",
            "true"
        );

        botao.title =
            "Remover dos favoritos";
    } else {
        icone.className =
            "fa-regular fa-heart";

        icone.style.color =
            "#ffffff";

        botao.setAttribute(
            "aria-pressed",
            "false"
        );

        botao.title =
            "Favoritar veículo";
    }
}

window.addEventListener(
    "storage",
    (evento) => {
        if (
            evento.key !==
            "favoritos_veiculos"
        ) {
            return;
        }

        const botao =
            document.getElementById(
                "btnFavoritarDetalhe"
            );

        const icone =
            document.getElementById(
                "iconeFavorito"
            );

        const id =
            Number(veiculoIdAtual);

        if (botao && icone && id) {
            atualizarVisualBotaoFavorito(
                usuarioEstaLogado() &&
                lerFavoritos().includes(id),
                botao,
                icone
            );
        }
    }
);

// ==========================================
// CONFIGURAÇÃO DOS MODAIS
// ==========================================
function configurarModais() {
    document
        .getElementById("fotoWrapper")
        ?.addEventListener(
            "click",
            () => {
                const foto =
                    document.getElementById(
                        "fotoPrincipal"
                    );

                if (foto) {
                    abrirModalImagem(
                        foto.src
                    );
                }
            }
        );

    document
        .getElementById("modalImagem")
        ?.addEventListener(
            "click",
            fecharModalImagem
        );

    document
        .querySelector(
            ".modal-imagem-conteudo"
        )
        ?.addEventListener(
            "click",
            (evento) => {
                evento.stopPropagation();
            }
        );

    document
        .getElementById(
            "btnFecharImagem"
        )
        ?.addEventListener(
            "click",
            fecharModalImagem
        );

    document
        .getElementById(
            "btnCancelarLogin"
        )
        ?.addEventListener(
            "click",
            fecharModalLoginNecessario
        );

    document
        .getElementById(
            "modalLoginNecessario"
        )
        ?.addEventListener(
            "click",
            (evento) => {
                if (
                    evento.target.id ===
                    "modalLoginNecessario"
                ) {
                    fecharModalLoginNecessario();
                }
            }
        );

    document
        .getElementById(
            "btnFecharProposta"
        )
        ?.addEventListener(
            "click",
            fecharModalProposta
        );

    document
        .getElementById(
            "btnCancelarProposta"
        )
        ?.addEventListener(
            "click",
            fecharModalProposta
        );

    document
        .getElementById(
            "btnEnviarProposta"
        )
        ?.addEventListener(
            "click",
            enviarProposta
        );

    document
        .getElementById(
            "modalProposta"
        )
        ?.addEventListener(
            "click",
            (evento) => {
                if (
                    evento.target.id ===
                    "modalProposta"
                ) {
                    fecharModalProposta();
                }
            }
        );

    document
        .getElementById(
            "propostaChips"
        )
        ?.addEventListener(
            "click",
            (evento) => {
                const botao =
                    evento.target.closest(
                        "button[data-frase]"
                    );

                if (!botao) return;

                const campo =
                    document.getElementById(
                        "propostaTexto"
                    );

                const frase =
                    botao.dataset.frase || "";

                if (
                    campo &&
                    frase &&
                    !campo.value.includes(frase)
                ) {
                    const novoTexto =
                        `${campo.value.trim()} ${frase}`
                            .trim();

                    if (novoTexto.length <= 255) {
                        campo.value = novoTexto;
                    } else {
                        mostrarToast(
                            "A mensagem pode ter no máximo 255 caracteres."
                        );
                    }
                }

                campo?.focus();
            }
        );

    document
        .getElementById(
            "propostaTexto"
        )
        ?.addEventListener(
            "keydown",
            (evento) => {
                if (
                    evento.key === "Enter" &&
                    (
                        evento.ctrlKey ||
                        evento.metaKey
                    )
                ) {
                    evento.preventDefault();
                    enviarProposta();
                }
            }
        );

    document.addEventListener(
        "keydown",
        (evento) => {
            if (evento.key === "Escape") {
                fecharModalImagem();
                fecharModalLoginNecessario();
                fecharModalProposta();
            }
        }
    );
}

// ==========================================
// MODAL DE LOGIN
// ==========================================
function abrirModalLoginNecessario() {
    const modal =
        document.getElementById(
            "modalLoginNecessario"
        );

    if (modal) {
        modal.hidden = false;
    }

    atualizarBloqueioScroll();
}

function fecharModalLoginNecessario() {
    const modal =
        document.getElementById(
            "modalLoginNecessario"
        );

    if (modal) {
        modal.hidden = true;
    }

    atualizarBloqueioScroll();
}

// ==========================================
// MODAL DE IMAGEM
// ==========================================
function abrirModalImagem(url) {
    const modal =
        document.getElementById(
            "modalImagem"
        );

    const imagem =
        document.getElementById(
            "imagemAmpliada"
        );

    if (!modal || !imagem) return;

    imagem.src = url;
    modal.classList.add("ativo");

    atualizarBloqueioScroll();
}

function fecharModalImagem() {
    const modal =
        document.getElementById(
            "modalImagem"
        );

    if (modal) {
        modal.classList.remove(
            "ativo"
        );
    }

    atualizarBloqueioScroll();
}

// ==========================================
// MODAL DE PROPOSTA
// ==========================================
function fecharModalProposta() {
    const modal =
        document.getElementById(
            "modalProposta"
        );

    if (modal) {
        modal.hidden = true;
    }

    atualizarBloqueioScroll();
}

// ==========================================
// MENSAGEM AUTOMÁTICA
// ==========================================
function montarMensagemAutomatica() {
    const usuario = lerUsuario();

    const marca =
        veiculoAtual?.marca_nome ||
        veiculoAtual?.marca ||
        "";

    const modelo =
        veiculoAtual?.modelo_nome ||
        veiculoAtual?.modelo ||
        "";

    const versao =
        veiculoAtual?.versao
            ? ` ${veiculoAtual.versao}`
            : "";

    const ano =
        veiculoAtual?.ano_modelo ||
        veiculoAtual?.ano_fabricacao;

    const preco =
        formatarPreco(
            veiculoAtual?.preco
        );

    const nomeUsuario =
        usuario?.tipo === "empresa"
            ? (
                usuario.empresa?.nome_empresa ||
                usuario.nome_empresa ||
                usuario.nome
            )
            : usuario?.nome;

    const primeiroNome =
        nomeUsuario
            ? String(nomeUsuario)
                .trim()
                .split(/\s+/)[0]
            : "";

    const identificacaoVeiculo =
        `${marca} ${modelo}${versao}`
            .replace(/\s+/g, " ")
            .trim() ||
        "veículo";

    const informacaoAno =
        ano
            ? `, ano ${ano}`
            : "";

    const assinatura =
        primeiroNome
            ? ` Meu nome é ${primeiroNome}.`
            : "";

    const mensagem =
        `Olá! Tenho interesse no ${identificacaoVeiculo}` +
        `${informacaoAno}, anunciado por ${preco}. ` +
        `O veículo ainda está disponível? ` +
        `Gostaria de conversar sobre a negociação.` +
        `${assinatura}`;

    return mensagem.slice(0, 255);
}

// ==========================================
// ABRIR PROPOSTA
// ==========================================
function abrirFluxoProposta() {
    if (!usuarioEstaLogado()) {
        abrirModalLoginNecessario();
        return;
    }

    const usuario = lerUsuario();

    const idDono = Number(
        veiculoAtual?.usuario_id ||
        veiculoAtual?.proprietario_id ||
        0
    );

    if (
        idDono > 0 &&
        Number(usuario?.id) === idDono
    ) {
        mostrarToast(
            "Você não pode enviar mensagem para o próprio anúncio."
        );

        return;
    }

    const modal =
        document.getElementById(
            "modalProposta"
        );

    if (!modal) return;

    const foto =
        document.getElementById(
            "propostaFoto"
        );

    if (foto) {
        foto.src =
            document.getElementById(
                "fotoPrincipal"
            )?.src ||
            IMAGEM_PADRAO;
    }

    definirTexto(
        "propostaTitulo",
        document.getElementById(
            "tituloVeiculo"
        )?.textContent ||
        "Veículo"
    );

    definirTexto(
        "propostaPreco",
        document.getElementById(
            "precoVeiculo"
        )?.textContent ||
        ""
    );

    const campo =
        document.getElementById(
            "propostaTexto"
        );

    if (campo) {
        campo.value =
            montarMensagemAutomatica();

        campo.maxLength = 255;
    }

    modal.hidden = false;

    atualizarBloqueioScroll();

    document
        .getElementById(
            "btnEnviarProposta"
        )
        ?.focus();
}

// Compatibilidade com o nome antigo.
function enviarPropostaModal() {
    abrirFluxoProposta();
}

// ==========================================
// ENVIAR MENSAGEM AO ANUNCIANTE
// ==========================================
let enviandoProposta = false;

async function enviarProposta() {
    if (enviandoProposta) return;

    const usuario = lerUsuario();
    const token = obterToken();

    if (!usuario?.id || !token) {
        fecharModalProposta();
        abrirModalLoginNecessario();
        return;
    }

    const campo =
        document.getElementById(
            "propostaTexto"
        );

    const texto =
        campo?.value.trim() || "";

    if (!texto) {
        mostrarToast(
            "Escreva uma mensagem antes de enviar."
        );

        campo?.focus();
        return;
    }

    if (texto.length > 255) {
        mostrarToast(
            "A mensagem pode ter no máximo 255 caracteres."
        );

        campo?.focus();
        return;
    }

    const veiculoId =
        Number(veiculoIdAtual);

    if (
        !Number.isInteger(veiculoId) ||
        veiculoId <= 0
    ) {
        mostrarToast(
            "Não foi possível identificar o veículo."
        );

        return;
    }

    const botao =
        document.getElementById(
            "btnEnviarProposta"
        );

    const conteudoOriginal =
        botao?.innerHTML || "";

    enviandoProposta = true;

    if (botao) {
        botao.disabled = true;

        botao.innerHTML = `
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            &nbsp;Enviando...
        `;
    }

    try {
        /*
         * Uma única requisição:
         * o servidor localiza o anunciante pelo veículo
         * e grava a mensagem na conversa.
         */
        const resposta = await fetch(
            "/api/conversas/iniciar",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${token}`
                },

                body: JSON.stringify({
                    veiculo_id: veiculoId,
                    texto
                })
            }
        );

        const dados =
            await lerRespostaJson(
                resposta
            );

        if (
            resposta.status === 401 ||
            resposta.status === 403
        ) {
            fecharModalProposta();

            mostrarToast(
                "Sua sessão expirou. Entre novamente."
            );

            setTimeout(() => {
                window.location.href =
                    "/pages/login.html";
            }, 1200);

            return;
        }

        if (
            !resposta.ok ||
            !dados.sucesso ||
            !dados.conversa_id
        ) {
            throw new Error(
                dados.erro ||
                dados.mensagem ||
                "Não foi possível enviar a mensagem ao anunciante."
            );
        }

        const conversaId =
            Number(dados.conversa_id);

        if (
            !Number.isInteger(conversaId) ||
            conversaId <= 0
        ) {
            throw new Error(
                "O servidor não retornou uma conversa válida."
            );
        }

        fecharModalProposta();

        mostrarToast(
            "Mensagem enviada ao anunciante!"
        );

        setTimeout(() => {
            window.location.href =
                `/pages/mensagens.html?conversa=${encodeURIComponent(
                    conversaId
                )}`;
        }, 500);
    } catch (erro) {
        console.error(
            "Erro ao enviar proposta:",
            erro
        );

        mostrarToast(
            erro.message ||
            "Erro ao enviar a mensagem. Tente novamente."
        );
    } finally {
        enviandoProposta = false;

        if (botao) {
            botao.disabled = false;
            botao.innerHTML =
                conteudoOriginal;
        }
    }
}