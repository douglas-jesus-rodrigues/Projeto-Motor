document.addEventListener("DOMContentLoaded", () => {

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

    // ==========================================
    // 2. BANCO DE DADOS LOCAL DE VEÍCULOS
    // ==========================================
    const bancoDeDadosVeiculos = [
        // --- BARATOS ---
        { id: 1, nome: "Chevrolet Onix Premier Turbo", marca: "Chevrolet", categoria: "Hatch", transmissao: "Automático", combustivel: "Flex", ano: 2023, condicao: "Seminovo", quilometragem: "15.000 Km", preco: 84000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800" },
        { id: 2, nome: "Citroën C4 Cactus Shine Pack", marca: "Citroën", categoria: "SUV", transmissao: "Automático", combustivel: "Flex", ano: 2022, condicao: "Seminovo", quilometragem: "26.000 Km", preco: 85000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800" },
        { id: 3, nome: "Peugeot 208 Griffe 1.6", marca: "Peugeot", categoria: "Hatch", transmissao: "Automático", combustivel: "Flex", ano: 2023, condicao: "Seminovo", quilometragem: "12.000 Km", preco: 88000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=800" },
        { id: 4, nome: "Hyundai HB20 Platinum Plus", marca: "Hyundai", categoria: "Hatch", transmissao: "Automático", combustivel: "Flex", ano: 2024, condicao: "Novo", quilometragem: "0 Km", preco: 89000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800" },
        { id: 5, nome: "Renault Duster Iconic 1.3T", marca: "Renault", categoria: "SUV", transmissao: "Automático", combustivel: "Flex", ano: 2021, condicao: "Usado", quilometragem: "58.000 Km", preco: 92000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800" },

        // --- MÉDIOS ---
        { id: 6, nome: "Volkswagen Polo GTS 1.4 TSI", marca: "Volkswagen", categoria: "Hatch", transmissao: "Automático", combustivel: "Flex", ano: 2022, condicao: "Seminovo", quilometragem: "18.000 Km", preco: 105000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800" },
        { id: 7, nome: "Fiat Pulse Impetus Turbo", marca: "Fiat", categoria: "SUV", transmissao: "Automático", combustivel: "Flex", ano: 2024, condicao: "Novo", quilometragem: "0 Km", preco: 108000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800" },
        { id: 8, nome: "Nissan Kicks Exclusive CVT", marca: "Nissan", categoria: "SUV", transmissao: "Automático", combustivel: "Flex", ano: 2022, condicao: "Seminovo", quilometragem: "30.000 Km", preco: 112000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800" },
        { id: 9, nome: "Honda Civic EXL 2.0", marca: "Honda", categoria: "Sedan", transmissao: "Automático", combustivel: "Flex", ano: 2021, condicao: "Seminovo", quilometragem: "35.000 Km", preco: 118000, destaquePrincipal: true, imagem: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=800" },
        { id: 10, nome: "Chevrolet Tracker Premier 1.2", marca: "Chevrolet", categoria: "SUV", transmissao: "Automático", combustivel: "Flex", ano: 2022, condicao: "Seminovo", quilometragem: "27.000 Km", preco: 119000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800" },
        { id: 11, nome: "Toyota Corolla Altis Hybrid", marca: "Toyota", categoria: "Sedan", transmissao: "Automático", combustivel: "Híbrido", ano: 2022, condicao: "Seminovo", quilometragem: "22.000 Km", preco: 135000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800" },
        { id: 12, nome: "Jeep Compass Longitude Turbo", marca: "Jeep", categoria: "SUV", transmissao: "Automático", combustivel: "Flex", ano: 2022, condicao: "Seminovo", quilometragem: "25.000 Km", preco: 142000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800" },
        { id: 13, nome: "Honda HR-V Touring Turbo", marca: "Honda", categoria: "SUV", transmissao: "Automático", combustivel: "Flex", ano: 2023, condicao: "Seminovo", quilometragem: "11.000 Km", preco: 158000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800" },
        { id: 14, nome: "Mercedes-Benz C180 AMG Line", marca: "Mercedes-Benz", categoria: "Sedan", transmissao: "Automático", combustivel: "Gasolina", ano: 2018, condicao: "Usado", quilometragem: "68.000 Km", preco: 165000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800" },
        { id: 15, nome: "Mini Cooper S 2.0 Turbo", marca: "Mini", categoria: "Hatch", transmissao: "Automático", combustivel: "Gasolina", ano: 2021, condicao: "Seminovo", quilometragem: "23.000 Km", preco: 168000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800" },
        { id: 16, nome: "Lexus UX 250h Hybrid", marca: "Lexus", categoria: "SUV", transmissao: "Automático", combustivel: "Híbrido", ano: 2020, condicao: "Usado", quilometragem: "52.000 Km", preco: 175000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800" },

        // --- CAROS ---
        { id: 17, nome: "Volkswagen Jetta GLI 350 TSI", marca: "Volkswagen", categoria: "Sedan", transmissao: "Automático", combustivel: "Gasolina", ano: 2021, condicao: "Seminovo", quilometragem: "29.000 Km", preco: 185000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800" },
        { id: 18, nome: "Subaru WRX STI 2.5 Turbo", marca: "Subaru", categoria: "Sedan", transmissao: "Manual", combustivel: "Gasolina", ano: 2018, condicao: "Usado", quilometragem: "64.000 Km", preco: 189000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1626668893632-6f3a4466d22f?w=800" },
        { id: 19, nome: "Audi A4 Performance Black", marca: "Audi", categoria: "Sedan", transmissao: "Automático", combustivel: "Gasolina", ano: 2020, condicao: "Usado", quilometragem: "55.000 Km", preco: 198000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800" },
        { id: 20, nome: "BMW X1 sDrive20i M Sport", marca: "BMW", categoria: "SUV", transmissao: "Automático", combustivel: "Flex", ano: 2022, condicao: "Seminovo", quilometragem: "20.000 Km", preco: 215000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1523983388277-336a66bf9bcd?w=800" },
        { id: 21, nome: "Ford Ranger Limited V6", marca: "Ford", categoria: "Picape", transmissao: "Automático", combustivel: "Diesel", ano: 2024, condicao: "Novo", quilometragem: "0 Km", preco: 220000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1551830820-330a71b99659?w=800" },
        { id: 22, nome: "Audi Q3 Black Edition 2.0", marca: "Audi", categoria: "SUV", transmissao: "Automático", combustivel: "Gasolina", ano: 2021, condicao: "Seminovo", quilometragem: "31.000 Km", preco: 228000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=800" },
        { id: 23, nome: "BMW 320i M Sport", marca: "BMW", categoria: "Sedan", transmissao: "Automático", combustivel: "Gasolina", ano: 2021, condicao: "Seminovo", quilometragem: "28.000 Km", preco: 239000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800" },
        { id: 24, nome: "Toyota Hilux SRX 2.8 Diesel", marca: "Toyota", categoria: "Picape", transmissao: "Automático", combustivel: "Diesel", ano: 2021, condicao: "Seminovo", quilometragem: "45.000 Km", preco: 245000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800" },

        // --- SUPER LUXO / ESPORTIVOS ---
        { id: 25, nome: "Volvo XC60 Inscription T8", marca: "Volvo", categoria: "SUV", transmissao: "Automático", combustivel: "Híbrido", ano: 2021, condicao: "Seminovo", quilometragem: "32.000 Km", preco: 275000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1532581140115-3e355d1ed1de?w=800" },
        { id: 26, nome: "Tesla Model 3 Long Range", marca: "Tesla", categoria: "Sedan", transmissao: "Automático", combustivel: "Elétrico", ano: 2022, condicao: "Seminovo", quilometragem: "19.000 Km", preco: 310000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800" },
        { id: 27, nome: "Dodge Challenger R/T 5.7 V8", marca: "Dodge", categoria: "Cupê", transmissao: "Automático", combustivel: "Gasolina", ano: 2018, condicao: "Usado", quilometragem: "48.000 Km", preco: 340000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1612544408865-a10126388b43?w=800" },
        { id: 28, nome: "Ford Mustang GT V8", marca: "Ford", categoria: "Cupê", transmissao: "Automático", combustivel: "Gasolina", ano: 2020, condicao: "Seminovo", quilometragem: "12.000 Km", preco: 380000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd?w=800" },
        { id: 29, nome: "RAM 1500 Laramie V8", marca: "RAM", categoria: "Picape", transmissao: "Automático", combustivel: "Gasolina", ano: 2022, condicao: "Seminovo", quilometragem: "17.000 Km", preco: 410000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1609521263047-f8d205293f24?w=800" },
        { id: 30, nome: "Porsche 911 Carrera S", marca: "Porsche", categoria: "Cupê", transmissao: "Automático", combustivel: "Gasolina", ano: 2021, condicao: "Seminovo", quilometragem: "8.500 Km", preco: 790000, destaquePrincipal: false, imagem: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800" }
    ];

    let favoritos = new Set();
    let categoriaAbaAtiva = "todos";

    // Elementos DOM
    const featuredCarContainer = document.getElementById("featuredCar");
    const carsGrid = document.getElementById("carsGrid");
    const topDealsContainer = document.getElementById("topDeals");
    const inputPesquisa = document.getElementById("inputPesquisa");
    const selectMarca = document.getElementById("selectMarca");
    const selectCategoria = document.getElementById("selectCategoria");
    const selectTransmissao = document.getElementById("selectTransmissao");
    const btnBuscar = document.getElementById("btnBuscar");
    const btnLimpar = document.getElementById("btnLimpar");
    const catTabBtns = document.querySelectorAll(".cat-tab-btn");

    const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // ==========================================
    // 3. RENDERIZAÇÃO E FILTROS DO CATÁLOGO
    // ==========================================
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
        if (!featuredCarContainer) return;

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
            carsGrid.innerHTML = `<p style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">Nenhum veículo encontrado para os critérios aplicados.</p>`;
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

        document.querySelectorAll('.btn-fav').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = Number(e.currentTarget.dataset.id);
                if (favoritos.has(id)) {
                    favoritos.delete(id);
                } else {
                    favoritos.add(id);
                }
                executarBusca();
            });
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
    // 4. UPLOAD DE FOTO E PUBLICAÇÃO DE ANÚNCIO
    // ==========================================
    const inputImg = document.getElementById('imagem');
    const dropzone = document.querySelector('.dropzone-file');
    const nomeArq = document.getElementById('nomeArquivoSelecionado');
    let imagemBase64 = null;

    if (inputImg && dropzone) {
        inputImg.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    imagemBase64 = event.target.result;
                    let imgPreview = dropzone.querySelector('.preview-imagem');
                    if (!imgPreview) {
                        imgPreview = document.createElement('img');
                        imgPreview.classList.add('preview-imagem');
                        dropzone.insertBefore(imgPreview, nomeArq);
                    }
                    imgPreview.src = imagemBase64;
                    const svgIcon = dropzone.querySelector('svg');
                    if (svgIcon) svgIcon.style.display = 'none';
                    if (nomeArq) {
                        nomeArq.textContent = `Foto carregada: (${file.name})`;
                        nomeArq.style.color = '#fff';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    const formAnuncio = document.getElementById("formAnuncio");
    if (formAnuncio) {
        formAnuncio.addEventListener("submit", (e) => {
            e.preventDefault();

            const marcaVal = document.getElementById("marca").value.trim();
            const modeloVal = document.getElementById("modelo").value.trim();
            const precoVal = parseFloat(document.getElementById("preco").value);
            const urlDiretaInput = document.getElementById("urlImagemDireta");
            const urlDireta = urlDiretaInput ? urlDiretaInput.value.trim() : "";
            const condicaoInput = document.getElementById("condicao") ? document.getElementById("condicao").value : "Seminovo";

            const fotoFinal = imagemBase64 || urlDireta || "https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=600";

            const novoCarro = {
                id: Date.now(),
                nome: `${marcaVal} ${modeloVal} ${document.getElementById("versao") ? document.getElementById("versao").value.trim() : ""}`.trim(),
                marca: marcaVal,
                categoria: document.getElementById("carroceria") ? document.getElementById("carroceria").value : "Sedan",
                transmissao: document.getElementById("cambio") ? document.getElementById("cambio").value : "Automático",
                combustivel: document.getElementById("combustivel") ? document.getElementById("combustivel").value : "Flex",
                ano: document.getElementById("anoFabricacao") ? parseInt(document.getElementById("anoFabricacao").value) : 2024,
                condicao: condicaoInput,
                quilometragem: document.getElementById("quilometragem") && document.getElementById("quilometragem").value ? `${document.getElementById("quilometragem").value} Km` : "0 Km",
                preco: precoVal,
                destaquePrincipal: false,
                imagem: fotoFinal
            };

            bancoDeDadosVeiculos.unshift(novoCarro);
            popularSelects();
            executarBusca();

            alert("Anúncio publicado com sucesso! O veículo já está visível no catálogo.");
            formAnuncio.reset();
            if (dropzone) {
                const imgPreview = dropzone.querySelector('.preview-imagem');
                if (imgPreview) imgPreview.remove();
                const svgIcon = dropzone.querySelector('svg');
                if (svgIcon) svgIcon.style.display = 'block';
                if (nomeArq) nomeArq.textContent = "Clique para escolher uma foto ou arraste até aqui";
            }
            imagemBase64 = null;

            const tabCatalogo = document.querySelector('[data-tab="tab-catalogo"]');
            if (tabCatalogo) tabCatalogo.click();
        });
    }

    // ==========================================
    // 5. SIMULADOR DE FINANCIAMENTO
    // ==========================================
    const btnSimular = document.getElementById("btnSimular");
    const resultadoSimulacao = document.getElementById("resultadoSimulacao");

    if (btnSimular) {
        btnSimular.addEventListener("click", () => {
            const valor = parseFloat(document.getElementById("finValor").value);
            const entrada = parseFloat(document.getElementById("finEntrada").value) || 0;
            const parcelas = parseInt(document.getElementById("finParcelas").value);
            const score = document.getElementById("finScore").value;

            if (!valor || valor <= 0) {
                alert("Por favor, digite o valor do veículo.");
                return;
            }

            const valorFinanciado = valor - entrada;
            if (valorFinanciado <= 0) {
                alert("O valor de entrada deve ser menor que o valor total do veículo.");
                return;
            }

            let taxaMensal = 0.0159;
            if (score === "excelente") taxaMensal = 0.0129;
            if (score === "regular") taxaMensal = 0.0199;

            const valorParcela = (valorFinanciado * (taxaMensal * Math.pow(1 + taxaMensal, parcelas))) / (Math.pow(1 + taxaMensal, parcelas) - 1);
            const custoTotal = (valorParcela * parcelas) + entrada;

            document.getElementById("resFinanciado").textContent = formatarMoeda(valorFinanciado);
            document.getElementById("resParcela").textContent = `${parcelas}x de ${formatarMoeda(valorParcela)}`;
            document.getElementById("resTotal").textContent = formatarMoeda(custoTotal);
            document.getElementById("resTaxa").textContent = `${(taxaMensal * 100).toFixed(2)}% a.m.`;

            if (resultadoSimulacao) resultadoSimulacao.style.display = "block";
        });
    }

    window.solicitarAvaliacao = function() {
        alert("Solicitação de avaliação recebida! Nossos peritos entrarão em contato via WhatsApp em até 2 horas úteis.");
        const formAvaliacao = document.getElementById("formAvaliacao");
        if (formAvaliacao) formAvaliacao.reset();
    };

    // Listeners para os botões de ação do filtro
    if (btnBuscar) btnBuscar.addEventListener("click", executarBusca);
    if (btnLimpar) btnLimpar.addEventListener("click", limparFiltros);
    if (inputPesquisa) inputPesquisa.addEventListener("keyup", executarBusca);

    // Inicialização do estado da aplicação
    popularSelects();
    renderizarDestaque();
    renderizarCards(bancoDeDadosVeiculos);
    renderizarTopDeals();
});