document.addEventListener("DOMContentLoaded", async () => {
    const chaveSessao = localStorage.getItem("usuario") ? "usuario" : "usuario_logado";
    const usuarioSalvo = localStorage.getItem(chaveSessao) || sessionStorage.getItem("usuario_logado");
    
    if (!usuarioSalvo) {
        window.location.href = "/pages/login.html";
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const veiculoId = urlParams.get('id');

    if (!veiculoId) {
        mostrarNotificacao("ID do veículo não encontrado!", "erro");
        setTimeout(() => window.location.href = "/pages/meus-anuncios.html", 2000);
        return;
    }

    await carregarOpcoesDoBanco();
    await carregarInformacoesDoCarro(veiculoId);

    inicializarMascaraPreco();
    inicializarMascaraAnos();
    inicializarValidacoesVisuais();

    const form = document.getElementById('form-editar-anuncio');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            salvarAlteracoesDoCarro(veiculoId);
        });
    }
});

async function carregarOpcoesDoBanco() {
    try {
        const resCombustivel = await fetch('/api/combustiveis');
        const selectCombustivel = document.getElementById('combustivel');
        if (resCombustivel.ok) {
            const combustiveis = await resCombustivel.json();
            if (selectCombustivel) {
                selectCombustivel.innerHTML = '<option value="">Selecione o combustível...</option>';
                combustiveis.forEach(comb => {
                    const opt = document.createElement('option');
                    opt.value = comb.id;
                    opt.textContent = comb.nome;
                    selectCombustivel.appendChild(opt);
                });
            }
        }

        const resCambio = await fetch('/api/cambios');
        const selectCambio = document.getElementById('cambio');
        if (resCambio.ok) {
            const cambios = await resCambio.json();
            if (selectCambio) {
                selectCambio.innerHTML = '<option value="">Selecione o câmbio...</option>';
                cambios.forEach(cambio => {
                    const opt = document.createElement('option');
                    opt.value = cambio.id;
                    opt.textContent = cambio.nome;
                    selectCambio.appendChild(opt);
                });
            }
        }
    } catch (erro) {
        console.error("Erro ao carregar opções:", erro);
    }
}

async function carregarInformacoesDoCarro(id) {
    try {
        const resposta = await fetch(`/api/veiculos/${id}`);
        const data = await resposta.json();
        const veiculo = data.veiculo || data;

        if (veiculo) {
            document.getElementById('veiculo-id').value = veiculo.id || id;
            atribuirValorSeExistir('marca', veiculo.marca || veiculo.marca_nome);
            atribuirValorSeExistir('modelo', veiculo.modelo || veiculo.modelo_nome);
            atribuirValorSeExistir('versao', veiculo.versao);
            atribuirValorSeExistir('ano_fabricacao', veiculo.ano_fabricacao || veiculo.ano);
            atribuirValorSeExistir('ano_modelo', veiculo.ano_modelo);
            atribuirValorSeExistir('quilometragem', veiculo.quilometragem);
            
            if (veiculo.preco) {
                const inputPreco = document.getElementById('preco');
                if (inputPreco) {
                    // MODIFICADO: Formata o preço vindo do banco sem as casas decimais
                    inputPreco.value = Number(veiculo.preco).toLocaleString('pt-BR', { 
                        minimumFractionDigits: 0, 
                        maximumFractionDigits: 0 
                    });
                }
            }
            
            atribuirValorSeExistir('combustivel', veiculo.combustivel || veiculo.tipo_combustivel_id);
            atribuirValorSeExistir('cambio', veiculo.cambio || veiculo.tipo_transmissao_id);

            dispararValidacaoPreenchidos();
        } else {
            mostrarNotificacao("Veículo não encontrado.", "erro");
            setTimeout(() => window.location.href = "/pages/meus-anuncios.html", 2000);
        }
    } catch (erro) {
        console.error("Erro ao carregar veículo:", erro);
    }
}

// ==========================================
// FUNÇÃO DE AJUSTE DOS BOTÕES (+ / -)
// ==========================================
function ajustarValor(idDoCampo, passo, valorMinimo = 0) {
    const input = document.getElementById(idDoCampo);
    if (!input) return;

    let valorAtual = parseInt(input.value.replace(/\D/g, "")) || (valorMinimo === 1900 ? 2024 : 0);
    let novoValor = valorAtual + passo;
    if (novoValor < valorMinimo) novoValor = valorMinimo;

    input.value = novoValor;
    input.dispatchEvent(new Event('input'));
}

