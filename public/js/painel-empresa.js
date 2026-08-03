// ==========================================
// USUÁRIO LOGADO
// ==========================================
const usuario = JSON.parse(localStorage.getItem("usuario"));

// ==========================================
// ELEMENTOS PRINCIPAIS
// ==========================================
const linksMenu = document.querySelectorAll("[data-section]");
const secoes = document.querySelectorAll(".secao");

const nomeEmpresa = document.getElementById("nomeEmpresa");
const emailEmpresa = document.getElementById("emailEmpresa");

const totalVeiculos = document.getElementById("totalVeiculos");
const totalPropostas = document.getElementById("totalPropostas");
const totalConversas = document.getElementById("totalConversas");
const totalVisualizacoes = document.getElementById("totalVisualizacoes");

const listaVeiculos = document.getElementById("listaVeiculos");

const btnSair = document.getElementById("btnSair");

// ==========================================
// PROTEÇÃO DO PAINEL
// ==========================================
if (!usuario) {
    window.location.href = "/pages/login.html";
}

if (usuario && usuario.tipo !== "empresa" && usuario.tipo !== "admin") {
    window.location.href = "/pages/painel-cliente.html";
}

// ==========================================
// TROCAR SEÇÕES DO PAINEL
// ==========================================
linksMenu.forEach((link) => {
    link.addEventListener("click", (event) => {
        event.preventDefault();

        linksMenu.forEach((item) => item.classList.remove("ativo"));
        link.classList.add("ativo");

        const secaoEscolhida = link.dataset.section;

        secoes.forEach((secao) => {
            secao.classList.remove("ativa");
        });

        const secaoAtual = document.getElementById(`${secaoEscolhida}Section`);

        if (secaoAtual) {
            secaoAtual.classList.add("ativa");
        }
    });
});

// ==========================================
// DADOS DA EMPRESA
// ==========================================
if (nomeEmpresa) {
    nomeEmpresa.textContent =
        usuario?.empresa?.nome_empresa ||
        usuario?.nome_empresa ||
        "Empresa";
}


// ==========================================
// DADOS PESSOAIS
// ==========================================
preencherTexto("dadoNome", usuario?.nome);
preencherTexto("dadoSobrenome", usuario?.sobrenome);
preencherTexto("dadoEmail", usuario?.email);
preencherTexto("dadoTelefone", usuario?.telefone);
preencherTexto("dadoCpf", usuario?.cpf);
preencherTexto("dadoTipo", usuario?.tipo);

// ==========================================
// DADOS DA EMPRESA DETALHADOS
// ==========================================
preencherTexto("dadoEmpresa", usuario?.empresa?.nome_empresa);
preencherTexto("dadoCnpj", usuario?.empresa?.cnpj);
preencherTexto("dadoRazaoSocial", usuario?.empresa?.razao_social);
preencherTexto("dadoInscricao", usuario?.empresa?.inscricao_estadual);
preencherTexto("dadoSite", usuario?.empresa?.site);

// ==========================================
// LOGOUT
// ==========================================
if (btnSair) {
    btnSair.addEventListener("click", (event) => {
        event.preventDefault();

        localStorage.removeItem("usuario");

        window.location.href = "/pages/login.html";
    });
}

// ==========================================
// CARREGAR VEÍCULOS DA EMPRESA
// ==========================================
async function carregarVeiculos() {
    try {
        const resposta = await fetch("/api/veiculos");
        const data = await resposta.json();

        if (!data.sucesso) {
            listaVeiculos.innerHTML = `
                <p class="vazio">Erro ao buscar veículos.</p>
            `;
            return;
        }

        const meusVeiculos = data.veiculos.filter((veiculo) => {
            return Number(veiculo.usuario_id) === Number(usuario.id);
        });

        totalVeiculos.textContent = meusVeiculos.length;
        totalPropostas.textContent = "0";
        totalConversas.textContent = "0";
        totalVisualizacoes.textContent = "0";

        if (meusVeiculos.length === 0) {
            listaVeiculos.innerHTML = `
                <p class="vazio">Nenhum veículo cadastrado ainda.</p>
            `;
            return;
        }

        listaVeiculos.innerHTML = "";

        meusVeiculos.forEach((veiculo) => {
            const card = document.createElement("div");
            card.classList.add("card-veiculo");

            const imagem = veiculo.imagem
                ? `/uploads/${veiculo.imagem}`
                : "/imagens/sem-foto.png";

            card.innerHTML = `
                <div class="imagem-veiculo">
                    <img src="${imagem}" alt="${veiculo.marca} ${veiculo.modelo}">
                </div>

                <div class="info-veiculo">
                    <h4>${veiculo.marca} ${veiculo.modelo}</h4>
                    <p class="ano">${veiculo.ano_modelo || "-"}</p>

                    <strong class="preco">
                        ${formatarPreco(veiculo.preco)}
                    </strong>
                </div>

                <div class="acoes">
                    <button class="btn-editar" type="button">
                        Editar
                    </button>

                    <button class="btn-excluir" type="button">
                        Excluir
                    </button>
                </div>
            `;

            listaVeiculos.appendChild(card);
        });

    } catch (erro) {
        console.error("Erro ao carregar veículos:", erro);

        if (listaVeiculos) {
            listaVeiculos.innerHTML = `
                <p class="vazio">Erro ao carregar veículos.</p>
            `;
        }
    }
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================
function preencherTexto(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor || "-";
    }
}

function formatarPreco(valor) {
    if (!valor) return "R$ 0,00";

    return Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

// ==========================================
// INICIAR
// ==========================================
carregarVeiculos();