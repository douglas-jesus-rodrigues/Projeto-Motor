document.addEventListener("DOMContentLoaded", () => {
    
    const linksSpa = document.querySelectorAll(".nav-link[data-target]");
    const secoes = document.querySelectorAll(".page-section");
    
    const itemAnunciar = document.getElementById("itemAnunciar");
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
            history.replaceState(null, "", `#${link.dataset.target}`);
        });
    });
    
    const hash = window.location.hash.replace("#", "") || "home";
    alternarSecao(document.getElementById(`sec-${hash}`) ? hash : "home");
    
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    
    // Elementos da interface
    const acoesDeslogado = document.getElementById("acoesDeslogado");
    const dropdownUsuario = document.getElementById("dropdownUsuario");
    const irPainel = document.getElementById("irPainel");
    const nomeUsuario = document.getElementById("nomeUsuario");
    const avatarLetra = document.getElementById("avatarLetra");
    const avatarImagem = document.getElementById("avatarImagem");
    const CAMINHO_FOTO_PERFIL = "../uploads/1788186907271-886045211.png";
    
    if (usuario) {
        if (acoesDeslogado) acoesDeslogado.style.display = "none";
        if (dropdownUsuario) dropdownUsuario.style.display = "block";
        
        let rotaPainel = "painel-cliente.html";
        if (usuario.tipo === "empresa") {
            rotaPainel = "painel-empresa.html";
        } else if (usuario.tipo === "admin" || usuario.cargo === "admin") {
            rotaPainel = "painel-admin.html";
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
        
        if (avatarLetra) avatarLetra.style.textIndent = "-9999px";
        if (avatarImagem) {
            avatarImagem.src = CAMINHO_FOTO_PERFIL;
            avatarImagem.style.display = "block";
        }
        
    } else {
        if (acoesDeslogado) acoesDeslogado.style.display = "flex";
        if (dropdownUsuario) dropdownUsuario.style.display = "none";
    }
    
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
    
    // CORRIGIDO: Remove o usuário e usa location.replace para limpar o histórico do navegador ao sair
    const btnSair = document.getElementById("btnSair");
    if (btnSair) {
        btnSair.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("usuario");
            window.location.replace("login.html");
        });
    }
    
    const btnBuscarRapido = document.getElementById("btnBuscarRapido");
    const inputBuscaRapida = document.getElementById("inputBuscaRapida");
    function buscar() {
        const termo = inputBuscaRapida.value.trim();
        const destino = termo ? `catalogo.html?busca=${encodeURIComponent(termo)}` : "catalogo.html";
        window.location.replace(destino);
    }
    btnBuscarRapido?.addEventListener("click", buscar);
    inputBuscaRapida?.addEventListener("keypress", (e) => e.key === "Enter" && buscar());
    
    const btnMobile = document.getElementById("btnMobile");
    const menuNavegacao = document.getElementById("menuNavegacao");
    const header = document.querySelector("header");

    btnMobile?.addEventListener("click", () => menuNavegacao.classList.toggle("ativo"));
    window.addEventListener("scroll", () => {
        if (header) {
            header.style.background = scrollY > 50 ? "rgba(4,4,5,0.95)" : "rgba(8,8,10,0.85)";
            header.style.boxShadow = scrollY > 50 ? "0 10px 30px rgba(0,0,0,0.7)" : "none";
        }
    });
    
    const carros = [
        { nome: "Porsche 911 Turbo", marca: "Porsche", ano: "2024", img: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=500" },
        { nome: "Chevrolet Corvette", marca: "Chevrolet", ano: "2024", img: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=500" },
        { nome: "Ford Mustang GT", marca: "Ford", ano: "2024", img: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=500" },
        { nome: "Mercedes AMG GT", marca: "Mercedes", ano: "2024", img: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=500" },
        { nome: "Audi R8 V10", marca: "Audi", ano: "2024", img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=500" }
    ];
    
    const track = document.getElementById("carsTrack");
    if (track) {
        track.innerHTML = [...carros, ...carros].map(c => `
            <a href="catalogo.html" class="car-card">
                <div class="car-imagem"><img src="${c.img}" alt="${c.nome}"></div>
                <div class="car-info">
                    <h3 class="car-nome">${c.nome}</h3>
                    <p class="car-detalhes">Marca: ${c.marca} • Ano: ${c.ano}</p>
                </div>
            </a>
        `).join("");
    }
    
    const btnVerCatalogo = document.getElementById("btnVerCatalogo");
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