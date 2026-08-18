document.addEventListener('DOMContentLoaded', () => {
    // Seleciona o container que agrupa todos os cards de denúncia
    const containerCards = document.querySelector('.cards');

    if (!containerCards) return;

    // Gerenciador de eventos centralizado (Delegação de Eventos)
    containerCards.addEventListener('click', async (event) => {
        // Encontra o botão clicado (tratando caso clique no ícone interno)
        const btnAprovar = event.target.closest('.btn-aprovar');
        const btnRejeitar = event.target.closest('.btn-rejeitar');

        if (!btnAprovar && !btnRejeitar) return;

        // Encontra o card pai para capturar o ID do anúncio e fazer a animação
        const cardElement = event.target.closest('.card');
        const anuncioId = cardElement.getAttribute('data-id');
        
        if (btnAprovar) {
            // Ação: Manter no catálogo (Ignorar denúncia)
            await gerenciarDenuncia(anuncioId, 'manter', cardElement);
        } else if (btnRejeitar) {
            // Ação: Remover do catálogo (Aprovar denúncia e tirar o veículo do ar)
            await gerenciarDenuncia(anuncioId, 'remover', cardElement);
        }
    });
});

/**
 * Envia a decisão do moderador para a API do backend
 * @param {string} id - ID do anúncio vindo do banco de dados
 * @param {string} acao - 'manter' ou 'remover'
 * @param {HTMLElement} card - Elemento HTML do card para manipulação visual
 */
async function gerenciarDenuncia(id, acao, card) {
    // Define a rota da sua API de acordo com a ação desejada
    const url = `/api/moderacao/${id}/${acao}`;

    // Desabilita os botões do card para evitar cliques duplos durante a requisição
    const botoes = card.querySelectorAll('.btn-mod');
    botoes.forEach(btn => btn.disabled = true);

    try {
        // Envia a requisição assíncrona (POST ou PUT dependendo da sua arquitetura)
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Se usar autenticação por Token/JWT, adicione a linha abaixo:
                // 'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao processar a ação no servidor.');
        }

        // Efeito visual: Suaviza a saída do card da tela após o sucesso no banco
        card.style.transition = 'all 0.4s ease';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9) translateY(20px)';

        // Remove o elemento do HTML após o término da animação
        setTimeout(() => {
            card.remove();
            verificarFilaVazia();
        }, 400);

    } catch (error) {
        console.error('Falha na moderação:', error);
        alert('Não foi possível salvar sua decisão. Tente novamente.');
        
        // Reativa os botões caso o banco de dados retorne algum erro
        botoes.forEach(btn => btn.disabled = false);
    }
}

/**
 * Verifica se ainda existem denúncias na tela e exibe uma mensagem amigável caso zere
 */
function verificarFilaVazia() {
    const cardsRestantes = document.querySelectorAll('.card');
    if (cardsRestantes.length === 0) {
        const container = document.querySelector('.container');
        const mensagem = document.createElement('div');
        mensagem.className = 'boas-vindas';
        mensagem.style.borderLeftColor = '#28a745';
        mensagem.innerHTML = `
            <h2><i class="bi bi-check-all"></i> Tudo limpo!</h2>
            <p>Nenhuma denúncia pendente para avaliação no momento.</p>
        `;
        container.appendChild(mensagem);
    }
}
