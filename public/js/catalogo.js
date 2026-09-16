document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 0. USUÁRIO E VERIFICAÇÃO DE LOGIN
    // ==========================================
    const usuario = JSON.parse(localStorage.getItem("usuario")) || { id: 1, tipo: "cliente" };

    // Verificação opcional de login (descomente se quiser forçar o redirecionamento)
    // if (!localStorage.getItem("usuario")) {
    //     window.location.href = "/pages/login.html";
    // }

    // Configuração do Botão "Meu Painel"
    const btnPainel = document.getElementById("btnPainel");
    if (btnPainel && usuario) {
        if (usuario.tipo === "empresa") {
            btnPainel.href = "/pages/painel-empresa.html";
        } else if (usuario.tipo === "admin") {
            btnPainel.href = "/pages/admin.html";
        } else {
            btnPainel.href = "/pages/painel-cliente.html";
        }
    }

    // ==========================================
    // 1. GERENCIAMENTO DE NAVEGAÇÃO ENTRE ABAS
    // ==========================================
    const navLinks = document.querySelectorAll(".nav-link");
    const pageTabs = document.querySelectorAll(".page-tab");

    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove("active"));
            pageTabs.forEach(pt => pt.classList.remove("active"));

            link.classList.add("active");
            const targetTab = link.getAttribute("data-tab");
            const targetElement = document.getElementById(targetTab);
            if (targetElement) {
                targetElement.classList.add("active");
            }
        });
    });

    function irParaCatalogo() {
        navLinks.forEach(nav => {
            if (nav.getAttribute('data-tab') === 'tab-catalogo') {
                nav.classList.add('active');
            } else {
                nav.classList.remove('active');
            }
        });

        pageTabs.forEach(tab => {
            if (tab.id === 'tab-catalogo') {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    // ==========================================
    // 2. FUNÇÃO PARA BUSCAR VEÍCULOS DO BANCO (API)
    // ==========================================
    let bancoDeDadosVeiculos = [];

    async function carregarVeiculosDoBanco() {
        try {
            const resposta = await fetch('/api/veiculos');
            const dados = await resposta.json();
            
            if (dados.sucesso && Array.isArray(dados.veiculos)) {
                // Mapeia os dados vindos do MySQL para o padrão do Catálogo
                bancoDeDadosVeiculos = dados.veiculos.map(v => ({
                    id: v.id,
                    nome: `${v.marca_nome || v.marca || ''} ${v.modelo_nome || v.modelo || ''} ${v.versao || ''}`.trim(),
                    marca: v.marca_nome || v.marca || 'Outra',
                    categoria: v.carroceria || 'Cupê',
                    transmissao: (v.tipo_transmissao_id === 2 || v.cambio === 'Automático') ? 'Automático' : 'Manual',
                    combustivel: v.combustivel || 'Gasolina', 
                    ano: v.ano_modelo || 2020,
                    condicao: 'Seminovo',
                    quilometragem: `${v.quilometragem || 0} Km`,
                    preco: Number(v.preco) || 0,
                    destaquePrincipal: false,
                    imagem: v.imagem ? `/uploads/${v.imagem}` : "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800"
                }));
            }
        } catch (erro) {
            console.error("Erro ao carregar veículos do backend:", erro);
        }

        popularSelects();
        renderizarDestaque();
        renderizarCards(bancoDeDadosVeiculos);
        renderizarTopDeals();
    }

    const favoritos = new Set();
    let categoriaAbaAtiva = "todos";

    // Elementos DOM do Catálogo e Filtros
    const featuredCarContainer = document.getElementById("featuredCar");
    const carsGrid = document.getElementById("carsGrid");
    const topDealsContainer = document.getElementById("topDeals");
    const inputPesquisa = document.getElementById("filtroBusca") || document.getElementById("inputPesquisa");
    const selectMarca = document.getElementById("selectMarca");
    const selectCategoria = document.getElementById("selectCategoria");
    const selectTransmissao = document.getElementById("selectTransmissao");
    const btnBuscar = document.getElementById("btnFiltrar") || document.getElementById("btnBuscar");
    const btnLimpar = document.getElementById("btnLimparFiltros") || document.getElementById("btnLimpar");
    const catTabBtns = document.querySelectorAll(".cat-tab-btn");

    const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    function popularSelects() {
        if (!selectMarca || !selectCategoria || !selectTransmissao) return;

        selectMarca.innerHTML = '<option value="">Todas as Marcas</option>';
        selectCategoria.innerHTML = '<option value="">Todas as Categorias</option>';
        selectTransmissao.innerHTML = '<option value="">Qualquer Transmissão</option>';

        const marcas = [...new Set(bancoDeDadosVeiculos.map(v => v.marca))].sort();
        const categorias = [...new Set(bancoDeDadosVeiculos.map(v => v.categoria))].sort();
        const transmissoes = [...new Set(bancoDeDadosVeiculos.map(v => v.transmissao))].sort();

        marcas.forEach(m => selectMarca.innerHTML += `<option value="${m}">${m}</option>`);
        categorias.forEach(c => selectCategoria.innerHTML += `<option value="${c}">${c}</option>`);
        transmissoes.forEach(t => selectTransmissao.innerHTML += `<option value="${t}">${t}</option>`);
    }

    function renderizarDestaque() {
        if (!featuredCarContainer || bancoDeDadosVeiculos.length === 0) return;

        const principal = bancoDeDadosVeiculos.find(v => v.destaquePrincipal) || bancoDeDadosVeiculos[0];
        featuredCarContainer.innerHTML = `
            <img src="${principal.imagem}" alt="${principal.nome}">
            <div class="featured-info">
                ${principal.ano} ${principal.nome} | <span class="price">${formatarMoeda(principal.preco)}</span>
            </div>
        `;
    }

    function renderizarCards(lista) {
        if (!carsGrid) return;

        carsGrid.innerHTML = "";
        const itensExibicao = lista.filter(v => !v.destaquePrincipal);

        if (itensExibicao.length === 0) {
            carsGrid.innerHTML = `<p style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">Nenhum veículo encontrado no banco de dados.</p>`;
            return;
        }

        itensExibicao.forEach(carro => {
            const isFav = favoritos.has(carro.id);
            const card = document.createElement("article");
            card.className = "car-card";
            card.innerHTML = `
                <div class="card-thumb">
                    <div class="car-badge">${carro.condicao}</div>
                    <button class="btn-fav ${isFav ? 'active' : ''}" data-id="${carro.id}" title="Favoritar">
                        ${isFav ? '♥' : '♡'}
                    </button>
                    <img src="${carro.imagem}" alt="${carro.nome}" loading="lazy">
                </div>
                <div class="car-card-body">
                    <div>
                        <div class="car-card-title">${carro.nome}</div>
                        <div class="car-card-details">${carro.ano} • ${carro.quilometragem}</div>
                        <div class="car-specs">
                            <span class="spec-tag">${carro.transmissao}</span>
                            <span class="spec-tag">${carro.combustivel}</span>
                            <span class="spec-tag">${carro.categoria}</span>
                        </div>
                    </div>
                    <div>
                        <div class="car-card-price">${formatarMoeda(carro.preco)}</div>
                        <a href="#" class="btn-view">Ver Detalhes</a>
                    </div>
                </div>
            `;
            carsGrid.appendChild(card);
        });
    }

    if (carsGrid) {
        carsGrid.addEventListener('click', (e) => {
            const btnFav = e.target.closest('.btn-fav');
            if (btnFav) {
                const id = Number(btnFav.dataset.id);
                if (favoritos.has(id)) {
                    favoritos.delete(id);
                } else {
                    favoritos.add(id);
                }
                executarBusca();
            }
        });
    }

    function renderizarTopDeals() {
        if (!topDealsContainer) return;

        topDealsContainer.innerHTML = "";
        bancoDeDadosVeiculos.slice(0, 4).forEach(carro => {
            topDealsContainer.innerHTML += `
                <div class="deal-item">
                    <img src="${carro.imagem}" alt="${carro.nome}">
                    <div class="deal-info">
                        <div class="deal-title">${carro.nome}</div>
                        <div style="color: var(--text-muted); font-size: 0.72rem;">${carro.ano} • ${carro.condicao}</div>
                        <div class="deal-price">${formatarMoeda(carro.preco)}</div>
                    </div>
                </div>
            `;
        });
    }

    function executarBusca() {
        const termo = inputPesquisa ? inputPesquisa.value.toLowerCase().trim() : "";
        const marca = selectMarca ? selectMarca.value : "";
        const categoriaSelect = selectCategoria ? selectCategoria.value : "";
        const transmissao = selectTransmissao ? selectTransmissao.value : "";

        const filtrados = bancoDeDadosVeiculos.filter(v => {
            const bateTexto = v.nome.toLowerCase().includes(termo) || v.marca.toLowerCase().includes(termo);
            const bateMarca = marca === "" || v.marca === marca;
            const bateCategoriaSelect = categoriaSelect === "" || v.categoria === categoriaSelect;
            const bateTransmissao = transmissao === "" || v.transmissao === transmissao;
            const bateAbaCat = categoriaAbaAtiva === "todos" || v.categoria.toLowerCase() === categoriaAbaAtiva.toLowerCase();

            return bateTexto && bateMarca && bateCategoriaSelect && bateTransmissao && bateAbaCat;
        });

        renderizarCards(filtrados);
    }

    catTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            catTabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            categoriaAbaAtiva = btn.getAttribute("data-categoria");
            executarBusca();
        });
    });

    function limparFiltros() {
        if (inputPesquisa) inputPesquisa.value = "";
        if (selectMarca) selectMarca.value = "";
        if (selectCategoria) selectCategoria.value = "";
        if (selectTransmissao) selectTransmissao.value = "";
        categoriaAbaAtiva = "todos";
        catTabBtns.forEach(b => b.classList.remove("active"));
        if (catTabBtns[0]) catTabBtns[0].classList.add("active");
        executarBusca();
    }

    // ==========================================
    // 3. UPLOAD, MINIATURA E MODAL DE PRÉ-VISUALIZAÇÃO
    // ==========================================
    const inputImagem = document.getElementById('imagem');
    const btnVerFoto = document.getElementById('btnVerFoto');
    const nomeArquivo = document.getElementById('nomeArquivoSelecionado');
    const modal = document.getElementById('modalVisualizarFoto');
    const imgPreviewModal = document.getElementById('imgPreviewModal');
    const miniaturaPreview = document.getElementById('miniaturaPreview');

    if (inputImagem) {
        inputImagem.addEventListener('change', function(event) {
            const arquivo = event.target.files[0];
            
            if (arquivo) {
                if (nomeArquivo) nomeArquivo.textContent = arquivo.name;
                if (btnVerFoto) btnVerFoto.disabled = false;

                const reader = new FileReader();
                reader.onload = function(e) {
                    const urlResultado = e.target.result;
                    if (imgPreviewModal) imgPreviewModal.src = urlResultado;
                    if (miniaturaPreview) {
                        miniaturaPreview.src = urlResultado;
                        miniaturaPreview.style.display = 'block';
                    }
                }
                reader.readAsDataURL(arquivo);
            } else {
                if (nomeArquivo) nomeArquivo.textContent = 'Selecionar Foto';
                if (btnVerFoto) btnVerFoto.disabled = true;
                if (imgPreviewModal) imgPreviewModal.src = '';
                if (miniaturaPreview) {
                    miniaturaPreview.src = '';
                    miniaturaPreview.style.display = 'none';
                }
            }
        });
    }

    if (btnVerFoto) {
        btnVerFoto.addEventListener('click', function() {
            if (modal && imgPreviewModal && imgPreviewModal.src) {
                modal.classList.add('ativo');
            }
        });
    }

    // ==========================================
    // 4. ELEMENTOS DE ERRO E VALIDAÇÃO DO FORMULÁRIO
    // ==========================================
    const erroMarca = document.getElementById("erroMarca");
    const erroModelo = document.getElementById("erroModelo");
    const erroAnoFabricacao = document.getElementById("erroAnoFabricacao");
    const erroAnoModelo = document.getElementById("erroAnoModelo");
    const erroPreco = document.getElementById("erroPreco");

    function limparErros() {
        if (erroMarca) erroMarca.textContent = "";
        if (erroModelo) erroModelo.textContent = "";
        if (erroAnoFabricacao) erroAnoFabricacao.textContent = "";
        if (erroAnoModelo) erroAnoModelo.textContent = "";
        if (erroPreco) erroPreco.textContent = "";
    }

    // ==========================================
    // 5. ENVIO REAL DO ANÚNCIO PARA O BANCO (POST)
    // ==========================================
    const formAnuncio = document.getElementById("formAnuncio");
    const btnAnunciar = document.getElementById("btnAnunciar");

    if (formAnuncio) {
        formAnuncio.addEventListener("submit", async (e) => {
            e.preventDefault();
            limparErros();

            // Captura de elementos do formulário (com suporte a múltiplos IDs possíveis)
            const marcaEl = document.getElementById("marca");
            const modeloEl = document.getElementById("modelo");
            const versaoEl = document.getElementById("versao");
            const precoEl = document.getElementById("preco");
            const anoFabEl = document.getElementById("anoFabricacao") || document.getElementById("anoFab");
            const anoModEl = document.getElementById("anoModelo") || document.getElementById("anoMod");
            const kmEl = document.getElementById("quilometragem") || document.getElementById("km");
            const combustivelEl = document.getElementById("combustivel");
            const cambioEl = document.getElementById("cambio");
            const corEl = document.getElementById("cor");
            const portasEl = document.getElementById("portas");
            const carroceriaEl = document.getElementById("carroceria");
            const descricaoEl = document.getElementById("descricao");

            // Validações básicas (exigidas pelo seu fluxo antigo)
            let valido = true;

            if (marcaEl && marcaEl.value.trim() === "") {
                if (erroMarca) erroMarca.textContent = "Digite a marca.";
                valido = false;
            }

            if (modeloEl && modeloEl.value.trim() === "") {
                if (erroModelo) erroModelo.textContent = "Digite o modelo.";
                valido = false;
            }

            if (anoFabEl && anoFabEl.value.trim() === "") {
                if (erroAnoFabricacao) erroAnoFabricacao.textContent = "Digite o ano de fabricação.";
                valido = false;
            }

            if (anoModEl && anoModEl.value.trim() === "") {
                if (erroAnoModelo) erroAnoModelo.textContent = "Digite o ano do modelo.";
                valido = false;
            }

            if (precoEl && precoEl.value.trim() === "") {
                if (erroPreco) erroPreco.textContent = "Digite o preço.";
                valido = false;
            }

            if (!valido) return;

            const formData = new FormData();

            // Vincula o ID do usuário logado de forma dinâmica com fallback seguro
            formData.append("usuario_id", usuario.id || 1); 

            // Preenchimento do FormData alinhado com o back-end
            formData.append("marca", marcaEl ? marcaEl.value.trim() : "");
            formData.append("modelo", modeloEl ? modeloEl.value.trim() : "");
            formData.append("versao", versaoEl ? versaoEl.value.trim() : "");
            formData.append("preco", precoEl ? precoEl.value : 0);
            formData.append("ano_fabricacao", anoFabEl ? anoFabEl.value : 2020);
            formData.append("ano_modelo", anoModEl ? anoModEl.value : 2020);
            formData.append("quilometragem", kmEl ? (kmEl.value || 0) : 0);
            formData.append("combustivel", combustivelEl ? combustivelEl.value : "Gasolina");
            formData.append("cambio", cambioEl ? cambioEl.value : "Automático");
            formData.append("cor", corEl ? corEl.value.trim() : "");
            formData.append("portas", portasEl ? portasEl.value : 2);
            formData.append("carroceria", carroceriaEl ? carroceriaEl.value.trim() : "Coupé");
            formData.append("descricao", descricaoEl ? descricaoEl.value.trim() : "");

            // Anexa a imagem selecionada
            if (inputImagem && inputImagem.files && inputImagem.files[0]) {
                formData.append("imagem", inputImagem.files[0]);
            }

            if (btnAnunciar) {
                btnAnunciar.textContent = "Publicando...";
                btnAnunciar.disabled = true;
            }

            try {
                const resposta = await fetch('/api/veiculos', {
                    method: 'POST',
                    body: formData
                });

                const resultado = await resposta.json();

                alert(resultado.mensagem || (resultado.sucesso ? "Anúncio publicado com sucesso!" : "Operação realizada."));

                if (resposta.ok && resultado.sucesso) {
                    formAnuncio.reset();
                    
                    if (nomeArquivo) nomeArquivo.textContent = 'Selecionar Foto';
                    if (btnVerFoto) btnVerFoto.disabled = true;
                    if (miniaturaPreview) {
                        miniaturaPreview.src = '';
                        miniaturaPreview.style.display = 'none';
                    }

                    await carregarVeiculosDoBanco();
                    irParaCatalogo();

                    // Redirecionamento dinâmico conforme o tipo de usuário
                    if (usuario.tipo === "empresa") {
                        window.location.href = "/pages/painel-empresa.html";
                    } else if (usuario.tipo === "cliente") {
                        window.location.href = "/pages/painel-cliente.html";
                    }
                }

            } catch (erro) {
                console.error("Erro na requisição de cadastro:", erro);
                alert("Erro de conexão com o servidor ao tentar enviar o anúncio.");
            } finally {
                if (btnAnunciar) {
                    btnAnunciar.textContent = "Publicar anúncio";
                    btnAnunciar.disabled = false;
                }
            }
        });
    }

    // ==========================================
    // 6. EVENTOS AUXILIARES E INICIALIZAÇÃO
    // ==========================================
    if (btnBuscar) btnBuscar.addEventListener("click", executarBusca);
    if (btnLimpar) btnLimpar.addEventListener("click", limparFiltros);
    if (inputPesquisa) inputPesquisa.addEventListener("keyup", executarBusca);

    // Carrega os veículos do MySQL assim que a página é aberta
    carregarVeiculosDoBanco();
});

