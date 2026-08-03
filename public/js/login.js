const senha = document.getElementById("senha");
const verSenha = document.getElementById("verSenha");
const formLogin = document.getElementById("formLogin");
const mensagem = document.getElementById("mensagem");

// MOSTRAR / OCULTAR SENHA
if (verSenha && senha) {
    verSenha.addEventListener("click", function () {
        if (senha.type === "password") {
            senha.type = "text";
            verSenha.textContent = "Ocultar";
        } else {
            senha.type = "password";
            verSenha.textContent = "Ver";
        }
    });
}

// LOGIN COM BACK-END
formLogin.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim().toLowerCase();
    const senhaValor = senha.value.trim();

    if (email === "" || senhaValor === "") {
        mostrarMensagem("Preencha todos os campos.", false);
        return;
    }

    try {
        const resposta = await fetch("/api/usuarios/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                senha: senhaValor
            })
        });

        const data = await resposta.json();

        mostrarMensagem(data.mensagem, data.sucesso);

        if (data.sucesso) {
            localStorage.setItem("usuario", JSON.stringify(data.usuario));

            setTimeout(() => {
                if (data.usuario.tipo === "empresa") {
                    window.location.href = "/pages/painel-empresa.html";
                } else if (data.usuario.tipo === "admin") {
                    window.location.href = "/pages/admin.html";
                } else {
                    window.location.href = "/pages/painel-cliente.html";
                }
            }, 1200);
        }

    } catch (erro) {
        console.error("Erro:", erro);
        mostrarMensagem("Erro ao conectar com o servidor.", false);
    }
});

// MENSAGEM BONITA
function mostrarMensagem(texto, sucesso = true) {
    if (!mensagem) return;

    mensagem.textContent = texto;

    mensagem.classList.remove("sucesso", "erro", "mostrar");

    if (sucesso) {
        mensagem.classList.add("sucesso");
    } else {
        mensagem.classList.add("erro");
    }

    mensagem.classList.add("mostrar");

    setTimeout(() => {
        mensagem.classList.remove("mostrar");
    }, 3000);
}