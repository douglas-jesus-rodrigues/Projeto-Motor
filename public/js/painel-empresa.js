document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // 1. AUTENTICAÇÃO E SESSÃO
    // ==========================================
    const chaveSessao = localStorage.getItem("usuario") ? "usuario" : "usuario_logado";
    const usuarioSalvo = localStorage.getItem(chaveSessao) || sessionStorage.getItem("usuario") || sessionStorage.getItem("usuario_logado");
    
    if (!usuarioSalvo) {
        window.location.href = "/pages/login.html";
        return;
    }

    const usuario = JSON.parse(usuarioSalvo);

    if (usuario.tipo !== "empresa" && usuario.tipo !== "admin") {
        window.location.href = "/pages/painel-cliente.html";
        return;
    }

    // ==========================================
    // 2. ELEMENTOS PRINCIPAIS E DADOS DA EMPRESA
    // ==========================================
    const elNome = document.getElementById("nomeUsuario");
    if (elNome && usuario.nome) {
        elNome.textContent = usuario.nome;
    }

    const nomeEmpresa = document.getElementById("nomeEmpresa");
    if (nomeEmpresa) {
        nomeEmpresa.textContent = usuario?.empresa?.nome_empresa || usuario?.nome_empresa || "Empresa";
    }

    // Preenchendo dados pessoais e da empresa nas respectivas seções
    preencherTexto("dadoNome", usuario?.nome);
    preencherTexto("dadoSobrenome", usuario?.sobrenome);
    preencherTexto("dadoEmail", usuario?.email);
    preencherTexto("dadoTelefone", usuario?.telefone);
    preencherTexto("dadoCpf", usuario?.cpf);
    preencherTexto("dadoTipo", usuario?.tipo);

    preencherTexto("dadoEmpresa", usuario?.empresa?.nome_empresa);
    preencherTexto("dadoCnpj", usuario?.empresa?.cnpj);
    preencherTexto("dadoRazaoSocial", usuario?.empresa?.razao_social);
    preencherTexto("dadoInscricao", usuario?.empresa?.inscricao_estadual);
    preencherTexto("dadoSite", usuario?.empresa?.site);

    // ==========================================
    // 3. FOTO DE PERFIL E INTERAÇÃO DOS BOTÕES/ZOOM
    // ==========================================
    const imgPerfil = document.getElementById("fotoPerfilPreview") || document.getElementById("imgPerfil");
    const btnRemoverFoto = document.getElementById("btnRemoverFoto");
    const inputFoto = document.getElementById("inputFotoPerfil");
    const avatarWrapper = document.getElementById("avatarWrapper");

    function atualizarEstadoFoto(temFotoPersonalizada) {
        if (btnRemoverFoto) {
            btnRemoverFoto.style.display = temFotoPersonalizada ? "flex" : "none";
        }
    }

    if (imgPerfil) {
        const fotoAtual = usuario.fotoUrl || usuario.foto_perfil;
        if (fotoAtual) {
            imgPerfil.src = fotoAtual;
            atualizarEstadoFoto(true);
        } else if (usuario.nome) {
            imgPerfil.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.nome)}&background=181824&color=ff1e27&size=150`;
            atualizarEstadoFoto(false);
        }
    }

    // Clicar na área do avatar (bolinha ou ícone de câmera) abre o seletor para TROCAR a foto
    if (avatarWrapper && inputFoto) {
        avatarWrapper.addEventListener("click", (e) => {
            // Se clicar na lixeira, o evento próprio dela cuida da remoção
            if (e.target.closest("#btnRemoverFoto")) return;
            inputFoto.click();
        });
    }

    // ==========================================
    // SISTEMA DE NOTIFICAÇÕES (TOAST)
    // ==========================================
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

    // Modal de Confirmação de Remoção de Foto
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

    // ==========================================
    // 3.1. MODAL DE VISUALIZAÇÃO DA FOTO (DUPLO CLIQUE PARA ZOOM)
    // ==========================================
    if (imgPerfil) {
        imgPerfil.title = "Clique na câmera para alterar. Dê duplo clique para ampliar a foto.";

        imgPerfil.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            const urlFotoAtual = imgPerfil.src;
            if (!urlFotoAtual) return;

            const modalZoom = document.createElement('div');
            modalZoom.style.position = 'fixed';
            modalZoom.style.top = '0';
            modalZoom.style.left = '0';
            modalZoom.style.width = '100%';
            modalZoom.style.height = '100%';
            modalZoom.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
            modalZoom.style.backdropFilter = 'blur(6px)';
            modalZoom.style.zIndex = '99999';
            modalZoom.style.display = 'flex';
            modalZoom.style.justifyContent = 'center';
            modalZoom.style.alignItems = 'center';
            modalZoom.style.opacity = '0';
            modalZoom.style.transition = 'opacity 0.3s ease';

            modalZoom.innerHTML = `
                <div style="position: relative; max-width: 90%; max-height: 90%; text-align: center;">
                    <button id="fecharZoom" style="position: absolute; top: -45px; right: 0; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer; font-weight: bold;">&times;</button>
                    <img src="${urlFotoAtual}" style="max-width: 100%; max-height: 80vh; border-radius: 50%; box-shadow: 0 20px 50px rgba(0,0,0,0.8); object-fit: cover; width: 300px; height: 300px; transform: scale(0.9); transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
                </div>
            `;

            document.body.appendChild(modalZoom);

            const imgConteudo = modalZoom.querySelector('img');
            setTimeout(() => {
                modalZoom.style.opacity = '1';
                imgConteudo.style.transform = 'scale(1)';
            }, 10);

            const fecharModalZoom = () => {
                modalZoom.style.opacity = '0';
                imgConteudo.style.transform = 'scale(0.9)';
                setTimeout(() => modalZoom.remove(), 300);
            };

            modalZoom.querySelector('#fecharZoom').addEventListener('click', fecharModalZoom);
            modalZoom.addEventListener('click', (ev) => {
                if (ev.target === modalZoom) fecharModalZoom();
            });
            document.addEventListener('keydown', function escListener(ev) {
                if (ev.key === 'Escape') {
                    fecharModalZoom();
                    document.removeEventListener('keydown', escListener);
                }
            });
        });
    }

    // ==========================================
    // 4. MENU SPA (TROCA DE ABAS)
    // ==========================================
    const linksMenu = document.querySelectorAll("[data-section]");
    const secoes = document.querySelectorAll(".secao");

    linksMenu.forEach((link) => {
        link.addEventListener("click", (event) => {
            if (!link.hasAttribute("data-section")) return;

            event.preventDefault();

            linksMenu.forEach((item) => item.classList.remove("ativo"));
            link.classList.add("ativo");

            const secaoEscolhida = link.dataset.section;

            secoes.forEach((secao) => {
                secao.classList.remove("ativa");
            });

            const secaoAtual = document.getElementById(`${secaoEscolhida}Section`);
            if (secaoAtual) {
                secaoAtual.classList.add("ativa");
            }
        });
    });

    // ==========================================
    // 5. MODAL E FLUXO DE SAÍDA (LOGOUT)
    // ==========================================
    const linkAbrirModalSair = document.getElementById('linkAbrirModalSair') || document.getElementById('btnSair');
    const modalSairContainer = document.getElementById('modalSairContainer');
    const btnCancelarSair = document.getElementById('btnCancelarSair');
    const btnConfirmarSair = document.getElementById('btnSair');

    if (linkAbrirModalSair && modalSairContainer) {
        linkAbrirModalSair.addEventListener('click', (e) => {
            e.preventDefault();
            modalSairContainer.style.display = 'flex';
        });
    }

    if (btnCancelarSair && modalSairContainer) {
        btnCancelarSair.addEventListener('click', () => {
            modalSairContainer.style.display = 'none';
        });
    }

    if (modalSairContainer) {
        modalSairContainer.addEventListener('click', (e) => {
            if (e.target === modalSairContainer) {
                modalSairContainer.style.display = 'none';
            }
        });
    }

    // ==========================================
    // 6. UPLOAD E RECORTE DE FOTO (CROPPER.JS CIRCULAR)
    // ==========================================
    const modalRecorte = document.getElementById("modalRecorte");
    const imagemParaCortar = document.getElementById("imagemParaCortar");
    const btnCancelarRecorte = document.getElementById("btnCancelarRecorte");
    const btnConfirmarRecorte = document.getElementById("btnConfirmarRecorte");
    
    let cropper = null;

    if (inputFoto && imgPerfil && modalRecorte) {
        inputFoto.addEventListener("change", (e) => {
            const arquivo = e.target.files[0];
            if (!arquivo) return;

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
                    guides: false,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                    minCropBoxWidth: 100, 
                    minCropBoxHeight: 100, 
                });
            };
            reader.readAsDataURL(arquivo);
        });

        if (btnCancelarRecorte) {
            btnCancelarRecorte.addEventListener("click", () => {
                modalRecorte.style.display = "none";
                if (cropper) cropper.destroy();
                inputFoto.value = "";
            });
        }

        if (btnConfirmarRecorte) {
            btnConfirmarRecorte.addEventListener("click", () => {
                if (!cropper) return;

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
                            
                            atualizarEstadoFoto(true);
                        }

                        notificarSucessoFoto();

                    } catch (erro) {
                        console.error("Falha no upload:", erro);
                        mostrarNotificacao(erro.message || "Não foi possível salvar a nova foto de perfil.", "erro");
                        imgPerfil.src = fotoAnterior;
                    } finally {
                        URL.revokeObjectURL(previewUrl);
                        if (cropper) cropper.destroy();
                        inputFoto.value = "";
                    }
                }, "image/png");
            });
        }
    }

    function notificarSucessoFoto() {
        mostrarNotificacao("✨ Foto de perfil atualizada com sucesso!");
    }

    if (btnRemoverFoto) {
        btnRemoverFoto.addEventListener("click", (e) => {
            e.stopPropagation();
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
                        const avatarPadrao = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.nome || "Empresa")}&background=181824&color=ff1e27&size=150`;
                        
                        if (imgPerfil) {
                            imgPerfil.src = avatarPadrao;
                        }
                        
                        usuario.fotoUrl = null;
                        usuario.foto_perfil = null;
                        localStorage.setItem(chaveSessao, JSON.stringify(usuario));

                        atualizarEstadoFoto(false);
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

    // ==========================================
    // 7. CARREGAR E GERENCIAR VEÍCULOS DA EMPRESA
    // ==========================================
    const listaVeiculos = document.getElementById("listaVeiculos");
    const totalVeiculos = document.getElementById("totalVeiculos");
    const totalPropostas = document.getElementById("totalPropostas");
    const totalConversas = document.getElementById("totalConversas");
    const totalVisualizacoes = document.getElementById("totalVisualizacoes");

    async function carregarVeiculos() {
        try {
            if (listaVeiculos) {
                listaVeiculos.innerHTML = `<p class="vazio">Carregando veículos...</p>`;
            }

            const resposta = await fetch("/api/veiculos");
            const data = await resposta.json();

            if (!data.sucesso) {
                if (listaVeiculos) listaVeiculos.innerHTML = `<p class="vazio">Erro ao buscar veículos.</p>`;
                return;
            }

            const meusVeiculos = data.veiculos.filter((veiculo) => {
                return Number(veiculo.usuario_id) === Number(usuario.id || usuario._id);
            });

            if (totalVeiculos) totalVeiculos.textContent = meusVeiculos.length;
            if (totalPropostas) totalPropostas.textContent = "0";
            if (totalConversas) totalConversas.textContent = "0";
            if (totalVisualizacoes) totalVisualizacoes.textContent = "0";

            if (meusVeiculos.length === 0) {
                if (listaVeiculos) {
                    listaVeiculos.innerHTML = `<p class="vazio">Nenhum veículo cadastrado ainda.</p>`;
                }
                return;
            }

            if (listaVeiculos) listaVeiculos.innerHTML = "";

            meusVeiculos.forEach((veiculo) => {
                const card = document.createElement("div");
                card.classList.add("card-veiculo");

                const imagem = veiculo.imagem
                    ? `/uploads/${veiculo.imagem}`
                    : "/imagens/sem-foto.png";

                card.innerHTML = `
                    <div class="imagem-veiculo">
                        <img src="${imagem}" alt="${veiculo.marca} ${veiculo.modelo}" onerror="this.src='/imagens/sem-foto.png'">
                    </div>

                    <div class="info-veiculo">
                        <h4>${veiculo.marca} ${veiculo.modelo}</h4>
                        <p class="ano">${veiculo.ano_modelo || veiculo.ano || "-"}</p>
                        <strong class="preco">${formatarPreco(veiculo.preco)}</strong>
                    </div>

                    <div class="acoes">
                        <button class="btn-editar" type="button" data-id="${veiculo.id}">Editar</button>
                        <button class="btn-excluir" type="button" data-id="${veiculo.id}">Excluir</button>
                    </div>
                `;

                card.querySelector(".btn-excluir").addEventListener("click", () => excluirVeiculo(veiculo.id));
                card.querySelector(".btn-editar").addEventListener("click", () => editarVeiculo(veiculo));

                listaVeiculos.appendChild(card);
            });

        } catch (erro) {
            console.error("Erro ao carregar veículos:", erro);
            if (listaVeiculos) {
                listaVeiculos.innerHTML = `<p class="vazio">Erro de conexão ao carregar veículos.</p>`;
            }
        }
    }

    async function excluirVeiculo(id) {
        if (!confirm("Tem certeza que deseja excluir este veículo permanentemente?")) return;

        try {
            const resposta = await fetch(`/api/veiculos/${id}`, { method: "DELETE" });
            const resultado = await resposta.json();

            if (resultado.sucesso || resposta.ok) {
                mostrarNotificacao("Veículo excluído com sucesso!");
                carregarVeiculos();
            } else {
                mostrarNotificacao(resultado.mensagem || "Erro ao excluir veículo.", "erro");
            }
        } catch (erro) {
            console.error("Erro na exclusão:", erro);
            mostrarNotificacao("Erro de conexão ao tentar excluir.", "erro");
        }
    }

    async function editarVeiculo(veiculo) {
        const novoPreco = prompt(`Digite o novo preço para (${veiculo.marca} ${veiculo.modelo}):`, veiculo.preco);
        if (novoPreco === null) return;

        try {
            const resposta = await fetch(`/api/veiculos/${veiculo.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...veiculo, preco: Number(novoPreco) })
            });
            const resultado = await resposta.json();

            if (resultado.sucesso || resposta.ok) {
                mostrarNotificacao("Preço atualizado com sucesso!");
                carregarVeiculos();
            } else {
                mostrarNotificacao(resultado.mensagem || "Erro ao atualizar veículo.", "erro");
            }
        } catch (erro) {
            console.error("Erro na edição:", erro);
            mostrarNotificacao("Erro de conexão ao tentar atualizar.", "erro");
        }
    }

    // ==========================================
    // 8. FUNÇÕES AUXILIARES
    // ==========================================
    function preencherTexto(id, valor) {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = valor || "-";
        }
    }

    function formatarPreco(valor) {
        if (!valor) return "R$ 0,00";
        return Number(valor).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    // Inicialização dos veículos ao carregar a página
    carregarVeiculos();
});