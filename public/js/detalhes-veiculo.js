document.addEventListener("DOMContentLoaded", async () => {
    // 1. Pega o ID do veículo na URL (ex: detalhes-veiculo.html?id=3)
    const urlParams = new URLSearchParams(window.location.search);
    const veiculoId = urlParams.get('id');

    if (!veiculoId) {
        alert("Veículo não especificado!");
        window.location.href = "/pages/catalogo.html";
        return;
    }

    // 2. Carrega as informações, configura o botão de favorito e dispara a visualização única
    await carregarDetalhesDoCarro(veiculoId);
    configurarBotaoFavorito(veiculoId);
    registrarVisualizacaoUnica(veiculoId);
});

// ==========================================
// BUSCAR DADOS DO VEÍCULO NA API
// ==========================================
async function carregarDetalhesDoCarro(id) {
    const loadingEl = document.getElementById("loading");
    const conteudoEl = document.getElementById("conteudoVeiculo");

    try {
        const resposta = await fetch(`/api/veiculos/${id}`);
        const data = await resposta.json();

        if (!data.sucesso || !data.veiculo) {
            alert("Veículo não encontrado.");
            window.location.href = "/pages/catalogo.html";
            return;
        }

        const v = data.veiculo;

        // Preenche os elementos visuais
        document.getElementById("marcaModeloBadge").textContent = `${v.marca || 'Marca'} / ${v.modelo || 'Modelo'}`;
        document.getElementById("tituloVeiculo").textContent = `${v.marca} ${v.modelo}`;
        document.getElementById("versaoVeiculo").textContent = v.versao || "Versão padrão";
        
        // Formatação de Preço (R$)
        const precoFormatado = Number(v.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById("precoVeiculo").textContent = precoFormatado;

        // Foto Principal
        const fotoEl = document.getElementById("fotoPrincipal");
        if (v.imagem) {
            fotoEl.src = v.imagem.startsWith('/') ? v.imagem : `/uploads/${v.imagem}`;
        } else {
            fotoEl.src = "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=800&q=80";
        }

        // Descrição
        if (v.descricao && v.descricao.trim() !== "") {
            document.getElementById("descricaoVeiculo").textContent = v.descricao;
        }

        // Especificações Técnicas
        document.getElementById("specAno").textContent = `${v.ano_fabricacao || '--'} / ${v.ano_modelo || '--'}`;
        document.getElementById("specQuilometragem").textContent = v.quilometragem ? `${Number(v.quilometragem).toLocaleString('pt-BR')} km` : "0 km";
        document.getElementById("specCombustivel").textContent = v.combustivel_nome || v.combustivel || "Gasolina";
        document.getElementById("specCambio").textContent = v.cambio_nome || v.cambio || "Manual";
        document.getElementById("specCor").textContent = v.cor || "Não informada";
        document.getElementById("specPortas").textContent = v.portas ? `${v.portas} portas` : "Não informado";

        // ==========================================
        // IDENTIFICAÇÃO DO PROPRIETÁRIO (DONO DO CARRO)
        // ==========================================
        const contatoCard = document.querySelector(".contato-card");
        const usuarioLogado = JSON.parse(localStorage.getItem("usuario") || sessionStorage.getItem("usuario") || "null");
        
        const idDonoVeiculo = Number(v.usuario_id || v.proprietario_id || 0);
        const idUsuarioAtual = usuarioLogado ? Number(usuarioLogado.id) : null;

        if (contatoCard && idUsuarioAtual && idDonoVeiculo > 0 && idUsuarioAtual === idDonoVeiculo) {
            // É o dono do veículo! Substitui o card de proposta com o texto exato pedido
            contatoCard.innerHTML = `
                <h3><i class="fa-solid fa-circle-user" style="color: var(--accent);"></i> Gestão do Anúncio</h3>
                <p>Você é o proprietário deste veículo registado na plataforma. Clique aqui embaixo caso queira editar</p>
                <a href="/pages/painel-cliente.html" class="btn-proposta" style="text-align: center; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 14px; background: var(--surface-2); border: 1px solid var(--border-strong); color: #fff;">
                    <i class="fa-solid fa-gear"></i> Gerir / Editar Anúncio
                </a>
            `;
        }

        // Exibe o conteúdo e esconde o loader
        loadingEl.style.display = "none";
        conteudoEl.style.display = "grid";

    } catch (erro) {
        console.error("Erro ao carregar detalhes:", erro);
        loadingEl.innerHTML = `<p style="color: #e50914;">Erro ao carregar os dados do veículo.</p>`;
    }
}

// ==========================================
// REGISTRAR VISUALIZAÇÃO ÚNICA (EXCLUINDO DONO E ADMINS)
// ==========================================
async function registrarVisualizacaoUnica(veiculoId) {
    try {
        const usuarioSalvo = localStorage.getItem("usuario") || sessionStorage.getItem("usuario");
        if (!usuarioSalvo) return; // Se não estiver logado, não conta

        const usuario = JSON.parse(usuarioSalvo);
        if (!usuario.id) return;

        // Dispara o pedido para o back-end
        await fetch(`/api/veiculos/${veiculoId}/visualizar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario_id: usuario.id })
        });

    } catch (erro) {
        console.error("Erro ao registar visualização:", erro);
    }
}

// ==========================================
// CONFIGURAR BOTÃO DE FAVORITO NA IMAGEM
// ==========================================
function configurarBotaoFavorito(veiculoId) {
    const btnFav = document.getElementById("btnFavoritarDetalhe");
    const iconeFav = document.getElementById("iconeFavorito");

    if (!btnFav || !iconeFav) return;

    // Verifica se o usuário está logado
    const usuarioLogado = JSON.parse(localStorage.getItem("usuario") || sessionStorage.getItem("usuario"));
    const temLogin = usuarioLogado && usuarioLogado.id;

    let favoritos = [];
    if (temLogin) {
        try {
            favoritos = JSON.parse(localStorage.getItem("favoritos_veiculos")) || [];
        } catch {
            favoritos = [];
        }
    }

    const idNumerico = Number(veiculoId);
    let isFavorito = temLogin && favoritos.includes(idNumerico);

    atualizarVisualBotaoFavorito(isFavorito, btnFav, iconeFav);

    btnFav.addEventListener("click", () => {
        // Bloqueio rigoroso se não estiver logado
        const usuarioAtual = JSON.parse(localStorage.getItem("usuario") || sessionStorage.getItem("usuario"));
        if (!usuarioAtual || !usuarioAtual.id) {
            abrirModalLoginNecessario();
            return;
        }

        let favsAtuais = [];
        try {
            favsAtuais = JSON.parse(localStorage.getItem("favoritos_veiculos")) || [];
        } catch {
            favsAtuais = [];
        }

        if (favsAtuais.includes(idNumerico)) {
            favsAtuais = favsAtuais.filter(id => id !== idNumerico);
            isFavorito = false;
        } else {
            favsAtuais.push(idNumerico);
            isFavorito = true;
        }

        localStorage.setItem("favoritos_veiculos", JSON.stringify(favsAtuais));
        atualizarVisualBotaoFavorito(isFavorito, btnFav, iconeFav);
    });
}

function atualizarVisualBotaoFavorito(isFavorito, btn, icone) {
    if (isFavorito) {
        icone.className = "fa-solid fa-heart";
        icone.style.color = "#ff0000";
        btn.setAttribute("aria-pressed", "true");
        btn.title = "Remover dos favoritos";
    } else {
        icone.className = "fa-regular fa-heart";
        icone.style.color = "#ffffff";
        btn.setAttribute("aria-pressed", "false");
        btn.title = "Favoritar veículo";
    }
}

// Sincronização em tempo real com outras abas/páginas
window.addEventListener("storage", (event) => {
    if (event.key === "favoritos_veiculos") {
        let novosFavoritos = [];
        try {
            novosFavoritos = JSON.parse(event.newValue) || [];
        } catch {
            novosFavoritos = [];
        }

        const usuarioAtual = JSON.parse(localStorage.getItem("usuario") || sessionStorage.getItem("usuario"));
        const temLoginAtual = usuarioAtual && usuarioAtual.id;

        const urlParams = new URLSearchParams(window.location.search);
        const veiculoId = Number(urlParams.get('id'));
        const btnFav = document.getElementById("btnFavoritarDetalhe");
        const iconeFav = document.getElementById("iconeFavorito");

        if (btnFav && iconeFav && veiculoId) {
            const ehFav = temLoginAtual && novosFavoritos.includes(veiculoId);
            atualizarVisualBotaoFavorito(ehFav, btnFav, iconeFav);
        }
    }
});

// ==========================================
// CONTROLO DO MODAL DE LOGIN NECESSÁRIO
// ==========================================
function abrirModalLoginNecessario() {
    const modal = document.getElementById("modalLoginNecessario");
    if (modal) modal.style.display = "flex";
}

function fecharModalLoginNecessario() {
    const modal = document.getElementById("modalLoginNecessario");
    if (modal) modal.style.display = "none";
}

// ==========================================
// FUNÇÕES AUXILIARES E LIGHTBOX
// ==========================================
function abrirModalImagem(url) {
    const modal = document.getElementById("modalImagem");
    const img = document.getElementById("imagemAmpliada");
    if (modal && img) {
        img.src = url;
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
        fecharModalLoginNecessario();
    }
});

// ==========================================
// ENVIAR PROPOSTA / REDIRECIONAR PARA MENSAGENS COM MENSAGEM AUTOMÁTICA
// ==========================================
async function enviarPropostaModal() {
    const usuarioSalvo = localStorage.getItem("usuario") || sessionStorage.getItem("usuario");
    if (!usuarioSalvo) {
        abrirModalLoginNecessario();
        return;
    }

    let usuarioAtual;
    try {
        usuarioAtual = JSON.parse(usuarioSalvo);
    } catch {
        abrirModalLoginNecessario();
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const veiculoId = urlParams.get('id');
    const tituloVeiculo = document.getElementById("tituloVeiculo")?.textContent || "este veículo";
    const precoVeiculo = document.getElementById("precoVeiculo")?.textContent || "";

    // Mensagem automática inteligente com os dados exatos do carro
    const mensagemAutomatica = `Olá! Tenho interesse no ${tituloVeiculo} anunciado por ${precoVeiculo}. Gostaria de negociar.`;

    try {
        const resposta = await fetch("/api/mensagens/iniciar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                remetente_id: usuarioAtual.id,
                veiculo_id: veiculoId,
                texto_inicial: mensagemAutomatica
            })
        });

        if (resposta.ok) {
            const dados = await resposta.json();
            const conversaId = dados.conversa_id || dados.id;
            window.location.href = `/pages/mensagens.html?conversa=${conversaId}`;
        } else {
            window.location.href = `/pages/mensagens.html?veiculo=${veiculoId}&msg=${encodeURIComponent(mensagemAutomatica)}`;
        }

    } catch (erro) {
        console.error("Erro ao iniciar chat:", erro);
        window.location.href = `/pages/mensagens.html?veiculo=${veiculoId}&msg=${encodeURIComponent(mensagemAutomatica)}`;
    }
}