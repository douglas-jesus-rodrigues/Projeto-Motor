document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("formRedefinirSenha");
    const divMensagem = document.getElementById("mensagem");

    // Pega o token da URL (ex: ?token=abc123xyz)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    function mostrarMensagem(texto, tipo) {
        divMensagem.textContent = texto;
        divMensagem.className = tipo;
        
        setTimeout(() => {
            divMensagem.className = "";
            divMensagem.textContent = "";
        }, 5000);
    }

    if (!token) {
        mostrarMensagem("Token de recuperação inválido ou ausente.", "erro");
        form.querySelector("button").disabled = true;
        return;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const novaSenha = document.getElementById("novaSenha").value;
        const confirmaSenha = document.getElementById("confirmaSenha").value;

        if (novaSenha.length < 6) {
            mostrarMensagem("A senha deve ter pelo menos 6 caracteres.", "erro");
            return;
        }

        if (novaSenha !== confirmaSenha) {
            mostrarMensagem("As senhas não coincidem.", "erro");
            return;
        }

        try {
            const resposta = await fetch("/api/usuarios/redefinir-senha", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ token, novaSenha })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                throw new Error(dados.erro || "Não foi possível redefinir a senha.");
            }

            mostrarMensagem("Senha alterada com sucesso! Redirecionando...", "sucesso");
            
            setTimeout(() => {
                window.location.href = "/pages/login.html";
            }, 3000);

        } catch (erro) {
            console.error("Erro ao redefinir senha:", erro);
            mostrarMensagem(erro.message || "Erro ao conectar com o servidor.", "erro");
        }
    });
});

function toggleSenha(idInput, botao) {
    const input = document.getElementById(idInput);
    if (input.type === "password") {
        input.type = "text";
        botao.textContent = "Ocultar";
    } else {
        input.type = "password";
        botao.textContent = "Ver";
    }
}