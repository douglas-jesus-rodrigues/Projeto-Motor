document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 0. CORREÇÃO DO BUG DO BOTÃO "VOLTAR" (BFCACHE)
    // ==========================================
    window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
            document.body.classList.remove('page-exit');
        }
    });

    // --- 1. NAVEGAÇÃO SPA (Single Page Application) ---
    const linksSpa = document.querySelectorAll(".nav-link[data-target]");
    const secoes = document.querySelectorAll(".page-section");
    const menuNavegacao = document.getElementById("menuNavegacao");
    const btnMobile = document.getElementById("btnMobile");
    
    const itemAnunciar = document.getElementById("itemAnunciar");
    if (itemAnunciar) {
        itemAnunciar.style.display = "none";
    }
    
    function alternarSecao(targetId) {
        secoes.forEach(sec => sec.classList.remove("active"));
        const secaoAlvo = document.getElementById(`sec-${targetId}`);
        if (secaoAlvo) secaoAlvo.classList.add("active");
        
        linksSpa.forEach(link => link.classList.toggle("active", link.dataset.target === targetId));
    }
    
    linksSpa.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const targetId = link.dataset.target;
            alternarSecao(targetId);
            window.location.hash = targetId;

            if (menuNavegacao && menuNavegacao.classList.contains("active")) {
                menuNavegacao.classList.remove("active");
                if (btnMobile) btnMobile.classList.remove("active");
            }
        });
    });
    
    const hash = window.location.hash.replace("#", "") || "home";
    alternarSecao(document.getElementById(`sec-${hash}`) ? hash : "home");
    
    // --- 2. CONTROLE DE SESSÃO E PERFIL DO USUÁRIO ---
    const usuarioLogado = localStorage.getItem("usuario");
    const acoesDeslogado = document.getElementById("acoesDeslogado");
    const dropdownUsuario = document.getElementById("dropdownUsuario");
    const irPainel = document.getElementById("irPainel");
    const nomeUsuario = document.getElementById("nomeUsuario");
    
    const avatarLetra = document.getElementById("avatarLetra");
    const avatarImagem = document.getElementById("avatarImagem");
    const CAMINHO_FOTO_PERFIL = "../uploads/1788186907271-886045211.png";
    
    if (usuarioLogado && usuarioLogado !== "undefined" && usuarioLogado !== "null") {
        try {
            const usuario = JSON.parse(usuarioLogado);
            
            if (acoesDeslogado) acoesDeslogado.style.display = "none";
            if (dropdownUsuario) dropdownUsuario.style.display = "block";
            
            let rotaPainel = "/pages/painel-cliente.html";
            if (usuario.tipo === "empresa") {
                rotaPainel = "/pages/painel-empresa.html";
            } else if (usuario.tipo === "admin" || usuario.cargo === "admin" || usuario.tipo === "super_admin") {
                rotaPainel = "/pages/painel-admin.html";
            }
            if (irPainel) irPainel.href = rotaPainel;

            if (itemAnunciar && (usuario.tipo === "empresa" || usuario.tipo === "cliente")) {
                itemAnunciar.style.display = "inline-block";
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
        } catch (e) {
            localStorage.removeItem("usuario");
        }
    } else {
        if (acoesDeslogado) acoesDeslogado.style.display = "flex";
        if (dropdownUsuario) dropdownUsuario.style.display = "none";
    }
    
    // --- 3. MENU DE CONFIGURAÇÃO / DROPDOWN ---
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
    
    // --- 4. BOTÃO DE SAIR (LOGOUT SEGURO) ---
    const btnSair = document.getElementById("btnSair");
    if (btnSair) {
        btnSair.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("usuario");
            window.location.replace("/pages/login.html");
        });
    }
    
    // --- 5. BUSCA RÁPIDA (COM SUGESTÕES EM TEMPO REAL E IMAGENS) ---
    const btnBuscarRapido = document.getElementById("btnBuscarRapido");
    const inputBuscaRapida = document.getElementById("inputBuscaRapida");
    const sugestoesBusca = document.getElementById("sugestoesBusca");
    
    let veiculosBancoDeDados = [];

    function sanitizarSrcImagem(src) {
        if (typeof src !== "string" || !src) return "/imagens/sem-foto.jpg";
        if (src.startsWith("/") || src.startsWith("https://") || src.startsWith("http://")) return src;
        return `/uploads/${src}`;
    }

    async function carregarVeiculosParaSugestao() {
        try {
            const resposta = await fetch("/api/veiculos");
            if (resposta.ok) {
                const dados = await resposta.json();
                if (dados.sucesso && Array.isArray(dados.veiculos)) {
                    veiculosBancoDeDados = dados.veiculos;
                }
            }
        } catch (erro) {
            console.log("Sistema de sugestão indisponível temporariamente.");
        }
    }
    carregarVeiculosParaSugestao();

    function executarBusca() {
        if (!inputBuscaRapida) return;
        const termo = inputBuscaRapida.value.trim();
        const destino = termo ? `/pages/catalogo.html?busca=${encodeURIComponent(termo)}` : "/pages/catalogo.html";
        
        document.body.classList.add('page-exit');
        setTimeout(() => {
            window.location.href = destino;
        }, 300);
    }
    
    btnBuscarRapido?.addEventListener("click", executarBusca);
    inputBuscaRapida?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if(sugestoesBusca) sugestoesBusca.hidden = true;
            executarBusca();
        }
    });

    inputBuscaRapida?.addEventListener("input", (e) => {
        if (!sugestoesBusca) return;
        
        const textoDigitado = e.target.value.trim().toLowerCase();
        
        if (textoDigitado.length < 2) {
            sugestoesBusca.hidden = true;
            return;
        }

        const resultados = [];
        const nomesUnicos = new Set(); 

        for (const carro of veiculosBancoDeDados) {
            const marca = carro.marca_nome || carro.marca || "";
            const modelo = carro.modelo_nome || carro.modelo || "";
            const nomeCompletoPesquisa = `${marca} ${modelo} ${carro.versao || ""}`.toLowerCase();
            const nomeLimpoParaExibicao = `${marca} ${modelo}`.trim();

            if (nomeCompletoPesquisa.includes(textoDigitado) && !nomesUnicos.has(nomeLimpoParaExibicao)) {
                nomesUnicos.add(nomeLimpoParaExibicao);
                
                resultados.push({
                    nome: nomeLimpoParaExibicao,
                    imagemUrl: sanitizarSrcImagem(carro.imagem)
                });
            }

            if (resultados.length >= 6) break;
        }

        if (resultados.length > 0) {
            sugestoesBusca.innerHTML = resultados.map(item => `
                <li class="sugestao-item" data-nome="${escapeHTML(item.nome)}">
                    <img src="${item.imagemUrl}" alt="Foto de ${escapeHTML(item.nome)}" class="sugestao-img" onerror="this.src='/imagens/sem-foto.jpg'">
                    <span>${escapeHTML(item.nome)}</span>
                </li>
            `).join("");
            sugestoesBusca.hidden = false;
        } else {
            sugestoesBusca.hidden = true;
        }
    });

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
            }[tag] || tag)
        );
    }

    sugestoesBusca?.addEventListener("click", (e) => {
        const itemClicado = e.target.closest(".sugestao-item");
        if (itemClicado) {
            inputBuscaRapida.value = itemClicado.getAttribute("data-nome");
            sugestoesBusca.hidden = true;
            executarBusca();
        }
    });

    document.addEventListener("click", (e) => {
        if (inputBuscaRapida && sugestoesBusca) {
            if (!inputBuscaRapida.contains(e.target) && !sugestoesBusca.contains(e.target)) {
                sugestoesBusca.hidden = true;
            }
        }
    });
    
    // --- 6. MENU MOBILE E CABEÇALHO DINÂMICO (SCROLL) ---
    const header = document.querySelector("header");

    btnMobile?.addEventListener("click", () => {
        menuNavegacao?.classList.toggle("active");
        btnMobile.classList.toggle("active");
    });
    
    window.addEventListener("scroll", () => {
        if (header) {
            header.style.background = window.scrollY > 50 ? "rgba(4,4,5,0.95)" : "rgba(8,8,10,0.85)";
            header.style.boxShadow = window.scrollY > 50 ? "0 10px 30px rgba(0,0,0,0.7)" : "none";
            header.style.transition = "all 0.3s ease";
        }
    });
    
    // --- 7. CARROSSEL DE CARROS EM DESTAQUE ---
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
            <a href="/pages/catalogo.html?busca=${encodeURIComponent(c.nome)}" class="car-card">
                <div class="car-imagem"><img src="${c.img}" alt="${c.nome}"></div>
                <div class="car-info">
                    <h3 class="car-nome">${c.nome}</h3>
                    <p class="car-detalhes">Marca: ${c.marca} • Ano: ${c.ano}</p>
                </div>
            </a>
        `).join("");
    }
    
    // --- 8. ANIMAÇÃO DE FUMAÇA NO BOTÃO DO CATÁLOGO ---
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

    // --- 9. ANIMAÇÃO DE TRANSIÇÃO ENTRE PÁGINAS (FADE OUT) ---
    document.querySelectorAll('a[href]').forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            const target = this.getAttribute('target');
            
            if (target === '_blank') return;
            if (href.startsWith('#')) return;
            if (href === '' || href.startsWith('javascript:')) return;
            
            e.preventDefault();
            document.body.classList.add('page-exit');
            
            setTimeout(() => {
                window.location.href = href;
            }, 300); 
        });
    });
}); 
