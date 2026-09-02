document.addEventListener("DOMContentLoaded", () => {
    
    const linksSpa = document.querySelectorAll(".nav-link[data-target]");
    const secoes = document.querySelectorAll(".page-section");
    
    // Elemento de anunciar carro (forçado a sumir abaixo)
    const itemAnunciar = document.getElementById("itemAnunciar"); // Certifique-se que o ID no HTML é esse ou ajuste aqui
    if (itemAnunciar) {
        itemAnunciar.style.display = "none";
    }
    
    function alternarSecao(targetId) {
        secoes.forEach(sec => sec.classList.remove("active"));
        document.getElementById(`sec-${targetId}`)?.classList.add("active");
        linksSpa.forEach(link => link.classList.toggle("active", link.dataset.target === targetId));
    }
    
    linksSpa.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            alternarSecao(link.dataset.target);
            window.location.hash = link.dataset.target;
        });
    });
    
    const hash = window.location.hash.replace("#", "") || "home";
    alternarSecao(document.getElementById(`sec-${hash}`) ? hash : "home");

    const usuario = JSON.parse(localStorage.getItem("usuario"));
    if (usuario) {
        if (acoesDeslogado) acoesDeslogado.style.display = "none";
        if (dropdownUsuario) dropdownUsuario.style.display = "block";

        let rotaPainel = "/pages/painel-cliente.html";
        if (usuario.tipo === "empresa") {
            rotaPainel = "/pages/painel-empresa.html";
        } else if (usuario.tipo === "admin" || usuario.cargo === "admin") {
            rotaPainel = "/pages/painel-admin.html";
        }

        if (irPainel) {
            irPainel.href = rotaPainel;
        }

        let nomeExibicao = "Minha Conta";
        if (usuario.tipo === "empresa" && usuario.empresa && usuario.empresa.nome_empresa) {
            nomeExibicao = usuario.empresa.nome_empresa;
        } else if (usuario.nome) {
            nomeExibicao = usuario.nome.split(" ")[0];
        }

        if (nomeUsuario) nomeUsuario.textContent = nomeExibicao;
        if (avatarLetra) avatarLetra.textContent = nomeExibicao.charAt(0).toUpperCase();

    } else {
        if (acoesDeslogado) acoesDeslogado.style.display = "flex";
        if (dropdownUsuario) dropdownUsuario.style.display = "none";
    }

    // 3. DROPDOWN E SAIR
    const btnConfig = document.getElementById("btnConfig");
    const menuConfig = document.getElementById("menuConfig");

    if (btnConfig && menuConfig) {
        btnConfig.addEventListener("click", (e) => {
            e.stopPropagation();
            const oculto = menuConfig.hidden;
            menuConfig.hidden = !oculto;
            btnConfig.setAttribute("aria-expanded", oculto);
        });

        document.addEventListener("click", (e) => {
            if (!btnConfig.contains(e.target) && !menuConfig.contains(e.target)) {
                menuConfig.hidden = true;
                btnConfig.setAttribute("aria-expanded", "false");
            }
        });
    }

    const btnSair = document.getElementById("btnSair");
    if (btnSair) {
        btnSair.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("usuario");
            window.location.reload();
        });
    }

    // 4. FUNCIONALIDADE DE BUSCA RÁPIDA
    const btnBuscarRapido = document.getElementById("btnBuscarRapido");
    const inputBuscaRapida = document.getElementById("inputBuscaRapida");

    function buscar() {
        const termo = inputBuscaRapida.value.trim();
        location.href = termo ? `/pages/catalogo.html?busca=${encodeURIComponent(termo)}` : "/pages/catalogo.html";
    }
    btnBuscarRapido?.addEventListener("click", buscar);
    inputBuscaRapida?.addEventListener("keypress", (e) => e.key === "Enter" && buscar());

    btnMobile?.addEventListener("click", () => menuNavegacao.classList.toggle("ativo"));
    window.addEventListener("scroll", () => {
        header.style.background = scrollY > 50 ? "rgba(4,4,5,0.95)" : "rgba(8,8,10,0.85)";
        header.style.boxShadow = scrollY > 50 ? "0 10px 30px rgba(0,0,0,0.7)" : "none";
    });

    // CARROS SEM BMW
    const carros = [
        { nome: "Porsche 911 Turbo", marca: "Porsche", ano: "2024", img: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=500" },
        { nome: "Chevrolet Corvette", marca: "Chevrolet", ano: "2024", img: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=500" },
        { nome: "Ford Mustang GT", marca: "Ford", ano: "2024", img: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=500" },
        { nome: "Mercedes AMG GT", marca: "Mercedes", ano: "2024", img: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=500" },
        { nome: "Audi R8 V10", marca: "Audi", ano: "2024", img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=500" }
    ];

    const track = document.getElementById("carsTrack");
    if (track) track.innerHTML = [...carros, ...carros].map(c => `
        <a href="/pages/catalogo.html" class="car-card">
            <div class="car-imagem"><img src="${c.img}" alt="${c.nome}"></div>
            <div class="car-info">
                <h3 class="car-nome">${c.nome}</h3>
                <p class="car-detalhes">Marca: ${c.marca} • Ano: ${c.ano}</p>
            </div>
        </a>
    `).join("");

    btnVerCatalogo?.addEventListener("click", (e) => {
        const r = e.target.getBoundingClientRect();
        for (let i = 0; i < 16; i++) {
            const p = document.createElement("div");
            p.className = "smoke-particle";
            const a = Math.random() * Math.PI * 2, d = Math.random() * 140 + 50;
            p.style.cssText = `left:${r.left+r.width/2}px;top:${r.top+r.height/2}px;width:${Math.random()*70+40}px;height:${Math.random()*70+40}px;--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d-Math.random()*60}px;--scale:${(Math.random()*1.6+1.8).toFixed(2)}`;
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 1200);
        }
    });
});