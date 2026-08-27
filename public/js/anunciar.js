// ==========================================
// ELEMENTOS
// ==========================================
const formAnuncio = document.getElementById("formAnuncio");

const marca = document.getElementById("marca");
const modelo = document.getElementById("modelo");
const versao = document.getElementById("versao");

const anoFabricacao = document.getElementById("anoFabricacao");
const anoModelo = document.getElementById("anoModelo");

const preco = document.getElementById("preco");
const quilometragem = document.getElementById("quilometragem");

const combustivel = document.getElementById("combustivel");
const cambio = document.getElementById("cambio");

const cor = document.getElementById("cor");
const portas = document.getElementById("portas");
const carroceria = document.getElementById("carroceria");

const descricao = document.getElementById("descricao");

const imagem = document.getElementById("imagem");

const btnAnunciar = document.getElementById("btnAnunciar");
const btnPainel = document.getElementById("btnPainel");

// ==========================================
// ERROS
// ==========================================
const erroMarca = document.getElementById("erroMarca");
const erroModelo = document.getElementById("erroModelo");
const erroAnoFabricacao = document.getElementById("erroAnoFabricacao");
const erroAnoModelo = document.getElementById("erroAnoModelo");
const erroPreco = document.getElementById("erroPreco");

// ==========================================
// USUÁRIO
// ==========================================
const usuario = JSON.parse(
    localStorage.getItem("usuario")
);

// ==========================================
// VERIFICA LOGIN
// ==========================================
if (!usuario) {
    window.location.href = "/pages/login.html";
}

// ==========================================
// BOTÃO MEU PAINEL
// ==========================================
if (btnPainel && usuario) {

    if (usuario.tipo === "empresa") {

        btnPainel.href =
        "/pages/painel-empresa.html";

    } else if (usuario.tipo === "admin") {

        btnPainel.href =
        "/pages/admin.html";

    } else {

        btnPainel.href =
        "/pages/painel-cliente.html";
    }
}

// ==========================================
// SUBMIT
// ==========================================
formAnuncio.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();

        limparErros();

        let valido = true;

        // ==================================
        // VALIDAÇÕES
        // ==================================
        if (marca.value.trim() === "") {

            erroMarca.textContent =
            "Digite a marca.";

            valido = false;
        }

        if (modelo.value.trim() === "") {

            erroModelo.textContent =
            "Digite o modelo.";

            valido = false;
        }

        if (
            anoFabricacao.value.trim() === ""
        ) {

            erroAnoFabricacao.textContent =
            "Digite o ano de fabricação.";

            valido = false;
        }

        if (
            anoModelo.value.trim() === ""
        ) {

            erroAnoModelo.textContent =
            "Digite o ano do modelo.";

            valido = false;
        }

        if (preco.value.trim() === "") {

            erroPreco.textContent =
            "Digite o preço.";

            valido = false;
        }

        if (!valido) return;

        // ==================================
        // FORM DATA
        // ==================================
        const formData = new FormData();

        formData.append(
            "usuario_id",
            usuario.id
        );

        formData.append(
            "marca",
            marca.value.trim()
        );

        formData.append(
            "modelo",
            modelo.value.trim()
        );

        formData.append(
            "versao",
            versao.value.trim()
        );

        formData.append(
            "ano_fabricacao",
            anoFabricacao.value
        );

        formData.append(
            "ano_modelo",
            anoModelo.value
        );

        formData.append(
            "preco",
            preco.value
        );

        formData.append(
            "quilometragem",
            quilometragem.value || 0
        );

        formData.append(
            "combustivel",
            combustivel.value
        );

        formData.append(
            "cambio",
            cambio.value
        );

        formData.append(
            "cor",
            cor.value.trim()
        );

        formData.append(
            "portas",
            portas.value || ""
        );

        formData.append(
            "carroceria",
            carroceria.value.trim()
        );

        formData.append(
            "descricao",
            descricao.value.trim()
        );

        // ==================================
        // IMAGEM
        // ==================================
        if (
            imagem.files &&
            imagem.files.length > 0
        ) {

            formData.append(
                "imagem",
                imagem.files[0]
            );
        }

        // ==================================
        // BOTÃO
        // ==================================
        btnAnunciar.textContent =
        "Publicando...";

        btnAnunciar.disabled = true;

        try {

            // ==============================
            // FETCH
            // ==============================
            const resposta = await fetch(
                "/api/veiculos",
                {
                    method: "POST",
                    body: formData
                }
            );

            const data =
            await resposta.json();

            alert(data.mensagem);

            // ==============================
            // SUCESSO
            // ==============================
            if (data.sucesso) {

                formAnuncio.reset();

                if (
                    usuario.tipo === "empresa"
                ) {

                    window.location.href =
                    "/pages/painel-empresa.html";

                } else {

                    window.location.href =
                    "/pages/painel-cliente.html";
                }
            }

        } catch (erro) {

            console.error(
                "Erro ao publicar:",
                erro
            );

            alert(
                "Erro ao publicar anúncio."
            );

        } finally {

            btnAnunciar.textContent =
            "Publicar anúncio";

            btnAnunciar.disabled = false;
        }
    }
);

// ==========================================
// LIMPAR ERROS
// ==========================================
function limparErros() {

    erroMarca.textContent = "";

    erroModelo.textContent = "";

    erroAnoFabricacao.textContent = "";

    erroAnoModelo.textContent = "";

    erroPreco.textContent = "";
}

// PRE-VISUALIZAÇÃO DA IMAGEM SELECIONADA
document.addEventListener('DOMContentLoaded', () => {
    const inputImg = document.getElementById('imagem');
    const dropzone = document.querySelector('.dropzone-file');
    const nomeArq = document.getElementById('nomeArquivoSelecionado');
    const svgIcon = dropzone ? dropzone.querySelector('svg') : null;

    if (inputImg && dropzone) {
        inputImg.addEventListener('change', (e) => {
            const file = e.target.files[0];
            
            if (file) {
                const reader = new FileReader();

                reader.onload = (event) => {
                    let imgPreview = dropzone.querySelector('.preview-imagem');

                    if (!imgPreview) {
                        imgPreview = document.createElement('img');
                        imgPreview.classList.add('preview-imagem');
                        dropzone.appendChild(imgPreview);
                    }

                    imgPreview.src = event.target.result;

                    if (svgIcon) svgIcon.style.display = 'none';
                    nomeArq.textContent = `Clique para alterar a foto (${file.name})`;
                    nomeArq.style.color = '#ff1e27';
                };

                reader.readAsDataURL(file);
            }
        });
    }
});