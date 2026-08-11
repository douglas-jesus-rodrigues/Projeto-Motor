document.addEventListener("DOMContentLoaded", () => {
    // 1. Verificação de segurança: checa se o usuário está logado e se é admin
    const usuarioStr = localStorage.getItem("usuario");
    
    if (!usuarioStr) {
        alert("Sessão expirada. Faça login novamente.");
        window.location.href = "/pages/login.html";
        return;
    }

    const usuario = JSON.parse(usuarioStr);

    if (usuario.tipo !== 'admin') {
        alert("Acesso restrito! Você não tem permissão de administrador.");
        window.location.href = "/pages/painel-cliente.html";
        return;
    }

    // 2. Saudação personalizada com o nome do administrador
    const nomeAdmin = document.getElementById("nomeAdmin");
    if (nomeAdmin) {
        nomeAdmin.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Olá, ${usuario.nome || 'Administrador'}`;
    }

    // 3. Função para carregar as estatísticas (Contagem de Usuários e Anúncios)
    carregarEstatisticas();

    // 4. Configuração do Botão de Logout (Sair)
    const btnSair = document.getElementById("btnSair");
    if (btnSair) {
        btnSair.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("usuario");
            localStorage.removeItem("token");
            window.location.replace("/pages/login.html");
        });
    }
});

// Função assíncrona para buscar os totais do servidor (ajuste as rotas se necessário para a sua API)
async function carregarEstatisticas() {
    const token = localStorage.getItem("token");
    
    try {
        // Exemplo de requisição para buscar dados de usuários e anúncios
        // (Certifique-se de que suas rotas no backend correspondam a estas ou ajuste os endpoints)
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        // Buscando total de usuários
        const respostaUsuarios = await fetch('/api/admin/usuarios/total', { headers });
        if (respostaUsuarios.ok) {
            const dadosUsuarios = await respostaUsuarios.json();
            const elUsuarios = document.getElementById("totalUsuarios");
            if (elUsuarios) elUsuarios.textContent = dadosUsuarios.total || 0;
        } else {
            document.getElementById("totalUsuarios").textContent = "---";
        }

        // Buscando total de anúncios para moderação
        const respostaAnuncios = await fetch('/api/admin/anuncios/total', { headers });
        if (respostaAnuncios.ok) {
            const dadosAnuncios = await respostaAnuncios.json();
            const elAnuncios = document.getElementById("totalAnuncios");
            if (elAnuncios) elAnuncios.textContent = dadosAnuncios.total || 0;
        } else {
            document.getElementById("totalAnuncios").textContent = "---";
        }

    } catch (erro) {
        console.error("Erro ao carregar estatísticas do painel:", erro);
        const elUsuarios = document.getElementById("totalUsuarios");
        const elAnuncios = document.getElementById("totalAnuncios");
        if (elUsuarios) elUsuarios.textContent = "Indisponível";
        if (elAnuncios) elAnuncios.textContent = "Indisponível";
    }
}