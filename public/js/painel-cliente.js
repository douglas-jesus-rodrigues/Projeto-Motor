document.addEventListener("DOMContentLoaded", () => {
    // 1. Recupera os dados do usuário salvos no navegador no momento do login
    const chaveSessao = localStorage.getItem("usuario") ? "usuario" : "usuario_logado";
    const usuarioSalvo = localStorage.getItem(chaveSessao) || sessionStorage.getItem("usuario") || sessionStorage.getItem("usuario_logado");
    
    if (!usuarioSalvo) {
        // Se não estiver logado, redireciona para a página de login
        window.location.href = "/pages/login.html";
        return;
    }

    const usuario = JSON.parse(usuarioSalvo);

    // 2. Preenche o Nome do Usuário na tag <h2> com o ID 'nomeUsuario'
    const elNome = document.getElementById("nomeUsuario");
    if (elNome && usuario.nome) {
        elNome.textContent = usuario.nome;
    }

    // 3. Preenche a Foto de Perfil inicial
    const imgPerfil = document.getElementById("imgPerfil");
    if (imgPerfil) {
        if (usuario.fotoUrl || usuario.foto_perfil) {
            imgPerfil.src = usuario.fotoUrl || usuario.foto_perfil;
        } else if (usuario.nome) {
            // Se não tiver foto, gera as iniciais personalizadas com o seu nome
            imgPerfil.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.nome)}&background=181824&color=ff1e27&size=150`;
        }
    }

    // =========================================================================
    // 4. GERENCIAMENTO DO MENU DROPDOWN DE CONFIGURAÇÕES
    // =========================================================================
    const btnConfig = document.getElementById('btnConfig');
    const menuConfig = document.getElementById('menuConfig');

    if (btnConfig && menuConfig) {
        btnConfig.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita fechar imediatamente ao clicar no botão
            const isOpen = menuConfig.classList.toggle('mostrar');
            btnConfig.setAttribute('aria-expanded', isOpen);
        });

        // Fecha o menu ao clicar em qualquer outro lugar da tela
        document.addEventListener('click', (e) => {
            if (!menuConfig.contains(e.target) && !btnConfig.contains(e.target)) {
                menuConfig.classList.remove('mostrar');
                btnConfig.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // =========================================================================
    // 5. GERENCIAMENTO DO MODAL DE SAÍDA / LOGOUT
    // =========================================================================
    const gatilhoSair = document.getElementById('gatilhoSair');
    const modalSairContainer = document.getElementById('modalSairContainer');
    const btnCancelarSair = document.getElementById('btnCancelarSair');
    const btnSair = document.getElementById('btnSair');

    if (gatilhoSair && modalSairContainer) {
        gatilhoSair.addEventListener('click', (e) => {
            e.preventDefault();
            // Fecha o menu dropdown caso esteja aberto
            if (menuConfig) {
                menuConfig.classList.remove('mostrar');
                if (btnConfig) btnConfig.setAttribute('aria-expanded', 'false');
            }
            modalSairContainer.classList.add('mostrar-modal');
        });
    }

    if (btnCancelarSair && modalSairContainer) {
        btnCancelarSair.addEventListener('click', () => {
            modalSairContainer.classList.remove('mostrar-modal');
        });
    }

    if (modalSairContainer) {
        // Fecha o modal ao clicar fora da caixa de diálogo (no overlay escuro)
        modalSairContainer.addEventListener('click', (e) => {
            if (e.target === modalSairContainer) {
                modalSairContainer.classList.remove('mostrar-modal');
            }
        });
    }

    if (btnSair) {
        btnSair.addEventListener('click', () => {
            // Limpa todos os dados de sessão do usuário
            localStorage.removeItem("usuario");
            localStorage.removeItem("usuario_logado");
            localStorage.removeItem("token");
            sessionStorage.removeItem("usuario");
            sessionStorage.removeItem("usuario_logado");
            sessionStorage.removeItem("token");

            // Redireciona para a página de login
            window.location.href = "/pages/login.html";
        });
    }

    // =========================================================================
    // 6. GERENCIAMENTO DE UPLOAD DA FOTO DE PERFIL (VIA BACKEND / API)
    // =========================================================================
    const inputFoto = document.getElementById("inputFotoPerfil");

    if (inputFoto && imgPerfil) {
        inputFoto.addEventListener("change", async (e) => {
            const arquivo = e.target.files[0];
            if (!arquivo) return;

            // Validação de tamanho no Front-end (ex: máximo 5MB)
            const tamanhoMaximo = 5 * 1024 * 1024;
            if (arquivo.size > tamanhoMaximo) {
                alert("A foto selecionada deve ter no máximo 5MB.");
                inputFoto.value = ""; // Limpa a seleção
                return;
            }

            // Pré-visualização instantânea para melhorar a experiência do usuário (UX)
            const previewUrl = URL.createObjectURL(arquivo);
            const fotoAnterior = imgPerfil.src;
            imgPerfil.src = previewUrl;

            // Monta os dados para o envio via multipart/form-data
            const formData = new FormData();
            formData.append("fotoPerfil", arquivo); // Deve coincidir com upload.single("fotoPerfil") no backend
            formData.append("usuarioId", usuario.id || usuario._id); // Envia a identificação do usuário

            try {
                // Obtenha o token caso sua rota exija autenticação
                const token = localStorage.getItem("token") || sessionStorage.getItem("token");

                // CORRIGIDO: Rota ajustada para o prefixo correto do perfil ("/api/perfil/upload-foto")
                const resposta = await fetch("/api/perfil/upload-foto", {
                    method: "POST",
                    headers: {
                        ...(token && { "Authorization": `Bearer ${token}` })
                    },
                    body: formData
                });

                if (!resposta.ok) {
                    throw new Error("Erro no servidor ao tentar salvar a imagem.");
                }

                const dados = await resposta.json();

                // Atualiza a imagem com a URL final retornada pelo servidor
                if (dados.fotoUrl) {
                    imgPerfil.src = dados.fotoUrl;
                    
                    // Atualiza o objeto do usuário na sessão atual
                    usuario.fotoUrl = dados.fotoUrl;
                    usuario.foto_perfil = dados.fotoUrl;
                    localStorage.setItem(chaveSessao, JSON.stringify(usuario));
                }

                alert("Foto de perfil atualizada com sucesso!");

            } catch (erro) {
                console.error("Falha no upload:", erro);
                alert("Não foi possível salvar a nova foto de perfil.");
                // Reverte para a foto anterior caso o envio falhe
                imgPerfil.src = fotoAnterior;
            } finally {
                // Libera a memória alocada para o preview temporário
                URL.revokeObjectURL(previewUrl);
            }
        });
    }
});