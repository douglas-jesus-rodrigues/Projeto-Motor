"use strict";

// ==========================================================
// ESTADO E CONFIGURAÇÕES
// ==========================================================
const CHAVES_SESSAO = ["usuario", "usuario_logado"];

const IMAGEM_PADRAO =
    "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=800&q=80";

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

const COMBUSTIVEIS = {
    gasolina: {
        rotulo: "Gasolina",
        grupo: "liquido",
        tipo: "Combustível líquido",
        icones: ["folha"],
        descricao:
            "Combustível derivado do petróleo que oferece boa resposta de desempenho e autonomia."
    },

    etanol: {
        rotulo: "Etanol",
        grupo: "liquido",
        tipo: "Combustível líquido",
        icones: ["folha"],
        descricao:
            "Biocombustível renovável produzido principalmente a partir da cana-de-açúcar."
    },

    flex: {
        rotulo: "Flex",
        grupo: "liquido",
        tipo: "Combustível líquido",
        icones: ["folha"],
        descricao:
            "Motor capaz de funcionar com gasolina, etanol ou uma mistura dos dois."
    },

    diesel: {
        rotulo: "Diesel",
        grupo: "liquido",
        tipo: "Combustível líquido",
        icones: ["folha"],
        descricao:
            "Combustível utilizado em motores com maior torque e eficiência em longas distâncias."
    },

    eletrico: {
        rotulo: "Elétrico",
        grupo: "eletrico",
        tipo: "Energia elétrica",
        icones: ["raio"],
        descricao:
            "Veículo movido exclusivamente por energia elétrica armazenada em baterias."
    },

    hibrido: {
        rotulo: "Híbrido",
        grupo: "hibrido",
        tipo: "Combustível e energia elétrica",
        icones: ["raio", "folha"],
        descricao:
            "Combina um motor tradicional com um motor elétrico para melhorar a eficiência."
    }
};

const ICONES = {
    raio: "fa-bolt",
    folha: "fa-leaf"
};

let veiculoAtual = null;
let veiculoIdAtual = null;
let enviandoProposta = false;
let temporizadorToast = null;

// ==========================================================
// FUNÇÕES AUXILIARES
// ==========================================================
function definirTexto(id, texto) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = texto ?? "";
    }
}

async function lerRespostaJson(resposta) {
    try {
        return await resposta.json();
    } catch {
        return {};
    }
}

function mostrarToast(mensagem) {
    const toast = document.getElementById("toast");

    if (!toast) {
        console.log(mensagem);
        return;
    }

    toast.textContent = String(mensagem || "");
    toast.hidden = false;

    clearTimeout(temporizadorToast);

    temporizadorToast = setTimeout(() => {
        toast.hidden = true;
    }, 3500);
}

function nomeValido(valor) {
    if (typeof valor !== "string") {
        return null;
    }

    const texto = valor.trim();

    if (!texto || /^\d+$/.test(texto)) {
        return null;
    }

    return texto;
}