// Função global para fechar o modal da foto
function fecharModalFoto() {
    const modal = document.getElementById('modalVisualizarFoto');
    if (modal) {
        modal.classList.remove('ativo');
    }
}

document.addEventListener("DOMContentLoaded", () => {
    carregarVeiculosCatalogo();
});

async function carregarVeiculosCatalogo() {
    try {
        const resposta = await fetch('http://localhost:4000/api/veiculos');
        const resultado = await resposta.json();

        if (resultado.sucesso && resultado.veiculos) {
            // Seleciona a seção de veículos disponíveis no seu HTML
            const sectionVeiculos = document.querySelector('.catalog-section');
            
            // Cria um container para os cards se já não existir
            let containerGrid = sectionVeiculos.querySelector('.grid-veiculos');
            if (!containerGrid) {
                containerGrid = document.createElement('div');
                containerGrid.className = 'grid-veiculos';
                containerGrid.style.display = 'grid';
                containerGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
                containerGrid.style.gap = '20px';
                containerGrid.style.marginTop = '15px';
                sectionVeiculos.appendChild(containerGrid);
            } else {
                containerGrid.innerHTML = '';
            }

            resultado.veiculos.forEach(veiculo => {
                const imagemSrc = veiculo.imagem ? `/uploads/${veiculo.imagem}` : '/imagens/sem-foto.jpg';
                
                const card = document.createElement('div');
                card.className = 'card-item-catalogo';
                card.style.cssText = 'border: 1px solid #e1e1e1; border-radius: 8px; overflow: hidden; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05);';

                card.innerHTML = `
                    <img src="${imagemSrc}" alt="${veiculo.modelo_nome}" style="width: 100%; height: 160px; object-fit: cover;">
                    <div style="padding: 15px;">
                        <h3 style="font-size: 16px; margin-bottom: 8px;">${veiculo.marca_nome} ${veiculo.modelo_nome}</h3>
                        <p style="color: #666; font-size: 14px; margin-bottom: 6px;">${veiculo.versao || ''}</p>
                        <p style="color: #666; font-size: 13px; margin-bottom: 8px;">Ano: ${veiculo.ano_fabricacao}/${veiculo.ano_modelo} | ${veiculo.quilometragem || 0} km</p>
                        <p style="font-size: 18px; font-weight: bold; color: #2b7a78;">R$ ${Number(veiculo.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                `;

                containerGrid.appendChild(card);
            });
        }
    } catch (erro) {
        console.error("Erro ao carregar o catálogo de veículos:", erro);
    }
}

