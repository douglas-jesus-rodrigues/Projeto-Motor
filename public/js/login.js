document.addEventListener("DOMContentLoaded", () => {
    const formLogin = document.getElementById("formLogin");
    const emailInput = document.getElementById("email");
    const senhaInput = document.getElementById("senha");
    const verSenhaBtn = document.getElementById("verSenha");
    const eyeIcon = document.getElementById("eyeIcon");
    const btnSubmit = document.getElementById("btnSubmit");
    const toast = document.getElementById("mensagem");

    const SVG_EYE_OPEN = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
    const SVG_EYE_CLOSED = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;

    if (verSenhaBtn && senhaInput) {
        verSenhaBtn.addEventListener("click", () => {
            const visivel = senhaInput.type === "text";
            senhaInput.type = visivel ? "password" : "text";
            eyeIcon.innerHTML = visivel ? SVG_EYE_OPEN : SVG_EYE_CLOSED;
            verSenhaBtn.setAttribute("aria-label", visivel ? "Mostrar senha" : "Ocultar senha");
        });
    }

    function eEmailValido(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    [emailInput, senhaInput].forEach(input => {
        if (!input) return;
        input.addEventListener("input", () => {
            const group = input.closest(".input-group");
            if (group) {
                group.classList.remove("erro");
                const erroSpan = group.querySelector(".erro-texto");
                if (erroSpan) erroSpan.textContent = "";
            }
        });
    });

    if (formLogin) {
        formLogin.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = emailInput.value.trim().toLowerCase();
            const senha = senhaInput.value.trim();
            let temErro = false;

            if (!email) {
                marcarErro(emailInput, "Preencha com seu e-mail.");
                temErro = true;
            } else if (!eEmailValido(email)) {
                marcarErro(emailInput, "Insira um e-mail válido.");
                temErro = true;
            }

            if (!senha) {
                marcarErro(senhaInput, "Preencha com sua senha.");
                temErro = true;
            }

            if (temErro) return;

            toggleLoading(true);

            try {
                const resposta = await fetch("/api/usuarios/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ email, senha })
                });

                const data = await resposta.json();

                if (!resposta.ok) {
                    throw new Error(data.mensagem || "Credenciais inválidas.");
                }

                mostrarToast(data.mensagem || "Login realizado com sucesso!", "sucesso");

                if (data.sucesso && data.usuario) {
                    localStorage.setItem("usuario", JSON.stringify(data.usuario));

                    setTimeout(() => {
                        const rotas = {
                            empresa: "../pages/painel-empresa.html",
                            admin: "../pages/painel-admin.html",
                            super_admin: "../pages/painel-admin.html"
                        };

                        const destino = rotas[data.usuario.tipo] || 
                                        rotas[data.usuario.cargo] || 
                                        "../pages/painel-cliente.html";

                        window.location.href = destino;
                    }, 1000);
                }

            } catch (erro) {
                console.error("Erro no login:", erro);
                mostrarToast(erro.message || "Erro ao conectar com o servidor.", "erro");
                toggleLoading(false);
            }
        });
    }

    function marcarErro(inputElement, mensagem) {
        const group = inputElement.closest(".input-group");
        if (group) {
            group.classList.add("erro");
            const erroSpan = group.querySelector(".erro-texto");
            if (erroSpan) erroSpan.textContent = mensagem;
        }
    }

    function toggleLoading(carregando) {
        if (!btnSubmit) return;
        btnSubmit.disabled = carregando;
        if (carregando) {
            btnSubmit.classList.add("loading");
        } else {
            btnSubmit.classList.remove("loading");
        }
    }

    let toastTimeout;
    function mostrarToast(mensagem, tipo = "erro") {
        if (!toast) return;

        clearTimeout(toastTimeout);
        toast.textContent = mensagem;
        toast.className = `toast ${tipo} visivel`;

        toastTimeout = setTimeout(() => {
            toast.classList.remove("visivel");
        }, 3500);
    }
});