document.addEventListener('DOMContentLoaded', () => {
    let paginaAtual = 1;
    const limitePorPagina = 10; // Mantido em 10 para os teus testes
    let acaoPendente = null;
    let carregando = false;

    // --- ELEMENTOS DOM ---
    const containerCards = document.getElementById('listaDenuncias');
    const containerPaginacao = document.getElementById('paginacaoContainer');
    const btnAnterior = document.getElementById('btnPagAnterior');
    const btnProxima = document.getElementById('btnPagProxima');
    const infoPagina = document.getElementById('infoPagina');
    const modalAcao = document.getElementById('modalAcaoModeracao');
    const tituloModalAcao = document.getElementById('tituloModalAcao');
    const textoModalAcao = document.getElementById('textoModalAcao');
    const iconeModalAcao = document.getElementById('iconeModalAcao');
    const btnConfirmarAcao = document.getElementById('btnConfirmarAcao');
    const btnCancelarAcao = document.getElementById('btnCancelarAcao');

    if (!containerCards) return;

    // --- FUNÇÕES AUXILIARES ---
    function obterUrlImagem(item) {
        const img = item.imagem || item.imagem_principal || item.foto;
        if (!img) return '/imagens/sem-foto.jpg';
        return img.startsWith('http') || img.startsWith('/') ? img : `/uploads/${img}`;
    }

    // --- MENSAGEM BONITA PARA O FIM DA LISTA (SEM ALERT) ---
    function mostrarAvisoFimDeLista() {
        // Remove aviso anterior se existir
        const existente = document.getElementById('avisoFimListaOverlay');
        if (existente) existente.remove();

        // Cria o fundo escuro (Overlay)
        const overlay = document.createElement('div');
        overlay.id = 'avisoFimListaOverlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999; opacity: 0; transition: opacity 0.3s ease;
        `;

        // Cria a caixa de mensagem
        const aviso = document.createElement('div');
        aviso.style.cssText = `
            background: var(--bg-panel, #121214);
            border: 1px solid var(--border-color, #29292e);
            padding: 40px; border-radius: 16px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.5);
            text-align: center; max-width: 400px; width: 90%;
            transform: translateY(20px) scale(0.95);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        `;

        aviso.innerHTML = `
            <div style="font-size: 48px; color: var(--primary, #00d4ff); margin-bottom: 20px;">
                <i class="fa-solid fa-flag-checkered"></i>
            </div>
            <h3 style="margin: 0 0 12px 0; font-size: 22px; color: var(--text-light, #fff);">Fim da Lista!</h3>
            <p style="margin: 0; color: var(--text-muted, #a8a8b3); font-size: 15px; line-height: 1.5;">
                Não existem mais anúncios para carregar.<br>Já chegaste à última página disponível.
            </p>
            <button id="btnFecharAvisoFim" style="
                margin-top: 30px; background: var(--primary, #00d4ff);
                color: #000; border: none; padding: 12px 30px;
                border-radius: 8px; font-weight: 600; font-size: 15px;
                cursor: pointer; transition: filter 0.2s; width: 100%;
            " onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='brightness(1)'">
                Entendido
            </button>
        `;

        overlay.appendChild(aviso);
        document.body.appendChild(overlay);

        // Animação de entrada
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            aviso.style.transform = 'translateY(0) scale(1)';
        });

        // Fechar ao clicar no botão
        document.getElementById('btnFecharAvisoFim').addEventListener('click', () => fecharAviso(overlay, aviso));
        
        // Fechar ao clicar fora da caixa (no fundo escuro)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) fecharAviso(overlay, aviso);
        });
    }

    function fecharAviso(overlay, aviso) {
        overlay.style.opacity = '0';
        aviso.style.transform = 'translateY(20px) scale(0.95)';
        setTimeout(() => overlay.remove(), 300);
    }

    // --- CARREGAMENTO DA API ---
    async function carregarDenuncias(pagina) {
        if (carregando) return;
        carregando = true;

        containerCards.innerHTML = Array(6).fill('<div class="skeleton-card"></div>').join('');

        try {
            const urlAPI = `/api/veiculos?pagina=${pagina}&limite=${limitePorPagina}&_t=${Date.now()}`;
            const response = await fetch(urlAPI);
            const dados = await response.json();

            let veiculos = Array.isArray(dados) ? dados : (dados.veiculos || dados.dados || dados.data || []);

            // VERIFICA SE A PÁGINA ESTÁ VAZIA (CHAMA A MENSAGEM BONITA)
            if (veiculos.length === 0) {
                if (pagina > 1) {
                    mostrarAvisoFimDeLista();
                    carregando = false;
                    return carregarDenuncias(paginaAtual); // Regressa à página onde estava
                } else {
                    containerCards.innerHTML = `
                        <div class="boas-vindas msg-vazio" style="grid-column: 1 / -1;">
                            <h2><i class="fa-solid fa-circle-check" style="color: var(--success, #04d361);"></i> Fila limpa!</h2>
                            <p>Nenhuma denúncia pendente para moderação no momento.</p>
                        </div>
                    `;
                    if (containerPaginacao) containerPaginacao.style.display = 'none';
                    return;
                }
            }

            if (containerPaginacao) containerPaginacao.style.display = 'flex';
            const fragment = document.createDocumentFragment();

            veiculos.forEach(item => {
                const article = document.createElement('article');
                article.className = 'card';
                article.setAttribute('data-id', item.id);
                
                const preco = item.preco ? `R$ ${Number(item.preco).toLocaleString('pt-BR')}` : 'Consulta';
                
                article.innerHTML = `
                    <div class="card-img-container">
                        <img src="${obterUrlImagem(item)}" loading="lazy" onerror="this.onerror=null; this.src='/imagens/sem-foto.jpg';">
                    </div>
                    <div class="card-content">
                        <span class="tag-pendente"><i class="fa-solid fa-shield-halved"></i> #${item.id}</span>
                        <h3>${item.marca_nome || 'Veículo'} ${item.modelo_nome || ''}</h3>
                        <p><strong>Preço:</strong> ${preco} | <strong>Ano:</strong> ${item.ano_fabricacao || '-'}</p>
                    </div>
                    <div class="moderacao-acoes">
                        <button class="btn-mod btn-aprovar" type="button"><i class="fa-solid fa-check"></i> Manter</button>
                        <button class="btn-mod btn-rejeitar" type="button"><i class="fa-solid fa-trash"></i> Remover</button>
                    </div>
                `;
                fragment.appendChild(article);
            });

            containerCards.innerHTML = '';
            containerCards.appendChild(fragment);

            paginaAtual = pagina;
            
            if (infoPagina) {
                infoPagina.innerHTML = `Página ${paginaAtual}`;
            }

            // Os botões ficam sempre ativos para testares livremente.
            if (btnAnterior) btnAnterior.disabled = (paginaAtual === 1);
            if (btnProxima) btnProxima.disabled = false; 

            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (erro) {
            console.error('Erro na API:', erro);
            if (btnAnterior) btnAnterior.disabled = paginaAtual <= 1;
            if (btnProxima) btnProxima.disabled = false;
        } finally {
            carregando = false;
        }
    }

    // --- EVENTOS DE CLIQUE (NAVEGAÇÃO) ---
    if (btnAnterior) {
        btnAnterior.addEventListener('click', (e) => {
            e.preventDefault(); 
            if (!carregando && paginaAtual > 1) carregarDenuncias(paginaAtual - 1);
        });
    }
    
    if (btnProxima) {
        btnProxima.addEventListener('click', (e) => {
            e.preventDefault(); 
            if (!carregando) carregarDenuncias(paginaAtual + 1);
        });
    }

    // Arranca na página 1
    carregarDenuncias(1);
});