document.addEventListener("DOMContentLoaded", () => {
    // 1. VERIFICAÇÃO DE SEGURANÇA
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    if (!usuario) {
        window.location.href = "/pages/login.html";
        return;
    }

    // 2. CONFIGURAR BOTÃO DE SAIR
    configurarLogout();

    // 3. CARREGAR OS ANÚNCIOS DO CLIENTE
    carregarMeusAnuncios(usuario.id);

    // Fechar menus dropdown ao clicar fora
    document.addEventListener("click", (e) => {
        if (!e.target.closest('.acoes-container')) {
            fecharTodosMenus();
        }
    });
});

// Função para buscar os anúncios do usuário na API
async function carregarMeusAnuncios(usuarioId) {
    const tabela = document.getElementById("tabelaMeusAnuncios");

    try {
        const resposta = await fetch(`/api/veiculos/usuario/${usuarioId}`);
        const data = await resposta.json();

        tabela.innerHTML = ""; 

        if (!data.sucesso || !data.veiculos || data.veiculos.length === 0) {
            tabela.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: #888; padding: 30px;">
                        Você ainda não possui veículos anunciados.
                    </td>
                </tr>
            `;
            return;
        }

        data.veiculos.forEach(veiculo => {
            const tr = document.createElement("tr");

            // Formatação corrigida para remover os zeros da casa decimal
            const precoFormatado = Number(veiculo.preco).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });

            const anoExibicao = veiculo.ano_fabricacao && veiculo.ano_modelo 
                ? `${veiculo.ano_fabricacao}/${veiculo.ano_modelo}` 
                : (veiculo.ano_fabricacao || veiculo.ano || 'Não informado');

            const imagemHtml = veiculo.imagem 
                ? `<img src="/uploads/${veiculo.imagem}" alt="${veiculo.modelo}" class="tabela-foto" onclick="abrirModalImagem('/uploads/${veiculo.imagem}')">` 
                : `<div class="sem-foto"><i class="fa-solid fa-car"></i></div>`;

            const qtdVisualizacoes = veiculo.total_visualizacoes || 0;

            tr.innerHTML = `
                <td>${imagemHtml}</td>
                <td><strong>${veiculo.marca}</strong></td>
                <td>${veiculo.modelo}</td>
                <td>${anoExibicao}</td>
                <td style="color: #4ade80; font-weight: bold;">${precoFormatado}</td>
                <td>
                    <span style="display: inline-flex; align-items: center; gap: 6px; color: #38bdf8; font-weight: 600;">
                        <i class="fa-solid fa-eye"></i> ${qtdVisualizacoes}
                    </span>
                </td>
                <td><span style="padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; background: rgba(74, 222, 128, 0.1); color: #4ade80;">Ativo</span></td>
                <td>
                    <div class="acoes-container">
                        <button class="btn-acoes-toggle" onclick="toggleMenu(event, ${veiculo.id})">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                        <div id="menu-${veiculo.id}" class="menu-dropdown">
                            <button onclick="editarAnuncio(${veiculo.id})"><i class="fa-solid fa-pen"></i> Editar Dados</button>
                            <button onclick="destacarAnuncio(${veiculo.id})"><i class="fa-solid fa-bolt" style="color: #facc15;"></i> Destacar Anúncio</button>
                            <hr>
                            <button class="btn-excluir-opt" onclick="excluirAnuncio(${veiculo.id})"><i class="fa-solid fa-trash"></i> Excluir</button>
                        </div>
                    </div>
                </td>
            `;

            tabela.appendChild(tr);
        });

    } catch (erro) {
        console.error("Erro ao buscar anúncios:", erro);
        tabela.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: #e50914; padding: 30px;">
                    Erro ao carregar os seus anúncios. Tente novamente mais tarde.
                </td>
            </tr>
        `;
    }
}

// Controlos de Menu Flutuante
function toggleMenu(event, id) {
    event.stopPropagation();
    const menuAtual = document.getElementById(`menu-${id}`);
    fecharTodosMenus();
    if (menuAtual) menuAtual.classList.toggle("ativo");
}

function fecharTodosMenus() {
    document.querySelectorAll('.menu-dropdown').forEach(menu => menu.classList.remove('ativo'));
}

function destacarAnuncio(id) {
    alert(`Funcionalidade de destaque para o anúncio ID ${id} em breve!`);
    fecharTodosMenus();
}

// Funções de Imagem (Lightbox)
function abrirModalImagem(urlImagem) {
    const modal = document.getElementById("modalImagem");
    const imagemAmpliada = document.getElementById("imagemAmpliada");
    if (modal && imagemAmpliada) {
        imagemAmpliada.src = urlImagem;
        modal.classList.add("ativo");
    }
}

function fecharModalImagem() {
    const modal = document.getElementById("modalImagem");
    if (modal) modal.classList.remove("ativo");
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        fecharModalImagem();
        fecharTodosMenus();
    }
});

// Excluir anúncio
async function excluirAnuncio(id) {
    fecharTodosMenus();
    if (!confirm("Tem certeza que deseja excluir este anúncio?")) return;

    try {
        const resposta = await fetch(`/api/veiculos/${id}`, { method: "DELETE" });
        const data = await resposta.json();

        if (data.sucesso) {
            alert("Anúncio excluído com sucesso!");
            location.reload(); 
        } else {
            alert(data.mensagem || "Erro ao excluir o anúncio.");
        }
    } catch (erro) {
        console.error("Erro:", erro);
        alert("Erro de conexão com o servidor.");
    }
}

// Editar anúncio
function editarAnuncio(id) {
    window.location.href = `/pages/editar-anuncio.html?id=${id}`;
}

// Logout
function configurarLogout() {
    const btnSair = document.getElementById("btnSair");
    if (btnSair) {
        btnSair.addEventListener("click", (event) => {
            event.preventDefault();
            localStorage.removeItem("usuario");
            localStorage.removeItem("token");
            window.location.href = "/pages/login.html";
        });
    }
}