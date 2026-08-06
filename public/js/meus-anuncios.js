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
});

// Função para buscar os anúncios do usuário na API
async function carregarMeusAnuncios(usuarioId) {
    const tabela = document.getElementById("tabelaMeusAnuncios");

    try {
        // Substitua pela rota real do seu back-end que busca veículos por usuário (ex: /api/veiculos/usuario/${usuarioId})
        const resposta = await fetch(`/api/veiculos/usuario/${usuarioId}`);
        const data = await resposta.json();

        tabela.innerHTML = ""; // Limpa a mensagem de carregamento

        // Verifica se veio uma lista válida e se ela não está vazia
        if (!data.sucesso || !data.veiculos || data.veiculos.length === 0) {
            tabela.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #888; padding: 30px;">
                        Você ainda não possui veículos anunciados.
                    </td>
                </tr>
            `;
            return;
        }

        // Renderiza cada veículo na tabela
        data.veiculos.forEach(veiculo => {
            const tr = document.createElement("tr");

            // Formata o preço para o padrão brasileiro (R$)
            const precoFormatado = Number(veiculo.preco).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            });

            tr.innerHTML = `
                <td><strong>${veiculo.marca}</strong></td>
                <td>${veiculo.modelo}</td>
                <td>${veiculo.ano}</td>
                <td style="color: #4ade80; font-weight: bold;">${precoFormatado}</td>
                <td><span style="padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; background: rgba(74, 222, 128, 0.1); color: #4ade80;">Ativo</span></td>
                <td>
                    <button class="editar" onclick="editarAnuncio(${veiculo.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="excluir" onclick="excluirAnuncio(${veiculo.id})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;

            tabela.appendChild(tr);
        });

    } catch (erro) {
        console.error("Erro ao buscar anúncios:", erro);
        tabela.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #e50914; padding: 30px;">
                    Erro ao carregar os seus anúncios. Tente novamente mais tarde.
                </td>
            </tr>
        `;
    }
}

// Função de exclusão de anúncio
async function excluirAnuncio(id) {
    if (!confirm("Tem certeza que deseja excluir este anúncio?")) {
        return;
    }

    try {
        const resposta = await fetch(`/api/veiculos/${id}`, {
            method: "DELETE"
        });

        const data = await resposta.json();

        if (data.sucesso) {
            alert("Anúncio excluído com sucesso!");
            location.reload(); // Recarrega a página para atualizar a tabela
        } else {
            alert(data.mensagem || "Erro ao excluir o anúncio.");
        }
    } catch (erro) {
        console.error("Erro:", erro);
        alert("Erro de conexão com o servidor.");
    }
}

// Função de edição (pode redirecionar para uma página de edição ou abrir um modal)
function editarAnuncio(id) {
    // Exemplo de redirecionamento para uma página de edição passando o ID na URL
    window.location.href = `/pages/editar-anuncio.html?id=${id}`;
}

// Função de Logout
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