document.addEventListener("DOMContentLoaded", () => {

    // 1. GERENCIAMENTO DE NAVEGAÇÃO ENTRE ABAS
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

    // 2. BANCO DE DADOS COMPLETO COM 50 VEÍCULOS
    const bancoDeDadosVeiculos = [
        { id: 1, nome: "BMW X6 xDrive 35i", marca: "BMW", categoria: "SUV", transmissao: "Automático", combustivel: "Gasolina", ano: "2012", condicao: "Usado", quilometragem: "92.000 Km", preco: 145000, destaquePrincipal: true, imagem: "https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&cs=tinysrgb&w=800" },
        { id: 2, nome: "Acura MDX V6", marca: "Acura", categoria: "SUV", transmissao: "Automático", combustivel: "Gasolina", ano: "2014", condicao: "Usado", quilometragem: "85.000 Km", preco: 78000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 3, nome: "Audi A5 Cabriolet", marca: "Audi", categoria: "Conversível", transmissao: "Automático", combustivel: "Gasolina", ano: "2013", condicao: "Usado", quilometragem: "62.000 Km", preco: 177283, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/112460/pexels-photo-112460.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 4, nome: "Mercedes Benz SL550", marca: "Mercedes-Benz", categoria: "Conversível", transmissao: "Automático", combustivel: "Gasolina", ano: "2014", condicao: "Novo", quilometragem: "0 Km", preco: 364900, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/120049/pexels-photo-120049.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 5, nome: "Porsche Boxster 2.7", marca: "Porsche", categoria: "Coupé", transmissao: "Automático", combustivel: "Gasolina", ano: "2014", condicao: "Novo", quilometragem: "0 Km", preco: 368079, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 6, nome: "Chevrolet Camaro SS V8", marca: "Chevrolet", categoria: "Coupé", transmissao: "Automático", combustivel: "Gasolina", ano: "2018", condicao: "Usado", quilometragem: "42.000 Km", preco: 220000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/358070/pexels-photo-358070.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 7, nome: "Honda Civic Touring 1.5", marca: "Honda", categoria: "Sedan", transmissao: "CVT", combustivel: "Gasolina", ano: "2021", condicao: "Usado", quilometragem: "31.000 Km", preco: 128000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/210019/pexels-photo-210019.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 8, nome: "Toyota Corolla Altis", marca: "Toyota", categoria: "Sedan", transmissao: "CVT", combustivel: "Híbrido", ano: "2022", condicao: "Usado", quilometragem: "25.000 Km", preco: 142000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/1005633/pexels-photo-1005633.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 9, nome: "Ford Mustang GT 5.0 V8", marca: "Ford", categoria: "Coupé", transmissao: "Automático", combustivel: "Gasolina", ano: "2020", condicao: "Usado", quilometragem: "18.000 Km", preco: 389000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/3311574/pexels-photo-3311574.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 10, name: "Volkswagen Golf GTI 2.0", marca: "Volkswagen", categoria: "Hatch", transmissao: "Automático", combustivel: "Gasolina", ano: "2019", condicao: "Usado", quilometragem: "48.000 Km", preco: 165000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/136872/pexels-photo-136872.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 11, nome: "BMW M3 Competition 3.0", marca: "BMW", categoria: "Sedan", transmissao: "Automático", combustivel: "Gasolina", ano: "2022", condicao: "Seminovo", quilometragem: "9.500 Km", preco: 749000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/10351082/pexels-photo-10351082.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 12, nome: "Audi R8 V10 Performance", marca: "Audi", categoria: "Coupé", transmissao: "Automático", combustivel: "Gasolina", ano: "2021", condicao: "Usado", quilometragem: "12.000 Km", preco: 1450000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/3972755/pexels-photo-3972755.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 13, nome: "Mercedes-AMG GT R", marca: "Mercedes-Benz", categoria: "Coupé", transmissao: "Automático", combustivel: "Gasolina", ano: "2020", condicao: "Usado", quilometragem: "14.200 Km", preco: 1680000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/3752194/pexels-photo-3752194.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 14, nome: "Volvo XC60 T8 Inscription", marca: "Volvo", categoria: "SUV", transmissao: "Automático", combustivel: "Híbrido", ano: "2021", condicao: "Usado", quilometragem: "34.000 Km", preco: 279900, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 15, nome: "Land Rover Range Rover Velar", marca: "Land Rover", categoria: "SUV", transmissao: "Automático", combustivel: "Gasolina", ano: "2019", condicao: "Usado", quilometragem: "52.000 Km", preco: 345000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/1149831/pexels-photo-1149831.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 16, nome: "Jeep Wrangler Rubicon", marca: "Jeep", categoria: "SUV", transmissao: "Automático", combustivel: "Gasolina", ano: "2022", condicao: "Usado", quilometragem: "16.000 Km", preco: 410000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/2526128/pexels-photo-2526128.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 17, nome: "Toyota Hilux SRX 2.8", marca: "Toyota", categoria: "Picape", transmissao: "Automático", combustivel: "Diesel", ano: "2023", condicao: "Seminovo", quilometragem: "11.000 Km", preco: 285000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/2676096/pexels-photo-2676096.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 18, nome: "Ford Ranger Limited V6", marca: "Ford", categoria: "Picape", transmissao: "Automático", combustivel: "Diesel", ano: "2024", condicao: "Novo", quilometragem: "0 Km", preco: 319900, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/2920064/pexels-photo-2920064.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 19, nome: "Chevrolet S10 High Country", marca: "Chevrolet", categoria: "Picape", transmissao: "Automático", combustivel: "Diesel", ano: "2022", condicao: "Usado", quilometragem: "39.000 Km", preco: 225000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/13861/pexels-photo-13861.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 20, nome: "RAM 2500 Laramie 6.7", marca: "RAM", categoria: "Picape", transmissao: "Automático", combustivel: "Diesel", ano: "2021", condicao: "Usado", quilometragem: "45.000 Km", preco: 429000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/1637859/pexels-photo-1637859.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 21, nome: "Porsche 911 Carrera S", marca: "Porsche", categoria: "Coupé", transmissao: "Automático", combustivel: "Gasolina", ano: "2021", condicao: "Usado", quilometragem: "13.000 Km", preco: 890000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 22, nome: "Ferrari 488 GTB 3.9 V8", marca: "Ferrari", categoria: "Coupé", transmissao: "Automático", combustivel: "Gasolina", ano: "2018", condicao: "Usado", quilometragem: "8.900 Km", preco: 2750000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/337909/pexels-photo-337909.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 23, nome: "Lamborghini Huracán EVO", marca: "Lamborghini", categoria: "Coupé", transmissao: "Automático", combustivel: "Gasolina", ano: "2020", condicao: "Usado", quilometragem: "6.200 Km", preco: 3400000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/2127733/pexels-photo-2127733.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 24, nome: "Tesla Model 3 Performance", marca: "Tesla", categoria: "Sedan", transmissao: "Automático", combustivel: "Elétrico", ano: "2022", condicao: "Usado", quilometragem: "21.000 Km", preco: 339000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/2526127/pexels-photo-2526127.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 25, nome: "Nissan GT-R Premium 3.8", marca: "Nissan", categoria: "Coupé", transmissao: "Automático", combustivel: "Gasolina", ano: "2017", condicao: "Usado", quilometragem: "27.000 Km", preco: 980000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/10351082/pexels-photo-10351082.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 26, nome: "Hyundai Creta Ultimate 2.0", marca: "Hyundai", categoria: "SUV", transmissao: "Automático", combustivel: "Flex", ano: "2023", condicao: "Seminovo", quilometragem: "14.000 Km", preco: 139900, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 27, nome: "Jeep Compass Longitude", marca: "Jeep", categoria: "SUV", transmissao: "Automático", combustivel: "Flex", ano: "2022", condicao: "Usado", quilometragem: "32.000 Km", preco: 148000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 28, nome: "Volkswagen Nivus Highline", marca: "Volkswagen", categoria: "SUV", transmissao: "Automático", combustivel: "Flex", ano: "2023", condicao: "Seminovo", quilometragem: "19.000 Km", preco: 124900, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/136872/pexels-photo-136872.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 29, nome: "Fiat Fastback Edition 1.3", marca: "Fiat", categoria: "SUV", transmissao: "Automático", combustivel: "Flex", ano: "2023", condicao: "Usado", quilometragem: "15.000 Km", preco: 129000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/210019/pexels-photo-210019.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 30, nome: "Subaru WRX STI 2.5 Turbo", marca: "Subaru", categoria: "Sedan", transmissao: "Manual", combustivel: "Gasolina", ano: "2018", condicao: "Usado", quilometragem: "41.000 Km", preco: 210000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/358070/pexels-photo-358070.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 31, nome: "Mini Cooper S 2.0 Turbo", marca: "Mini", categoria: "Hatch", transmissao: "Automático", combustivel: "Gasolina", ano: "2021", condicao: "Usado", quilometragem: "23.000 Km", preco: 169900, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/112460/pexels-photo-112460.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 32, nome: "BMW 320i M Sport 2.0", marca: "BMW", categoria: "Sedan", transmissao: "Automático", combustivel: "Flex", ano: "2023", condicao: "Seminovo", quilometragem: "10.000 Km", preco: 289900, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&cs=tinysrgb&w=800" },
        { id: 33, nome: "Mercedes-Benz C300 AMG Line", marca: "Mercedes-Benz", categoria: "Sedan", transmissao: "Automático", combustivel: "Gasolina", ano: "2022", condicao: "Usado", quilometragem: "17.000 Km", preco: 320000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/120049/pexels-photo-120049.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 34, nome: "Audi A4 Performance Black", marca: "Audi", categoria: "Sedan", transmissao: "Automático", combustivel: "Gasolina", ano: "2021", condicao: "Usado", quilometragem: "29.000 Km", preco: 235000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/112460/pexels-photo-112460.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 35, nome: "Lexus RX 450h F-Sport", marca: "Lexus", categoria: "SUV", transmissao: "CVT", combustivel: "Híbrido", ano: "2020", condicao: "Usado", quilometragem: "38.000 Km", preco: 315000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 36, nome: "Jaguar F-Type R-Dynamic", marca: "Jaguar", categoria: "Conversível", transmissao: "Automático", combustivel: "Gasolina", ano: "2019", condicao: "Usado", quilometragem: "22.000 Km", preco: 440000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/120049/pexels-photo-120049.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 37, nome: "Maserati Ghibli 3.0 V6", marca: "Maserati", categoria: "Sedan", transmissao: "Automático", combustivel: "Gasolina", ano: "2018", condicao: "Usado", quilometragem: "35.000 Km", preco: 410000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/337909/pexels-photo-337909.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 38, nome: "Dodge Challenger R/T 5.7", marca: "Dodge", categoria: "Coupé", transmissao: "Automático", combustivel: "Gasolina", ano: "2019", condicao: "Usado", quilometragem: "26.000 Km", preco: 395000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/3311574/pexels-photo-3311574.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 39, nome: "Chevrolet Tracker Premier 1.2", marca: "Chevrolet", categoria: "SUV", transmissao: "Automático", combustivel: "Flex", ano: "2023", condicao: "Seminovo", quilometragem: "12.000 Km", preco: 119900, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 40, nome: "Renault Kwid Outsider 1.0", marca: "Renault", categoria: "Hatch", transmissao: "Manual", combustivel: "Flex", ano: "2023", condicao: "Usado", quilometragem: "22.000 Km", preco: 58000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/136872/pexels-photo-136872.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 41, nome: "Fiat Toro Ranch 2.0 Turbo", marca: "Fiat", categoria: "Picape", transmissao: "Automático", combustivel: "Diesel", ano: "2022", condicao: "Usado", quilometragem: "40.000 Km", preco: 152000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/2676096/pexels-photo-2676096.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 42, nome: "Volkswagen Amarok V6 Extreme", marca: "Volkswagen", categoria: "Picape", transmissao: "Automático", combustivel: "Diesel", ano: "2021", condicao: "Usado", quilometragem: "49.000 Km", preco: 219000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/2920064/pexels-photo-2920064.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 43, nome: "Nissan Kicks Exclusive 1.6", marca: "Nissan", categoria: "SUV", transmissao: "CVT", combustivel: "Flex", ano: "2022", condicao: "Usado", quilometragem: "28.000 Km", preco: 109900, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 44, nome: "Peugeot 208 Griffe 1.6", marca: "Peugeot", categoria: "Hatch", transmissao: "Automático", combustivel: "Flex", ano: "2022", condicao: "Usado", quilometragem: "31.000 Km", preco: 84900, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/210019/pexels-photo-210019.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 45, nome: "Citroën C4 Cactus Shine", marca: "Citroën", categoria: "SUV", transmissao: "Automático", combustivel: "Flex", ano: "2021", condicao: "Usado", quilometragem: "37.000 Km", preco: 79900, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 46, nome: "Hyundai HB20 Platinum 1.0T", marca: "Hyundai", categoria: "Hatch", transmissao: "Automático", combustivel: "Flex", ano: "2023", condicao: "Seminovo", quilometragem: "15.000 Km", preco: 89900, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/136872/pexels-photo-136872.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 47, nome: "Kia Sportage EX 2.0", marca: "Kia", categoria: "SUV", transmissao: "Automático", combustivel: "Híbrido", ano: "2023", condicao: "Seminovo", quilometragem: "18.000 Km", preco: 214900, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/3729464/pexels-photo-3729464.jpeg?auto=compress&cs=tinysrgb&w=800" },
        { id: 48, nome: "Suzuki Jimny Sierra 1.5", marca: "Suzuki", categoria: "SUV", transmissao: "Manual", combustivel: "Gasolina", ano: "2022", condicao: "Usado", quilometragem: "20.000 Km", preco: 154900, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/2526128/pexels-photo-2526128.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 49, nome: "BMW Z4 sDrive30i M", marca: "BMW", categoria: "Conversível", transmissao: "Automático", combustivel: "Gasolina", ano: "2021", condicao: "Usado", quilometragem: "14.000 Km", preco: 419000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/112460/pexels-photo-112460.jpeg?auto=compress&cs=tinysrgb&w=600" },
        { id: 50, nome: "Alfa Romeo Giulia Quadrifoglio", marca: "Alfa Romeo", categoria: "Sedan", transmissao: "Automático", combustivel: "Gasolina", ano: "2020", condicao: "Usado", quilometragem: "19.000 Km", preco: 580000, destaquePrincipal: false, imagem: "https://images.pexels.com/photos/10351082/pexels-photo-10351082.jpeg?auto=compress&cs=tinysrgb&w=600" }
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

    function popularSelects() {
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
        const principal = bancoDeDadosVeiculos.find(v => v.destaquePrincipal) || bancoDeDadosVeiculos[0];
        featuredCarContainer.innerHTML = `
            <img src="${principal.imagem}" alt="${principal.nome}">
            <div class="featured-info">
                ${principal.ano} ${principal.nome} | <span class="price">${formatarMoeda(principal.preco)}</span>
            </div>
        `;
    }

    function renderizarCards(lista) {
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
        topDealsContainer.innerHTML = "";
        bancoDeDadosVeiculos.slice(1, 5).forEach(carro => {
            topDealsContainer.innerHTML += `
                <div class="deal-item">
                    <img src="${carro.imagem}" alt="${carro.nome}">
                    <div class="deal-info">
                        <div class="deal-title">${carro.nome}</div>
                        <div style="color: var(--text-muted); font-size: 0.72rem;">${carro.ano}</div>
                        <div class="deal-price">${formatarMoeda(carro.preco)}</div>
                    </div>
                </div>
            `;
        });
    }

    function executarBusca() {
        const termo = inputPesquisa.value.toLowerCase().trim();
        const marca = selectMarca.value;
        const categoriaSelect = selectCategoria.value;
        const transmissao = selectTransmissao.value;

        const filtrados = bancoDeDadosVeiculos.filter(v => {
            const bateTexto = v.nome.toLowerCase().includes(termo) || v.marca.toLowerCase().includes(termo);
            const bateMarca = marca === "" || v.marca === marca;
            const bateCategoriaSelect = categoriaSelect === "" || v.categoria === categoriaSelect;
            const bateTransmissao = transmissao === "" || v.transmissao === transmissao;
            const bateAbaCat = categoriaAbaAtiva === "todos" || v.categoria === categoriaAbaAtiva;

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
        inputPesquisa.value = "";
        selectMarca.value = "";
        selectCategoria.value = "";
        selectTransmissao.value = "";
        categoriaAbaAtiva = "todos";
        catTabBtns.forEach(b => b.classList.remove("active"));
        catTabBtns[0].classList.add("active");
        executarBusca();
    }

    // 3. UPLOAD DE FOTO E PREVIEW
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
                    nomeArq.textContent = `Foto carregada: (${file.name})`;
                    nomeArq.style.color = '#fff';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 4. SUBMIT DE ANÚNCIO (INSERÇÃO DINÂMICA AO BANCO DE DADOS E CATÁLOGO)
    const formAnuncio = document.getElementById("formAnuncio");
    if (formAnuncio) {
        formAnuncio.addEventListener("submit", (e) => {
            e.preventDefault();

            const marcaVal = document.getElementById("marca").value.trim();
            const modeloVal = document.getElementById("modelo").value.trim();
            const precoVal = parseFloat(document.getElementById("preco").value);
            const urlDireta = document.getElementById("urlImagemDireta").value.trim();

            const fotoFinal = imagemBase64 || urlDireta || "https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=600";

            const novoCarro = {
                id: Date.now(),
                nome: `${marcaVal} ${modeloVal} ${document.getElementById("versao").value.trim()}`.trim(),
                marca: marcaVal,
                categoria: document.getElementById("carroceria").value || "Sedan",
                transmissao: document.getElementById("cambio").value || "Automático",
                combustivel: document.getElementById("combustivel").value || "Flex",
                ano: document.getElementById("anoFabricacao").value || "2024",
                condicao: "Seminovo",
                quilometragem: document.getElementById("quilometragem").value ? `${document.getElementById("quilometragem").value} Km` : "0 Km",
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
                nomeArq.textContent = "Clique para escolher uma foto ou arraste até aqui";
            }
            imagemBase64 = null;

            document.querySelector('[data-tab="tab-catalogo"]').click();
        });
    }

    // 5. SIMULADOR DE FINANCIAMENTO
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

            resultadoSimulacao.style.display = "block";
        });
    }

    window.solicitarAvaliacao = function() {
        alert("Solicitação de avaliação recebida! Nossos peritos entrarão em contato via WhatsApp em até 2 horas úteis.");
        document.getElementById("formAvaliacao").reset();
    };

    btnBuscar.addEventListener("click", executarBusca);
    btnLimpar.addEventListener("click", limparFiltros);
    inputPesquisa.addEventListener("keyup", executarBusca);

    popularSelects();
    renderizarDestaque();
    renderizarCards(bancoDeDadosVeiculos);
    renderizarTopDeals();
});