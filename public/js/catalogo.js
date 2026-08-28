document.addEventListener("DOMContentLoaded", () => {
    // Array de Veículos
    const veiculos = [
        {
            id: 1,
            nome: "BMW X6 xDrive 35i",
            marca: "BMW",
            ano: "2012",
            condicao: "Usado",
            quilometragem: "92.000 Km",
            preco: 145000,
            destaquePrincipal: true,
            imagem: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80"
        },
        {
            id: 2,
            nome: "Acura MDX",
            marca: "Acura",
            ano: "2014",
            condicao: "Usado",
            quilometragem: "85.000 Km",
            preco: 78000,
            destaquePrincipal: false,
            imagem: "https://images.unsplash.com/photo-1541348263662-e082662d82da?w=400&q=80"
        },
        {
            id: 3,
            nome: "Audi A5 Cabriolet",
            marca: "Audi",
            ano: "2013",
            condicao: "Usado",
            quilometragem: "62.000 Km",
            preco: 177283,
            destaquePrincipal: false,
            imagem: "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=400&q=80"
        },
        {
            id: 4,
            nome: "Mercedes Benz SL550",
            marca: "Mercedes-Benz",
            ano: "2014",
            condicao: "Novo",
            quilometragem: "38.000 Km",
            preco: 364900,
            destaquePrincipal: false,
            imagem: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=400&q=80"
        },
        {
            id: 5,
            nome: "Porsche Boxster 2.7",
            marca: "Porsche",
            ano: "2014",
            condicao: "Novo",
            quilometragem: "25.000 Km",
            preco: 368079,
            destaquePrincipal: false,
            imagem: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&q=80"
        }
    ];

    // Referências DOM
    const featuredCarContainer = document.getElementById("featuredCar");
    const carsGrid = document.getElementById("carsGrid");
    const topDealsContainer = document.getElementById("topDeals");

    const selectMarca = document.getElementById("selectMarca");
    const selectCondicao = document.getElementById("selectCondicao");
    const selectAno = document.getElementById("selectAno");
    const selectPreco = document.getElementById("selectPreco");
    const btnBuscar = document.getElementById("btnBuscar");

    // Formatação BRL
    const formatarMoeda = (valor) => {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // Renderizar Destaque Principal
    function renderizarDestaque() {
        const principal = veiculos.find(v => v.destaquePrincipal) || veiculos[0];
        featuredCarContainer.innerHTML = `
            <img src="${principal.imagem}" alt="${principal.nome}">
            <div class="featured-info">
                ${principal.ano} ${principal.nome} | <span class="price">${formatarMoeda(principal.preco)}</span>
            </div>
        `;
    }

    // Renderizar Cards de Veículos
    function renderizarCards(lista) {
        carsGrid.innerHTML = "";

        const itensExibicao = lista.filter(v => !v.destaquePrincipal);

        if (itensExibicao.length === 0) {
            carsGrid.innerHTML = `<p style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--text-muted);">Nenhum veículo encontrado com os filtros selecionados.</p>`;
            return;
        }

        itensExibicao.forEach(carro => {
            const card = document.createElement("article");
            card.className = "car-card";
            card.innerHTML = `
                <div class="car-badge">${carro.condicao}</div>
                <img src="${carro.imagem}" alt="${carro.nome}">
                <div class="car-card-body">
                    <div class="car-card-title">${carro.nome}</div>
                    <div class="car-card-details">${carro.ano} | ${carro.quilometragem}</div>
                    <div class="car-card-price">${formatarMoeda(carro.preco)}</div>
                    <a href="#" class="btn-view">Ver Detalhes</a>
                </div>
            `;
            carsGrid.appendChild(card);
        });
    }

    // Renderizar Ofertas da Sidebar
    function renderizarTopDeals() {
        topDealsContainer.innerHTML = "";
        const deals = veiculos.slice(0, 3);

        deals.forEach(carro => {
            const item = document.createElement("div");
            item.className = "deal-item";
            item.innerHTML = `
                <img src="${carro.imagem}" alt="${carro.nome}">
                <div class="deal-info">
                    <div class="deal-title">${carro.nome}</div>
                    <div style="color: var(--text-muted); font-size: 0.7rem;">${carro.ano}</div>
                    <div class="deal-price">${formatarMoeda(carro.preco)}</div>
                </div>
            `;
            topDealsContainer.appendChild(item);
        });
    }

    // Filtrar Veículos
    function filtrarVeiculos() {
        const marca = selectMarca.value;
        const condicao = selectCondicao.value;
        const ano = selectAno.value;
        const precoMax = parseFloat(selectPreco.value) || Infinity;

        const filtrados = veiculos.filter(v => {
            const bateMarca = !marca || v.marca === marca;
            const bateCondicao = !condicao || v.condicao === condicao;
            const bateAno = !ano || v.ano === ano;
            const batePreco = v.preco <= precoMax;

            return bateMarca && bateCondicao && bateAno && batePreco;
        });

        renderizarCards(filtrados);
    }

    // Event Listener de Busca
    btnBuscar.addEventListener("click", filtrarVeiculos);

    // Inicialização
    renderizarDestaque();
    renderizarCards(veiculos);
    renderizarTopDeals();
});