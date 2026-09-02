document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("formRecuperarSenha");
    const divMensagem = document.getElementById("mensagem");

    function mostrarMensagem(texto, tipo) {
        divMensagem.textContent = texto;
        divMensagem.className = tipo; // 'sucesso' ou 'erro'
        
        // Esconde a mensagem após 5 segundos
        setTimeout(() => {
            divMensagem.className = "";
            divMensagem.textContent = "";
        }, 5000);
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();

        if (!email) {
            mostrarMensagem("Por favor, preencha o campo de e-mail.", "erro");
            return;
        }

        try {
            const resposta = await fetch("/api/usuarios/esqueci-senha", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email })
            });

            const dados = await resposta.json();

            if (!resposta.ok) {
                throw new Error(dados.erro || "Não foi possível enviar o link de recuperação.");
            }

            mostrarMensagem("Instruções enviadas! Verifique sua caixa de entrada.", "sucesso");
            form.reset();

        } catch (erro) {
            console.error("Erro na recuperação:", erro);
            mostrarMensagem(erro.message || "Erro ao conectar com o servidor.", "erro");
        }
    });
});