function normalizarTexto(valor) {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
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

// ==========================================================
// SESSÃO E AUTENTICAÇÃO
// ==========================================================
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
            // Continua procurando outra chave.
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

    return Boolean(usuario?.id && token);
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

function criarErroSessao() {
    const erro = new Error(
        "Sua sessão expirou. Entre novamente."
    );

    erro.sessaoExpirada = true;

    return erro;
}

// ==========================================================
// COMBUSTÍVEL E CÂMBIO
// ==========================================================
async function carregarListaAuxiliar(url, destino) {
    try {
        const resposta = await fetch(url);

        if (!resposta.ok) {
            return;
        }

        const lista = await resposta.json();

        if (!Array.isArray(lista)) {
            return;
        }

        lista.forEach((item) => {
            if (
                item &&
                item.id != null &&
                item.nome
            ) {
                destino[item.id] =
                    String(item.nome);
            }
        });
    } catch {
        // Mantém os valores padrões.
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

function infoCombustivel(nomeBanco) {
    const nome = normalizarTexto(nomeBanco);

    if (nome.includes("hibrid")) {
        return COMBUSTIVEIS.hibrido;
    }

    if (nome.includes("eletric")) {
        return COMBUSTIVEIS.eletrico;
    }

    if (
        nome.includes("flex") ||
        (
            nome.includes("gasolina") &&
            (
                nome.includes("etanol") ||
                nome.includes("alcool")
            )
        )
    ) {
        return COMBUSTIVEIS.flex;
    }

    if (nome.includes("gasolina")) {
        return COMBUSTIVEIS.gasolina;
    }

    if (
        nome.includes("etanol") ||
        nome.includes("alcool")
    ) {
        return COMBUSTIVEIS.etanol;
    }

    if (nome.includes("diesel")) {
        return COMBUSTIVEIS.diesel;
    }

    return null;
}

function aplicarIcones(id, icones) {
    const elemento = document.getElementById(id);

    if (!elemento) {
        return;
    }

    const lista =
        Array.isArray(icones) &&
        icones.length > 0
            ? icones
            : ["bomba"];

    const elementos = lista.map((nome) => {
        const icone =
            document.createElement("i");

        icone.setAttribute(
            "aria-hidden",
            "true"
        );

        if (nome === "bomba") {
            icone.className =
                "fa-solid fa-gas-pump";
        } else {
            icone.className =
                `fa-solid ${ICONES[nome]} ic-${nome}`;
        }

        return icone;
    });

    elemento.replaceChildren(...elementos);
}

function mostrarTipoCombustivel(nomeBanco) {
    const info = infoCombustivel(nomeBanco);
    const icones = info?.icones || null;

    aplicarIcones(
        "chipCombIcones",
        icones
    );

    aplicarIcones(
        "specCombIcones",
        icones
    );

    const caixa =
        document.getElementById(
            "combustivelInfo"
        );

    if (!caixa) {
        return;
    }

    if (!info) {
        caixa.hidden = true;
        return;
    }

    aplicarIcones(
        "combustivelInfoIcones",
        info.icones
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

    const chip =
        document.getElementById(
            "chipCombustivel"
        );

    if (chip) {
        chip.title =
            `${info.rotulo}: ${info.tipo}`;
    }
}

// ==========================================================
// INICIALIZAÇÃO
// ==========================================================
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

// ==========================================================
// CARREGAR DADOS DO VEÍCULO
// ==========================================================
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
                    `/api/veiculos/${encodeURIComponent(
                        id
                    )}`
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
            `${marca} ${modelo}`
                .replace(/\s+/g, " ")
                .trim();

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

        definirTexto(
            "specAno",
            ano
        );

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
            String(veiculo.descricao).trim()
        ) {
            definirTexto(
                "descricaoVeiculo",
                veiculo.descricao
            );
        }

        montarGaleria(veiculo);
        renderizarCardContato(veiculo);

        if (loadingEl) {
            loadingEl.style.display =
                "none";
        }

        if (conteudoEl) {
            conteudoEl.style.display =
                "block";
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

// ==========================================================
// GALERIA
// ==========================================================
function montarGaleria(veiculo) {
    const fotoPrincipal =
        document.getElementById(
            "fotoPrincipal"
        );

    const miniaturas =
        document.getElementById(
            "miniaturas"
        );

    if (!fotoPrincipal) {
        return;
    }

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

    fotoPrincipal.onerror = () => {
        fotoPrincipal.onerror = null;
        fotoPrincipal.src =
            IMAGEM_PADRAO;
    };

    fotoPrincipal.src = principal;

    fotoPrincipal.alt =
        `Foto de ${
            veiculo.marca_nome ||
            veiculo.marca ||
            ""
        } ${
            veiculo.modelo_nome ||
            veiculo.modelo ||
            ""
        }`.trim();

    if (
        !miniaturas ||
        fotos.length <= 1
    ) {
        if (miniaturas) {
            miniaturas.hidden = true;
        }

        return;
    }

    miniaturas.innerHTML = "";

    fotos.forEach((url, indice) => {
        const botao =
            document.createElement("button");

        const imagem =
            document.createElement("img");

        botao.type = "button";

        botao.className =
            indice === 0
                ? "ativa"
                : "";

        botao.setAttribute(
            "aria-label",
            `Ver foto ${indice + 1}`
        );

        imagem.src = url;
        imagem.alt = "";

        imagem.onerror = () => {
            botao.remove();
        };

        botao.appendChild(imagem);

        botao.addEventListener(
            "click",
            () => {
                fotoPrincipal.src = url;

                miniaturas
                    .querySelectorAll("button")
                    .forEach((item) => {
                        item.classList.remove(
                            "ativa"
                        );
                    });

                botao.classList.add("ativa");
            }
        );

        miniaturas.appendChild(botao);
    });

    miniaturas.hidden = false;
}

// ==========================================================
// CARD DE CONTATO
// ==========================================================
function renderizarCardContato(veiculo) {
    const card =
        document.getElementById(
            "contatoCard"
        );

    if (!card) {
        return;
    }

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
            A mensagem será enviada para a conversa já existente.
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
        .getElementById(
            "btnAbrirProposta"
        )
        ?.addEventListener(
            "click",
            abrirFluxoProposta
        );
}

// ==========================================================
// REGISTRAR VISUALIZAÇÃO
// ==========================================================
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
                    Authorization:
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

// ==========================================================
// FAVORITOS
// ==========================================================
function lerFavoritos() {
    try {
        const lista = JSON.parse(
            localStorage.getItem(
                "favoritos_veiculos"
            )
        );

        return Array.isArray(lista)
            ? lista.map(Number)
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

    if (!botao || !icone) {
        return;
    }

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

            const indice =
                favoritos.indexOf(
                    idNumerico
                );

            let ehFavorito;

            if (indice >= 0) {
                favoritos.splice(indice, 1);
                ehFavorito = false;
            } else {
                favoritos.push(idNumerico);
                ehFavorito = true;
            }

            favoritos = [
                ...new Set(favoritos)
            ];

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

// ==========================================================
// CONTROLE DOS MODAIS
// ==========================================================
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

function abrirModalImagem(url) {
    const modal =
        document.getElementById(
            "modalImagem"
        );

    const imagem =
        document.getElementById(
            "imagemAmpliada"
        );

    if (!modal || !imagem) {
        return;
    }

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
        modal.classList.remove("ativo");
    }

    atualizarBloqueioScroll();
}

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
        .getElementById(
            "modalImagem"
        )
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

                if (!botao) {
                    return;
                }

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

// ==========================================================
// PROPOSTA E MENSAGEM AUTOMÁTICA
// ==========================================================
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
        "O veículo ainda está disponível? " +
        "Gostaria de conversar sobre a negociação." +
        assinatura;

    return mensagem.slice(0, 255);
}

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

    if (!modal) {
        return;
    }

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

function enviarPropostaModal() {
    abrirFluxoProposta();
}

// ==========================================================
// CONVERSA ÚNICA ENTRE AS DUAS CONTAS
// ==========================================================
async function buscarConversaExistente(
    destinatarioId,
    token
) {
    const resposta = await fetch(
        "/api/conversas",
        {
            method: "GET",

            headers: {
                Authorization:
                    `Bearer ${token}`
            }
        }
    );

    const dados =
        await lerRespostaJson(resposta);

    if (
        resposta.status === 401 ||
        resposta.status === 403
    ) {
        throw criarErroSessao();
    }

    if (!resposta.ok) {
        throw new Error(
            dados.erro ||
            dados.mensagem ||
            "Não foi possível consultar as conversas."
        );
    }

    const conversas =
        Array.isArray(dados.conversas)
            ? dados.conversas
            : [];

    const conversasComUsuario =
        conversas.filter(
            (conversa) =>
                Number(
                    conversa.outro_usuario_id
                ) === Number(
                    destinatarioId
                )
        );

    if (
        conversasComUsuario.length === 0
    ) {
        return null;
    }

    /*
     * Prioriza a conversa direta.
     * Se ela não existir, reutiliza qualquer conversa
     * já existente com a mesma conta.
     */
    const conversaDireta =
        conversasComUsuario.find(
            (conversa) =>
                !Number(
                    conversa.veiculo_id
                )
        );

    const conversaEscolhida =
        conversaDireta ||
        conversasComUsuario[0];

    const conversaId =
        Number(conversaEscolhida.id);

    if (
        !Number.isInteger(conversaId) ||
        conversaId <= 0
    ) {
        return null;
    }

    return conversaId;
}

async function criarConversaDireta(
    destinatarioId,
    token
) {
    const resposta = await fetch(
        "/api/conversas/iniciar-direta",
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json",

                Authorization:
                    `Bearer ${token}`
            },

            body: JSON.stringify({
                destinatario_id:
                    destinatarioId
            })
        }
    );

    const dados =
        await lerRespostaJson(resposta);

    if (
        resposta.status === 401 ||
        resposta.status === 403
    ) {
        throw criarErroSessao();
    }

    if (
        !resposta.ok ||
        !dados.sucesso
    ) {
        throw new Error(
            dados.erro ||
            dados.mensagem ||
            "Não foi possível iniciar a conversa."
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

    return conversaId;
}

async function obterConversaUnica(
    destinatarioId,
    token
) {
    const conversaExistenteId =
        await buscarConversaExistente(
            destinatarioId,
            token
        );

    if (conversaExistenteId) {
        return conversaExistenteId;
    }

    return criarConversaDireta(
        destinatarioId,
        token
    );
}

async function enviarMensagemNaConversa(
    conversaId,
    texto,
    token
) {
    const resposta = await fetch(
        `/api/conversas/${encodeURIComponent(
            conversaId
        )}/mensagem`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json",

                Authorization:
                    `Bearer ${token}`
            },

            body: JSON.stringify({
                texto
            })
        }
    );

    const dados =
        await lerRespostaJson(resposta);

    if (
        resposta.status === 401 ||
        resposta.status === 403
    ) {
        throw criarErroSessao();
    }

    if (
        !resposta.ok ||
        !dados.sucesso
    ) {
        throw new Error(
            dados.erro ||
            dados.mensagem ||
            "Não foi possível enviar a mensagem."
        );
    }

    return dados;
}

// ==========================================================
// ENVIAR MENSAGEM AO ANUNCIANTE
// ==========================================================
async function enviarProposta() {
    if (enviandoProposta) {
        return;
    }

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

    const anuncianteId =
        Number(
            veiculoAtual?.usuario_id ||
            veiculoAtual?.proprietario_id ||
            0
        );

    if (
        !Number.isInteger(anuncianteId) ||
        anuncianteId <= 0
    ) {
        mostrarToast(
            "Não foi possível identificar o anunciante."
        );

        return;
    }

    if (
        Number(usuario.id) ===
        anuncianteId
    ) {
        mostrarToast(
            "Você não pode enviar mensagem para o próprio anúncio."
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
         * Procura uma conversa com a conta.
         * Não usa o veículo como chave da conversa.
         */
        const conversaId =
            await obterConversaUnica(
                anuncianteId,
                token
            );

        await enviarMensagemNaConversa(
            conversaId,
            texto,
            token
        );

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

        if (erro.sessaoExpirada) {
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