resultado.veiculos.forEach(veiculo => {
    const imagemSrc = veiculo.imagem ? `/uploads/${veiculo.imagem}` : '/imagens/sem-foto.jpg';
    
    const card = document.createElement('div');
    card.className = 'card-item-catalogo';

    card.innerHTML = `
        <div class="card-img-wrapper" style="width: 100%; height: 180px; overflow: hidden; background-color: #000;">
            <img src="${imagemSrc}" alt="${veiculo.modelo_nome}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
        <div class="card-corpo" style="background-color: #000000; padding: 15px; display: flex; flex-direction: column; flex-grow: 1; justify-content: space-between;">
            <h3 style="color: #ff0000; font-size: 16px; margin-bottom: 10px; font-weight: bold;">${veiculo.marca_nome} ${veiculo.modelo_nome}</h3>
            
            <div style="display: flex; align-items: flex-end; justify-content: space-between; margin-top: auto; padding-top: 10px;">
                <div>
                    <span style="font-size: 11px; color: #ff4d4d; display: block; margin-bottom: 2px;">Valor Total</span>
                    <span class="card-preco" style="font-size: 18px; font-weight: 800; color: #ff0000;">R$ ${Number(veiculo.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <a href="/pages/detalhes.html?id=${veiculo.id}" class="btn-detalhes" style="background-color: #ff0000; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: bold; text-decoration: none;">Ver</a>
            </div>
        </div>
    `;

    containerGrid.appendChild(card);
});