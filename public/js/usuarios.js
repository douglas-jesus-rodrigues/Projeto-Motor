// URL base da API
const API_URL = "http://localhost:4000/api";

let listaUsuariosGlobal = [];

// Executa assim que a página é carregada
document.addEventListener("DOMContentLoaded", () => {
    carregarUsuarios();

    // Configura a barra de pesquisa usando o ID exato do seu HTML: 'inputBusca'
    const inputBusca = document.getElementById("inputBusca");
    if (inputBusca) {
        inputBusca.addEventListener("input", (e) => {
            const termo = e.target.value.toLowerCase().trim();
            filtrarUsuarios(termo);
        });
    }
});

// 1. Função para buscar os usuários no back-end
async function carregarUsuarios() {
    try {
        const resposta = await fetch(`${API_URL}/usuarios`);
        
        if (!resposta.ok) {
            throw new Error("Erro ao carregar a lista de usuários do servidor.");
        }

        const usuarios = await resposta.json();
        listaUsuariosGlobal = usuarios; // Salva para uso na pesquisa
        renderizarTabela(usuarios);

    } catch (erro) {
        console.error("Erro:", erro);
        alert("Não foi possível carregar os usuários.");
    }
}

// 2. Função para desenhar os dados na tabela HTML
function renderizarTabela(usuarios) {
    const tbody = document.getElementById("tabelaUsuarios");
    
    if (!tbody) {
        console.error("Elemento 'tabelaUsuarios' não encontrado no HTML.");
        return;
    }

    tbody.innerHTML = "";

    if (!usuarios || usuarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Nenhum usuário encontrado.</td></tr>`;
        return;
    }

    usuarios.forEach(user => {
        const tr = document.createElement("tr");
        
        const tipoExibicao = user.tipo ? user.tipo.toUpperCase() : 'NÃO DEFINIDO';

        tr.innerHTML = `
            <td>#${user.id}</td>
            <td>${user.nome || 'Não informado'}</td>
            <td>${user.email}</td>
            <td><span class="badge badge-${user.tipo || 'default'}">${tipoExibicao}</span></td>
            <td>
                <button class="btn-acao btn-mudar" onclick="alterarTipo(${user.id}, '${user.tipo}')" title="Mudar tipo">
                    <i class="fa-solid fa-user-gear"></i> Mudar
                </button>
                <button class="btn-acao btn-excluir" onclick="excluirUsuario(${user.id})" title="Excluir usuário">
                    <i class="fa-solid fa-trash"></i> Excluir
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. Função para filtrar usuários por Nome, E-mail ou CPF
function filtrarUsuarios(termo) {
    const filtrados = listaUsuariosGlobal.filter(user => {
        const nome = user.nome ? user.nome.toLowerCase() : "";
        const email = user.email ? user.email.toLowerCase() : "";
        const cpf = user.cpf ? user.cpf.toLowerCase() : ""; // Garante a busca por CPF

        return nome.includes(termo) || email.includes(termo) || cpf.includes(termo);
    });
    
    renderizarTabela(filtrados);
}

// 4. Função para alterar o tipo do usuário
async function alterarTipo(id, tipoAtual) {
    const novoTipo = tipoAtual === 'admin' ? 'individual' : 'admin';
    
    if (!confirm(`Deseja realmente alterar o tipo deste usuário para "${novoTipo}"?`)) {
        return;
    }

    try {
        const resposta = await fetch(`${API_URL}/usuarios/${id}/tipo`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ tipo: novoTipo })
        });

        const resultado = await resposta.json();

        if (resposta.ok) {
            alert(resultado.mensagem || "Tipo alterado com sucesso!");
            carregarUsuarios(); 
        } else {
            alert(resultado.erro || "Erro ao alterar permissão.");
        }
    } catch (erro) {
        console.error("Erro na requisição de alteração:", erro);
        alert("Erro de conexão ao tentar alterar o tipo.");
    }
}

// 5. Função para excluir usuário
async function excluirUsuario(id) {
    if (!confirm("Tem certeza absoluta que deseja excluir este usuário do sistema?")) {
        return;
    }

    try {
        const resposta = await fetch(`${API_URL}/usuarios/${id}`, {
            method: "DELETE"
        });

        const resultado = await resposta.json();

        if (resposta.ok) {
            alert(resultado.mensagem || "Usuário excluído com sucesso!");
            carregarUsuarios(); 
        } else {
            alert(resultado.erro || "Erro ao excluir usuário.");
        }
    } catch (erro) {
        console.error("Erro na exclusão:", erro);
        alert("Erro de conexão ao tentar excluir.");
    }
}