// MODIFICADO: Máscara ajustada para lidar apenas com números inteiros
function inicializarMascaraPreco() {
    const inputPreco = document.getElementById('preco');
    if (!inputPreco) return;

    inputPreco.addEventListener('input', (e) => {
        // Remove tudo o que não for dígito
        let valor = e.target.value.replace(/\D/g, "");
        
        if (valor === "") { 
            e.target.value = ""; 
            return; 
        }
        
        // Remove zeros à esquerda adicionais (ex: "0150" -> "150")
        valor = parseInt(valor, 10).toString();

        // Adiciona apenas o ponto de milhar a cada 3 dígitos
        e.target.value = valor.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    });
}

function inicializarMascaraAnos() {
    ['ano_fabricacao', 'ano_modelo'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
            });
        }
    });
}

async function salvarAlteracoesDoCarro(id) {
    const precoInput = document.getElementById('preco')?.value;
    const btnSalvar = document.querySelector('.btn-primario');

    let precoLimpo = null;
    if (precoInput) {
        // MODIFICADO: Como não temos mais vírgula (centavos), removemos apenas os pontos de formatação
        precoLimpo = Number(precoInput.replace(/\./g, ''));
    }
    
    if (btnSalvar) {
        btnSalvar.innerHTML = `<span>Salvando...</span>`;
        btnSalvar.disabled = true;
    }

    const dadosModificados = {
        marca: document.getElementById('marca')?.value.trim() || '',
        modelo: document.getElementById('modelo')?.value.trim() || '',
        versao: document.getElementById('versao')?.value.trim() || '',
        ano_fabricacao: document.getElementById('ano_fabricacao')?.value || '',
        ano_modelo: document.getElementById('ano_modelo')?.value || '',
        quilometragem: document.getElementById('quilometragem')?.value || 0,
        preco: !isNaN(precoLimpo) ? precoLimpo : null,
        combustivel: document.getElementById('combustivel')?.value || '',
        cambio: document.getElementById('cambio')?.value || ''
    };

    try {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        const resposta = await fetch(`/api/veiculos/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(token && { "Authorization": `Bearer ${token}` })
            },
            body: JSON.stringify(dadosModificados)
        });

        const resultado = await resposta.json();

        if (resposta.ok || resultado.sucesso) {
            mostrarNotificacao("✨ Anúncio atualizado com sucesso!", "sucesso");
            setTimeout(() => window.location.href = "/pages/meus-anuncios.html", 1400);
        } else {
            mostrarNotificacao(resultado.mensagem || "Erro ao atualizar.", "erro");
            resetarBotaoSalvar(btnSalvar);
        }
    } catch (erro) {
        console.error("Erro:", erro);
        mostrarNotificacao("Erro de conexão.", "erro");
        resetarBotaoSalvar(btnSalvar);
    }
}

function resetarBotaoSalvar(btn) {
    if (btn) {
        btn.innerHTML = `<span>Salvar Alterações</span>`;
        btn.disabled = false;
    }
}

function atribuirValorSeExistir(idDoElemento, valor) {
    const elemento = document.getElementById(idDoElemento);
    if (elemento && valor !== undefined && valor !== null) {
        elemento.value = valor;
    }
}

function inicializarValidacoesVisuais() {
    document.querySelectorAll('input, select').forEach(campo => {
        campo.addEventListener('input', () => {
            if (campo.value.trim() !== '') campo.classList.add('preenchido');
            else campo.classList.remove('preenchido');
        });
    });
}

function dispararValidacaoPreenchidos() {
    document.querySelectorAll('input, select').forEach(campo => {
        if (campo.value.trim() !== '') campo.classList.add('preenchido');
    });
}

function mostrarNotificacao(mensagem, tipo = 'sucesso') {
    const toastAntigo = document.querySelector('.toast-notificacao');
    if (toastAntigo) toastAntigo.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notificacao ${tipo}`;
    toast.textContent = mensagem;
    
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.right = '30px';
    toast.style.backgroundColor = tipo === 'sucesso' ? '#16a34a' : '#e50914';
    toast.style.color = '#fff';
    toast.style.padding = '14px 24px';
    toast.style.borderRadius = '10px';
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
    toast.style.zIndex = '99999';
    toast.style.fontWeight = '600';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';

    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }, 10);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 350);
    }, 3200);
}