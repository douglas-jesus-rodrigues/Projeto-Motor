document.addEventListener("DOMContentLoaded", async () => {
    const gridFavoritos = document.getElementById("gridFavoritos");
    const mensagemVazio = document.getElementById("mensagemVazio");

    // Recupera os IDs dos favoritos salvos no localStorage
    const favoritosIds = JSON.parse(localStorage.getItem("favoritos_veiculos")) || [];

    if (favoritosIds.length === 0) {
        if (mensagemVazio) mensagemVazio.textContent = "Você ainda não favoritou nenhum veículo.";
        return;
    }

    try {
        // Busca todos os veículos da API
        const resposta = await fetch('/api/veiculos');
        const dados = await resposta.json();

        if (dados.sucesso && Array.isArray(dados.veiculos)) {
            // Filtra apenas os veículos cujos IDs estão salvos nos favoritos
            const meusFavoritos = dados.veiculos.filter(v => favoritosIds.includes(v.id));

            if (meusFavoritos.length === 0) {
                gridFavoritos.innerHTML = `<p class="mensagem-vazio">Nenhum veículo favorito encontrado no sistema.</p>`;
                return;
            }

            gridFavoritos.innerHTML = "";
            meusFavoritos.forEach(veiculo => {
                const imagemSrc = veiculo.imagem ? `/uploads/${veiculo.imagem}` : '/imagens/sem-foto.jpg';
                const precoFormatado = Number(veiculo.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                const card = document.createElement('div');
                card.style.cssText = 'border: 1px solid #222; border-radius: 8px; overflow: hidden; background: #000; display: flex; flex-direction: column; box-shadow: 0 4px 10px rgba(0,0,0,0.5);';

                card.innerHTML = `
                    <div style="width: 100%; height: 180px; overflow: hidden; background-color: #000;">
                        <img src="${imagemSrc}" alt="${veiculo.modelo_nome || veiculo.modelo}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div style="background-color: #000000; padding: 15px; display: flex; flex-direction: column; flex-grow: 1; justify-content: space-between;">
                        <h3 style="color: #ff0000; font-size: 16px; margin-bottom: 10px; font-weight: bold;">${veiculo.marca_nome || veiculo.marca} ${veiculo.modelo_nome || veiculo.modelo}</h3>
                        <div style="margin-bottom: 8px;">
                            <p style="color: #aaa; font-size: 13px; margin-bottom: 4px;">${veiculo.versao || ''}</p>
                            <p style="color: #888; font-size: 12px; margin-bottom: 4px;">Ano: ${veiculo.ano_fabricacao}/${veiculo.ano_modelo} | ${veiculo.quilometragem || 0} Km</p>
                        </div>
                        <div style="display: flex; align-items: flex-end; justify-content: space-between; margin-top: auto; padding-top: 10px; border-top: 1px solid #1a1a1a;">
                            <div>
                                <span style="font-size: 11px; color: #ff4d4d; display: block; margin-bottom: 2px;">Valor</span>
                                <span style="font-size: 18px; font-weight: 800; color: #ff0000;">${precoFormatado}</span>
                            </div>
                            <a href="/pages/detalhes.html?id=${veiculo.id}" style="background-color: #ff0000; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: bold; text-decoration: none;">Ver Detalhes</a>
                        </div>
                    </div>
                `;
                gridFavoritos.appendChild(card);
            });
        }
    } catch (erro) {
        console.error("Erro ao carregar favoritos:", erro);
        if (mensagemVazio) mensagemVazio.textContent = "Erro de conexão ao tentar carregar os veículos favoritos.";
    }
});