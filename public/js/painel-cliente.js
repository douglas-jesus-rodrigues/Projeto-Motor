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
        if (usuario.fotoUrl) {
            imgPerfil.src = usuario.fotoUrl;
        } else if (usuario.nome) {
            // Se não tiver foto, gera as iniciais personalizadas com o seu nome
            imgPerfil.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.nome)}&background=181824&color=ff1e27&size=150`;
        }
    }

    // =========================================================================
    // 4. GERENCIAMENTO DE UPLOAD DA FOTO DE PERFIL (VIA BACKEND / API)
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
            formData.append("fotoPerfil", arquivo);
            formData.append("usuarioId", usuario.id || usuario._id); // Envia a identificação do usuário

            try {
                // Obtenha o token caso sua rota exija autenticação
                const token = localStorage.getItem("token") || sessionStorage.getItem("token");

                const resposta = await fetch("/api/usuarios/upload-foto", {
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