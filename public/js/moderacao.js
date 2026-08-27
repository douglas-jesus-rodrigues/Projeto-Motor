document.addEventListener('DOMContentLoaded', () => {
    let paginaAtual = 1;
    const limitePorPagina = 10;

    const containerCards = document.querySelector('.cards');
    const containerPaginacao = document.getElementById('paginacaoContainer');
    const btnAnterior = document.getElementById('btnPagAnterior');
    const btnProxima = document.getElementById('btnPagProxima');
    const infoPagina = document.getElementById('infoPagina');

    if (!containerCards) return;

    // 1. FUNÇÃO DE CARREGAMENTO DOS ANÚNCIOS (PAGINADO)
    async function carregarDenuncias(pagina) {
        containerCards.innerHTML = `
            <div class="loading-box">
                <i class="bi bi-arrow-repeat spin"></i>
                <p>Carregando anúncios para moderação...</p>
            </div>
        `;

        try {
            const response = await fetch(`/api/veiculos?pagina=${pagina}&limite=${limitePorPagina}`);
            const dados = await response.json();

            if (!dados.sucesso || !dados.veiculos || dados.veiculos.length === 0) {
                containerCards.innerHTML = '';
                verificarFilaVazia();
                if (containerPaginacao) containerPaginacao.style.display = 'none';
                return;
            }

            if (containerPaginacao) containerPaginacao.style.display = 'flex';

            const fragment = document.createDocumentFragment();

            dados.veiculos.forEach(item => {
                const article = document.createElement('article');
                article.className = 'card';
                article.setAttribute('data-id', item.id);

                const titulo = `${item.marca_nome || 'Veículo'} ${item.modelo_nome || ''}`.trim();
                const preco = item.preco ? `R$ ${Number(item.preco).toLocaleString('pt-BR')}` : 'Sob consulta';

                article.innerHTML = `
                    <div class="card-content">
                        <span class="tag-pendente">
                            <i class="bi bi-person-badge"></i> Anúncio #${item.id}
                        </span>
                        <h3>${titulo}</h3>
                        <p><strong>Preço:</strong> ${preco} | <strong>Ano:</strong> ${item.ano_fabricacao || '-'}/${item.ano_modelo || '-'}</p>
                        <small>Quilometragem: ${item.quilometragem ? item.quilometragem.toLocaleString('pt-BR') + ' km' : '0 km'}</small>
                    </div>
                    <div class="moderacao-acoes">
                        <button class="btn-mod btn-aprovar">
                            <i class="bi bi-hand-thumbs-up"></i> Manter no Catálogo
                        </button>
                        <button class="btn-mod btn-rejeitar">
                            <i class="bi bi-trash3"></i> Remover do Catálogo
                        </button>
                        <a href="/pages/detalhes.html?id=${item.id}" class="btn-card">
                            Investigar Anúncio <i class="bi bi-arrow-right"></i>
                        </a>
                    </div>
                `;

                fragment.appendChild(article);
            });

            containerCards.innerHTML = '';
            containerCards.appendChild(fragment);

            paginaAtual = pagina;
            if (infoPagina) infoPagina.textContent = `Página ${paginaAtual}`;
            if (btnAnterior) btnAnterior.disabled = paginaAtual === 1;
            if (btnProxima) btnProxima.disabled = dados.veiculos.length < limitePorPagina;

        } catch (erro) {
            console.error('Erro ao carregar moderação:', erro);
            containerCards.innerHTML = `
                <div class="vazio-box">
                    <p>Ocorreu um erro ao carregar os dados de moderação.</p>
                </div>
            `;
        }
    }

    // 2. DELEGAÇÃO DE EVENTOS PARA APROVAR E REJEITAR
    containerCards.addEventListener('click', async (event) => {
        const btnAprovar = event.target.closest('.btn-aprovar');
        const btnRejeitar = event.target.closest('.btn-rejeitar');

        if (!btnAprovar && !btnRejeitar) return;

        const cardElement = event.target.closest('.card');
        const anuncioId = cardElement.getAttribute('data-id');
        
        if (btnAprovar) {
            await gerenciarDenuncia(anuncioId, 'manter', cardElement);
        } else if (btnRejeitar) {
            await gerenciarDenuncia(anuncioId, 'remover', cardElement);
        }
    });

    // 3. EVENTOS DE PAGINAÇÃO
    if (btnAnterior) {
        btnAnterior.addEventListener('click', () => {
            if (paginaAtual > 1) carregarDenuncias(paginaAtual - 1);
        });
    }

    if (btnProxima) {
        btnProxima.addEventListener('click', () => {
            carregarDenuncias(paginaAtual + 1);
        });
    }

    // CARREGAMENTO INICIAL
    carregarDenuncias(1);
});

/**
 * Envia a decisão do moderador para a API do backend
 */
async function gerenciarDenuncia(id, acao, card) {
    const ehAprovacao = acao === 'manter';
    
    // Mapeia para as rotas do Express que criamos
    const url = ehAprovacao ? `/api/veiculos/${id}/aprovar` : `/api/veiculos/${id}`;
    const metodo = ehAprovacao ? 'PATCH' : 'DELETE';

    const botoes = card.querySelectorAll('.btn-mod');
    botoes.forEach(btn => btn.disabled = true);

    try {
        const response = await fetch(url, {
            method: metodo,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao processar a ação no servidor.');
        }

        // Animação de saída
        card.style.transition = 'all 0.4s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9) translateY(20px)';

        setTimeout(() => {
            card.remove();
            verificarFilaVazia();
        }, 400);

    } catch (error) {
        console.error('Falha na moderação:', error);
        alert('Não foi possível salvar sua decisão. Tente novamente.');
        botoes.forEach(btn => btn.disabled = false);
    }
}

/**
 * Exibe mensagem quando a lista no DOM estiver vazia
 */
function verificarFilaVazia() {
    const cardsRestantes = document.querySelectorAll('.card');
    if (cardsRestantes.length === 0) {
        const container = document.querySelector('.container');
        
        // Evita duplicar a mensagem de "Tudo limpo"
        if (document.querySelector('.msg-vazio')) return;

        const mensagem = document.createElement('div');
        mensagem.className = 'boas-vindas msg-vazio';
        mensagem.style.borderLeftColor = '#28a745';
        mensagem.innerHTML = `
            <h2><i class="bi bi-check-all" style="color: #28a745;"></i> Tudo limpo!</h2>
            <p>Nenhuma denúncia pendente para avaliação nesta página.</p>
        `;
        container.appendChild(mensagem);
    }
}