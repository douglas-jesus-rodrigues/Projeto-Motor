document.addEventListener("DOMContentLoaded", () => {
    // 1. VERIFICAÇÃO DE SEGURANÇA PARA MÚLTIPLOS ADMINS
    const usuarioLogado = JSON.parse(localStorage.getItem("usuario"));

    if (!usuarioLogado || (usuarioLogado.tipo !== "admin" && usuarioLogado.cargo !== "admin" && usuarioLogado.cargo !== "super_admin")) {
        alert("Acesso negado! Área restrita para administradores autorizados.");
        window.location.href = "/pages/login.html";
        return;
    }

    // 2. Carregar Estatísticas Gerais (Cards)
    carregarEstatisticas();

    // 3. Carregar Lista de Usuários Reais do Banco na Tabela
    carregarUsuarios();

    // 4. Inicializar os Gráficos com Dados Reais
    inicializarGraficos();

    // 5. Configurar Botão de Sair (Logout)
    configurarLogout();
});

// Busca os contadores reais na API
async function carregarEstatisticas() {
    try {
        const resposta = await fetch("http://localhost:4000/api/usuarios/admin/estatisticas");
        
        if (resposta.ok) {
            const dados = await resposta.json();
            
            document.getElementById("usuarios").textContent = dados.totalUsuarios || 0;
            document.getElementById("empresas").textContent = dados.totalEmpresas || 0;
            document.getElementById("veiculos").textContent = dados.totalVeiculos || 0;
            document.getElementById("vendidos").textContent = dados.totalVendidos || 0;
        } else {
            console.warn("A API de estatísticas não respondeu corretamente.");
        }
    } catch (error) {
        console.error("Erro ao conectar com o servidor para buscar estatísticas:", error);
    }
}

// Busca e renderiza os usuários cadastrados no banco de dados na tabela
async function carregarUsuarios() {
    const tbody = document.getElementById("tabelaUsuarios");
    
    try {
        const resposta = await fetch("http://localhost:4000/api/usuarios");
        
        if (resposta.ok) {
            const usuarios = await resposta.json();
            
            // Limpa o conteúdo estático/exemplo anterior
            tbody.innerHTML = "";

            if (usuarios.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Nenhum usuário cadastrado.</td></tr>`;
                return;
            }

            // Preenche a tabela dinamicamente com os dados do banco
            usuarios.forEach(user => {
                const tr = document.createElement("tr");

                tr.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.nome}</td>
                    <td>${user.email}</td>
                    <td>${user.tipo || 'Cliente'}</td>
                    <td>${user.status || 'Ativo'}</td>
                    <td>
                        <button class="editar" onclick="editarUsuario(${user.id})" title="Editar">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="excluir" onclick="excluirUsuario(${user.id})" title="Excluir">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error("Erro ao carregar usuários do banco:", error);
    }
}

// Inicializa o gráfico de cadastros por mês buscados do banco
async function inicializarGraficoCadastros() {
    const ctx = document.getElementById("graficoCadastros").getContext("2d");
    
    let dadosMeses = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    try {
        const resposta = await fetch("http://localhost:4000/api/usuarios/admin/cadastros-mes");
        if (resposta.ok) {
            dadosMeses = await resposta.json();
        }
    } catch (error) {
        console.error("Erro ao carregar dados do gráfico de cadastros:", error);
    }
    
    new Chart(ctx, {
        type: "line",
        data: {
            labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
            datasets: [{
                label: "Cadastros",
                data: dadosMeses,
                borderColor: "#e63946",
                backgroundColor: "rgba(230, 57, 70, 0.1)",
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// Inicializa o gráfico de veículos por marca
function inicializarGraficoMarcas() {
    const ctx = document.getElementById("graficoMarcas").getContext("2d");
    
    new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Honda", "Toyota", "Chevrolet", "Fiat", "Volkswagen"],
            datasets: [{
                data: [10, 15, 8, 12, 20],
                backgroundColor: [
                    "#e63946",
                    "#457b9d",
                    "#1d3557",
                    "#f4a261",
                    "#2a9d8f"
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "bottom" }
            }
        }
    });
}

function inicializarGraficos() {
    inicializarGraficoCadastros();
    inicializarGraficoMarcas();
}

// Funções de Ação (Editar / Excluir)
function editarUsuario(id) {
    alert(`Editar usuário ID: ${id}`);
}

async function excluirUsuario(id) {
    if (confirm(`Tem certeza que deseja excluir o usuário ID ${id}?`)) {
        try {
            const resposta = await fetch(`http://localhost:4000/api/usuarios/${id}`, {
                method: "DELETE"
            });

            if (resposta.ok) {
                alert("Usuário excluído com sucesso!");
                carregarUsuarios(); // Atualiza a tabela
                carregarEstatisticas(); // Atualiza os contadores dos cards
            } else {
                alert("Erro ao excluir usuário.");
            }
        } catch (error) {
            console.error("Erro na requisição de exclusão:", error);
        }
    }
}

// Configurar botão de Sair (Logout)
function configurarLogout() {
    const btnSair = document.querySelector(".sidebar nav ul li:last-child a");
    
    if (btnSair) {
        btnSair.addEventListener("click", (e) => {
            e.preventDefault();
            
            localStorage.removeItem("usuario");
            localStorage.removeItem("token");
            
            window.location.href = "/pages/index.html";
        });
    }
}