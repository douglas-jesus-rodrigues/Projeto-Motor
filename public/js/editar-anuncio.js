document.addEventListener("DOMContentLoaded", () => {
    // 1. Verificação de segurança: garante que o usuário está logado
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    if (!usuario) {
        window.location.href = "/pages/login.html";
        return;
    }

    // 2. Pega o ID do veículo passado na URL
    const urlParams = new URLSearchParams(window.location.search);
    const veiculoId = urlParams.get('id');

    if (!veiculoId) {
        alert("ID do veículo não foi encontrado na URL!");
        window.location.href = "/pages/meus-anuncios.html";
        return;
    }

    // 3. Busca as informações reais do carro no banco de dados e preenche o formulário
    carregarInformacoesDoCarro(veiculoId);

    // 4. Configura o formulário para enviar as alterações quando clicar em atualizar
    const form = document.getElementById('form-editar-anuncio');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            salvarAlteracoesDoCarro(veiculoId);
        });
    }
});

// Função responsável por buscar os dados no back-end e preencher os inputs
async function carregarInformacoesDoCarro(id) {
    try {
        const resposta = await fetch(`/api/veiculos/${id}`);
        const data = await resposta.json();
        const veiculo = data.veiculo || data;

        if (veiculo) {
            const inputId = document.getElementById('veiculo-id');
            if (inputId) inputId.value = veiculo.id || id;
            
            atribuirValorSeExistir('marca', veiculo.marca || veiculo.marca_nome);
            atribuirValorSeExistir('modelo', veiculo.modelo || veiculo.modelo_nome);
            atribuirValorSeExistir('versao', veiculo.versao);
            atribuirValorSeExistir('ano_fabricacao', veiculo.ano_fabricacao || veiculo.ano);
            atribuirValorSeExistir('ano_modelo', veiculo.ano_modelo);
            atribuirValorSeExistir('quilometragem', veiculo.quilometragem);
            atribuirValorSeExistir('preco', veiculo.preco);
            atribuirValorSeExistir('combustivel', veiculo.combustivel || veiculo.tipo_combustivel_id);
            atribuirValorSeExistir('cambio', veiculo.cambio || veiculo.tipo_transmissao_id);
            atribuirValorSeExistir('cor', veiculo.cor);
            atribuirValorSeExistir('portas', veiculo.portas);
            atribuirValorSeExistir('carroceria', veiculo.carroceria);
            atribuirValorSeExistir('descricao', veiculo.descricao);

        } else {
            alert("Veículo não encontrado no banco de dados.");
            window.location.href = "/pages/meus-anuncios.html";
        }
    } catch (erro) {
        console.error("Erro ao buscar dados do veículo:", erro);
        alert("Erro de conexão ao tentar carregar as informações do veículo.");
    }
}

function atribuirValorSeExistir(idDoElemento, valor) {
    const elemento = document.getElementById(idDoElemento);
    if (elemento) {
        elemento.value = valor !== undefined && valor !== null ? valor : '';
    }
}

async function salvarAlteracoesDoCarro(id) {
    const precoInput = document.getElementById('preco')?.value;

    // Limpeza rigorosa do preço (remove "R$", pontos de milhar e troca vírgula por ponto decimal)
    const precoLimpo = precoInput ? precoInput.toString().replace('R$', '').trim().replace(/\./g, '').replace(',', '.') : '';

    const dadosModificados = {
        marca: document.getElementById('marca')?.value || '',
        modelo: document.getElementById('modelo')?.value || '',
        versao: document.getElementById('versao')?.value || '',
        ano_fabricacao: document.getElementById('ano_fabricacao')?.value || '',
        ano_modelo: document.getElementById('ano_modelo')?.value || '',
        quilometragem: document.getElementById('quilometragem')?.value || 0,
        // Envia o número limpo ou null se estiver vazio
        preco: precoLimpo !== '' ? Number(precoLimpo) : null,
        combustivel: document.getElementById('combustivel')?.value || '',
        cambio: document.getElementById('cambio')?.value || '',
        cor: document.getElementById('cor')?.value || '',
        portas: document.getElementById('portas')?.value || '',
        carroceria: document.getElementById('carroceria')?.value || '',
        descricao: document.getElementById('descricao')?.value || ''
    };

    try {
        const resposta = await fetch(`/api/veiculos/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dadosModificados)
        });

        const resultado = await resposta.json();

        if (resposta.ok || resultado.sucesso) {
            alert("Anúncio atualizado com sucesso!");
            window.location.href = "/pages/meus-anuncios.html";
        } else {
            alert(resultado.mensagem || "Erro ao atualizar o anúncio.");
        }
    } catch (erro) {
        console.error("Erro ao enviar atualizações:", erro);
        alert("Erro de conexão com o servidor ao salvar.");
    }
}