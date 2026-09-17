let recaptchaWidgetId;

// Função global chamada automaticamente pelo Google quando o reCAPTCHA carrega
window.onRecaptchaLoad = function() {
    // Pronto para renderizar sob demanda
};

// Função global chamada quando o usuário marca a caixinha do reCAPTCHA com sucesso
window.aoVerificarCaptcha = function(token) {
    const overlay = document.getElementById('modalAlertaSeguranca');
    if (overlay) {
        overlay.style.opacity = '0';
        const cardModal = overlay.querySelector('.modal-card-content');
        if (cardModal) cardModal.style.transform = 'scale(0.95)';
        setTimeout(() => overlay.remove(), 250);
    }
    
    // Dispara a submissão do login imediatamente após a verificação bem-sucedida
    if (typeof window.executarLoginNoServidor === 'function') {
        window.executarLoginNoServidor();
    }
};

document.addEventListener("DOMContentLoaded", () => {
    // TRAVA DE SEGURANÇA: Só redireciona se realmente houver sessão ativa e válida
    const usuarioLogado = localStorage.getItem("usuario");
    if (usuarioLogado && usuarioLogado !== "undefined" && usuarioLogado !== "null") {
        try {
            const usuario = JSON.parse(usuarioLogado);
            if (usuario && (usuario.tipo || usuario.cargo)) {
                const rotas = {
                    empresa: "../pages/painel-empresa.html",
                    admin: "../pages/painel-admin.html",
                    super_admin: "../pages/painel-admin.html"
                };
                const destino = rotas[usuario.tipo] || rotas[usuario.cargo] || "../pages/painel-cliente.html";
                window.location.replace(destino);
                return;
            }
        } catch (e) {
            localStorage.removeItem("usuario");
        }
    }

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

    // Limpeza de erros em tempo real ao digitar
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

    // Função que cria o modal com animações suaves de fade-in e scale
    function mostrarModalCaptcha() {
        const modalAntigo = document.getElementById('modalAlertaSeguranca');
        if (modalAntigo) modalAntigo.remove();

        // Reseta o ID para forçar uma nova renderização limpa no modal
        recaptchaWidgetId = undefined;

        const overlay = document.createElement('div');
        overlay.id = 'modalAlertaSeguranca';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.88); display: flex; align-items: center;
            justify-content: center; z-index: 99999; backdrop-filter: blur(6px);
            opacity: 0; transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        overlay.innerHTML = `
            <div class="modal-card-content" style="background: linear-gradient(145deg, #0d0d0d, #141414); border: 1px solid rgba(255, 0, 0, 0.4); padding: 38px 32px; border-radius: 14px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85), 0 0 25px rgba(255, 0, 0, 0.15); transform: scale(0.9); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); position: relative;">
                <div style="font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: 2px; margin-bottom: 8px;">MOTOR<span style="color: #ff0000;">FLEX</span></div>
                <div style="width: 40px; height: 3px; background: #ff0000; margin: 0 auto 20px auto; border-radius: 2px;"></div>
                
                <h3 style="color: #ffffff; font-size: 16px; margin-bottom: 8px; font-weight: 600;">Validação de Segurança</h3>
                <p style="color: #999999; font-size: 13px; line-height: 1.5; margin-bottom: 24px;">Por favor, confirme que você não é um robô para prosseguir com o acesso.</p>
                
                <div id="recaptchaContainerModal" style="display: flex; justify-content: center; margin-bottom: 22px; background: #080808; padding: 14px; border-radius: 10px; border: 1px solid #222;"></div>
                
                <button type="button" id="fecharAlertaBtn" style="background: transparent; color: #777777; border: none; padding: 6px 14px; font-size: 12px; cursor: pointer; transition: color 0.2s; font-weight: 500;">Cancelar</button>
            </div>
        `;

        document.body.appendChild(overlay);

        // Animação de entrada suave (Fade in & Zoom in)
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            const cardModal = overlay.querySelector('.modal-card-content');
            if (cardModal) cardModal.style.transform = 'scale(1)';
        });

        // Renderiza o reCAPTCHA do Google dentro do container criado
        if (typeof grecaptcha !== 'undefined') {
            try {
                recaptchaWidgetId = grecaptcha.render('recaptchaContainerModal', {
                    'sitekey': '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI', // Chave de teste oficial do Google
                    'theme': 'dark',
                    'callback': 'aoVerificarCaptcha'
                });
            } catch (err) {
                console.error("Erro ao renderizar reCAPTCHA:", err);
            }
        }

        const fecharModal = () => {
            overlay.style.opacity = '0';
            const cardModal = overlay.querySelector('.modal-card-content');
            if (cardModal) cardModal.style.transform = 'scale(0.9)';
            setTimeout(() => {
                overlay.remove();
                recaptchaWidgetId = undefined;
            }, 250);
        };

        // Fecha ao clicar no botão cancelar
        document.getElementById('fecharAlertaBtn').addEventListener('click', fecharModal);

        // Fecha ao clicar fora do cartão modal (na área escura de fundo)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                fecharModal();
            }
        });
    }

    // Função global e centralizada para processar os dados e chamar a API de login
    window.executarLoginNoServidor = async function() {
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

        if (temErro) {
            recaptchaWidgetId = undefined;
            return;
        }

        toggleLoading(true);

        try {
            const resposta = await fetch("/api/usuarios/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, senha })
            });

            const data = await resposta.json();

            if (!resposta.ok) {
                throw new Error(data.mensagem || "Credenciais inválidas.");
            }

            mostrarToast(data.mensagem || "Login realizado com sucesso!", "sucesso");

            if (data.sucesso && data.usuario) {
                localStorage.setItem("usuario", JSON.stringify(data.usuario));

                // Reduzido para 400ms para agilizar a transição e a animação do botão
                setTimeout(() => {
                    const rotas = {
                        empresa: "../pages/painel-empresa.html",
                        admin: "../pages/painel-admin.html",
                        super_admin: "../pages/painel-admin.html"
                    };

                    const destino = rotas[data.usuario.tipo] || 
                                    rotas[data.usuario.cargo] || 
                                    "../pages/painel-cliente.html";

                    // Substitui o histórico para impedir voltar à tela de login via botão "Voltar"
                    window.location.replace(destino);
                }, 400);
            }

        } catch (erro) {
            console.error("Erro no login:", erro);
            mostrarToast(erro.message || "Erro ao conectar com o servidor.", "erro");
            toggleLoading(false);
            
            // Invalida o widget atual para permitir nova verificação limpa
            recaptchaWidgetId = undefined;
        }
    };

    // Ouvinte principal do formulário de login
    if (formLogin) {
        formLogin.addEventListener("submit", async (e) => {
            e.preventDefault();

            // Verifica se o reCAPTCHA foi resolvido
            const respostaCaptcha = typeof grecaptcha !== 'undefined' && recaptchaWidgetId !== undefined 
                ? grecaptcha.getResponse(recaptchaWidgetId) 
                : "";
            
            if (!respostaCaptcha) {
                mostrarModalCaptcha(); // Abre o modal animado na frente da tela
                return; 
            }

            // Se o reCAPTCHA já estiver marcado, executa o login diretamente
            await executarLoginNoServidor();
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

