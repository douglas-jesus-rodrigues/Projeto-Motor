document.addEventListener("DOMContentLoaded", () => {
    // 1. Recupera os dados do usuário salvos no navegador no momento do login (Com Try/Catch seguro)
    const chaveSessao = localStorage.getItem("usuario") ? "usuario" : "usuario_logado";
    const usuarioSalvo = localStorage.getItem(chaveSessao) || sessionStorage.getItem("usuario") || sessionStorage.getItem("usuario_logado");
    
    if (!usuarioSalvo) {
        window.location.href = "/pages/login.html";
        return;
    }

    let usuario;
    try {
        usuario = JSON.parse(usuarioSalvo);
    } catch (e) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/pages/login.html";
        return;
    }

    // 2. Preenche o Nome do Usuário de forma segura
    const elNome = document.getElementById("nomeUsuario");
    if (elNome && usuario.nome) {
        elNome.textContent = usuario.nome;
    }

    // Elementos da foto
    const imgPerfil = document.getElementById("imgPerfil");
    const btnRemoverFoto = document.getElementById("btnRemoverFoto");

    // Função para atualizar a visibilidade do botão de remover
    function atualizarVisibilidadeBotaoRemover(temFotoPersonalizada) {
        if (btnRemoverFoto) {
            btnRemoverFoto.style.display = temFotoPersonalizada ? "flex" : "none";
        }
    }

    // 3. Preenche a Foto de Perfil inicial (Verifica fotoUrl ou foto_perfil do banco)
    if (imgPerfil) {
        const fotoAtual = usuario.fotoUrl || usuario.foto_perfil;
        if (fotoAtual) {
            imgPerfil.src = fotoAtual;
            atualizarVisibilidadeBotaoRemover(true);
        } else if (usuario.nome) {
            imgPerfil.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.nome)}&background=181824&color=ff1e27&size=150`;
            atualizarVisibilidadeBotaoRemover(false);
        }
    }

    // Função auxiliar para exibir notificações elegantes (Toast)
    function mostrarNotificacao(mensagem, tipo = 'sucesso') {
        const toastAntigo = document.querySelector('.toast-notificacao');
        if (toastAntigo) toastAntigo.remove();

        const toast = document.createElement('div');
        toast.className = `toast-notificacao ${tipo}`;
        toast.textContent = mensagem;
        
        toast.style.position = 'fixed';
        toast.style.bottom = '30px';
        toast.style.right = '30px';
        toast.style.backgroundColor = tipo === 'sucesso' ? '#1b873f' : '#e50914';
        toast.style.color = '#fff';
        toast.style.padding = '14px 22px';
        toast.style.borderRadius = '12px';
        toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        toast.style.zIndex = '9999';
        toast.style.fontSize = '0.95rem';
        toast.style.fontWeight = '600';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // Função customizada para confirmar a remoção da foto
    function abrirModalConfirmacaoFoto(onConfirm) {
        const modalAntigo = document.getElementById('modalCustomFoto');
        if (modalAntigo) modalAntigo.remove();

        const overlay = document.createElement('div');
        overlay.id = 'modalCustomFoto';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
        overlay.style.backdropFilter = 'blur(4px)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s ease';

        const caixa = document.createElement('div');
        caixa.style.background = '#141414';
        caixa.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        caixa.style.padding = '35px 30px';
        caixa.style.borderRadius = '22px';
        caixa.style.boxShadow = '0 15px 40px rgba(0, 0, 0, 0.6)';
        caixa.style.maxWidth = '400px';
        caixa.style.width = '90%';
        caixa.style.textAlign = 'center';
        caixa.style.transform = 'scale(0.8)';
        caixa.style.transition = 'transform 0.3s ease';

        caixa.innerHTML = `
            <div style="font-size: 2.5rem; margin-bottom: 15px;">🗑️</div>
            <h3 style="font-size: 1.3rem; color: #fff; margin-bottom: 10px;">Remover foto de perfil?</h3>
            <p style="color: #b3b3b3; font-size: 0.95rem; margin-bottom: 25px; line-height: 1.5;">
                Sua foto atual será apagada e substituída pelo seu avatar padrão com as iniciais.
            </p>
            <div style="display: flex; justify-content: center; gap: 15px;">
                <button id="btnNaoRemover" style="padding: 12px 24px; border: 1px solid #333; background: #222; color: #fff; border-radius: 10px; font-weight: bold; cursor: pointer; flex: 1;">Cancelar</button>
                <button id="btnSimRemover" style="padding: 12px 24px; border: none; background: #e50914; color: #fff; border-radius: 10px; font-weight: bold; cursor: pointer; flex: 1; box-shadow: 0 4px 12px rgba(229,9,20,0.3);">Sim, remover</button>
            </div>
        `;

        overlay.appendChild(caixa);
        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.style.opacity = '1';
            caixa.style.transform = 'scale(1)';
        }, 10);

        const fecharModal = () => {
            overlay.style.opacity = '0';
            caixa.style.transform = 'scale(0.8)';
            setTimeout(() => overlay.remove(), 300);
        };

        document.getElementById('btnNaoRemover').addEventListener('click', fecharModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) fecharModal();
        });

        document.getElementById('btnSimRemover').addEventListener('click', () => {
            fecharModal();
            onConfirm();
        });
    }

    // =========================================================================
    // 4. GERENCIAMENTO DO MENU DROPDOWN DE CONFIGURAÇÕES
    // =========================================================================
    const btnConfig = document.getElementById('btnConfig');
    const menuConfig = document.getElementById('menuConfig');

    if (btnConfig && menuConfig) {
        btnConfig.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menuConfig.classList.toggle('mostrar');
            btnConfig.setAttribute('aria-expanded', isOpen);
        });

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
        modalSairContainer.addEventListener('click', (e) => {
            if (e.target === modalSairContainer) {
                modalSairContainer.classList.remove('mostrar-modal');
            }
        });
    }

    if (btnSair) {
        btnSair.addEventListener('click', () => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "/pages/login.html";
        });
    }

    // =========================================================================
    // 6. GERENCIAMENTO DE UPLOAD COM RECORTE ESTILO WHATSAPP (CROPPER.JS)
    // =========================================================================
    const inputFoto = document.getElementById("inputFotoPerfil");
    const modalRecorte = document.getElementById("modalRecorte");
    const imagemParaCortar = document.getElementById("imagemParaCortar");
    const btnCancelarRecorte = document.getElementById("btnCancelarRecorte");
    const btnConfirmarRecorte = document.getElementById("btnConfirmarRecorte");
    
    let cropper = null;

    if (inputFoto && imgPerfil) {
        inputFoto.addEventListener("change", (e) => {
            const arquivo = e.target.files[0];
            if (!arquivo) return;

            // Validação rigorosa de MIME-type (Segurança contra arquivos maliciosos)
            const tiposPermitidos = ["image/jpeg", "image/png", "image/webp"];
            if (!tiposPermitidos.includes(arquivo.type)) {
                mostrarNotificacao("Por favor, selecione uma imagem válida (JPEG, PNG ou WEBP).", "erro");
                inputFoto.value = "";
                return;
            }

            const tamanhoMaximo = 5 * 1024 * 1024;
            if (arquivo.size > tamanhoMaximo) {
                mostrarNotificacao("A foto selecionada deve ter no máximo 5MB.", "erro");
                inputFoto.value = "";
                return;
            }

            const reader = new FileReader();
            reader.onload = (eventoLeitura) => {
                imagemParaCortar.src = eventoLeitura.target.result;
                modalRecorte.style.display = "flex";

                if (cropper) {
                    cropper.destroy();
                }
                
                cropper = new Cropper(imagemParaCortar, {
                    aspectRatio: 1,
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 0.8,
                    restore: false,
                    guides: true,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                    minCropBoxWidth: 120, 
                    minCropBoxHeight: 120, 
                    maxCropBoxWidth: 500, 
                    maxCropBoxHeight: 500, 
                });
            };
            reader.readAsDataURL(arquivo);
        });

        // Botão Cancelar Recorte
        if (btnCancelarRecorte) {
            btnCancelarRecorte.addEventListener("click", () => {
                modalRecorte.style.display = "none";
                if (cropper) cropper.destroy();
                inputFoto.value = "";
            });
        }

        // Botão Confirmar Recorte (Com Proteção contra Cliques Duplos / Race Conditions)
        if (btnConfirmarRecorte) {
            btnConfirmarRecorte.addEventListener("click", () => {
                if (!cropper) return;

                // Desativa o botão temporariamente para evitar cliques duplos
                btnConfirmarRecorte.disabled = true;
                const textoOriginalBotao = btnConfirmarRecorte.textContent;
                btnConfirmarRecorte.textContent = "A salvar...";

                cropper.getCroppedCanvas({
                    width: 400,
                    height: 400,
                }).toBlob(async (blob) => {
                    modalRecorte.style.display = "none";
                    
                    const arquivoCortado = new File([blob], "foto-perfil.png", { type: "image/png" });
                    const previewUrl = URL.createObjectURL(arquivoCortado);
                    const fotoAnterior = imgPerfil.src;
                    imgPerfil.src = previewUrl;

                    const formData = new FormData();
                    formData.append("fotoPerfil", arquivoCortado);
                    formData.append("usuarioId", usuario.id || usuario._id);

                    try {
                        const token = localStorage.getItem("token") || sessionStorage.getItem("token");

                        const resposta = await fetch("/api/perfil/upload-foto", {
                            method: "POST",
                            headers: {
                                ...(token && { "Authorization": `Bearer ${token}` })
                            },
                            body: formData
                        });

                        if (!resposta.ok) {
                            const erroDados = await resposta.json().catch(() => ({}));
                            throw new Error(erroDados.mensagem || "Erro no servidor ao tentar salvar a imagem.");
                        }

                        const dados = await resposta.json();
                        const novaUrlFoto = dados.fotoUrl || dados.foto_perfil;

                        if (novaUrlFoto) {
                            imgPerfil.src = novaUrlFoto;
                            usuario.fotoUrl = novaUrlFoto;
                            usuario.foto_perfil = novaUrlFoto;
                            localStorage.setItem(chaveSessao, JSON.stringify(usuario));
                            
                            atualizarVisibilidadeBotaoRemover(true);
                        }

                        mostrarNotificacao("✨ Foto de perfil atualizada com sucesso!");

                    } catch (erro) {
                        console.error("Falha no upload:", erro);
                        mostrarNotificacao(erro.message || "Não foi possível salvar a nova foto de perfil.", "erro");
                        imgPerfil.src = fotoAnterior;
                    } finally {
                        URL.revokeObjectURL(previewUrl);
                        if (cropper) cropper.destroy();
                        inputFoto.value = "";
                        // Restaura o botão
                        btnConfirmarRecorte.disabled = false;
                        btnConfirmarRecorte.textContent = textoOriginalBotao;
                    }
                }, "image/png");
            });
        }
    }

    // =========================================================================
    // 7. GERENCIAMENTO DE REMOÇÃO DA FOTO DE PERFIL
    // =========================================================================
    if (btnRemoverFoto) {
        btnRemoverFoto.addEventListener("click", () => {
            abrirModalConfirmacaoFoto(async () => {
                try {
                    const token = localStorage.getItem("token") || sessionStorage.getItem("token");

                    const resposta = await fetch("/api/perfil/remover-foto", {
                        method: "DELETE",
                        headers: {
                            "Content-Type": "application/json",
                            ...(token && { "Authorization": `Bearer ${token}` })
                        },
                        body: JSON.stringify({ usuarioId: usuario.id || usuario._id })
                    });

                    const dados = await resposta.json();

                    if (!resposta.ok) {
                        throw new Error(dados.mensagem || "Não foi possível remover a foto no servidor.");
                    }

                    if (dados.sucesso !== false) {
                        const avatarPadrao = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.nome || "Cliente")}&background=181824&color=ff1e27&size=150`;
                        
                        if (imgPerfil) {
                            imgPerfil.src = avatarPadrao;
                        }
                        
                        usuario.fotoUrl = null;
                        usuario.foto_perfil = null;
                        localStorage.setItem(chaveSessao, JSON.stringify(usuario));

                        atualizarVisibilidadeBotaoRemover(false);
                        mostrarNotificacao("🗑️ Foto de perfil removida com sucesso!");
                    } else {
                        mostrarNotificacao(dados.mensagem || "Não foi possível remover a foto.", "erro");
                    }

                } catch (erro) {
                    console.error("Erro ao remover foto:", erro);
                    mostrarNotificacao(erro.message || "Erro de conexão ao tentar remover a foto.", "erro");
                }
            });
        });
    }
});