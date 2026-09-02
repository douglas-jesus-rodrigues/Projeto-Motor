document.addEventListener("DOMContentLoaded", async () => {
    const dadosReais = {
        email: "",
        cpf: "",
        senha: ""
    };

    const usuarioLocal = JSON.parse(localStorage.getItem("usuario"));

    if (!usuarioLocal) {
        window.location.href = "/pages/login.html";
        return;
    }

    configurarBotaoVoltar(usuarioLocal.tipo);

    try {
        const response = await fetch(`/api/perfil/meu-perfil?id=${usuarioLocal.id}`);
        const dados = await response.json();

        if (!dados.sucesso) {
            throw new Error(dados.mensagem);
        }

        const usuario = dados.usuario;
        localStorage.setItem("usuario", JSON.stringify(usuario));

        const badgeTipoConta = document.getElementById("badgeTipoConta");
        if (badgeTipoConta) {
            badgeTipoConta.className = "badge";
            badgeTipoConta.classList.add(usuario.tipo);

            if (usuario.tipo === "admin") {
                badgeTipoConta.innerHTML = 'Administrador';
            } else if (usuario.tipo === "empresa") {
                badgeTipoConta.innerHTML = 'Conta Jurídica';
            } else {
                badgeTipoConta.innerHTML = 'Conta Individual';
            }
        }

        dadosReais.email = usuario.email || "";
        dadosReais.cpf = formatarCPF(usuario.cpf);
        dadosReais.senha = usuario.senha || "";

        document.getElementById("nome").value = usuario.nome || "";
        document.getElementById("sobrenome").value = usuario.sobrenome || "";
        document.getElementById("telefone").value = formatarTelefone(usuario.telefone) || "";

        // Máscaras iniciais
        document.getElementById("email").value = dadosReais.email ? gerarMascaraEmail(dadosReais.email) : "";
        document.getElementById("cpf").value = dadosReais.cpf ? "***.***.***-**" : "";
        
        const inputSenhaPerfil = document.getElementById("senhaAtualPerfil");
        if (inputSenhaPerfil) inputSenhaPerfil.value = "********";

        if (usuario.tipo === "empresa") {
            const secaoEmpresa = document.getElementById("secaoEmpresa");
            if (secaoEmpresa) {
                secaoEmpresa.style.display = "block";

                document.getElementById("cnpj").value = formatarCNPJ(usuario.cnpj) || "";
                document.getElementById("nomeEmpresa").value = usuario.nome_empresa || "";
                document.getElementById("razaoSocial").value = usuario.razao_social || "";
                document.getElementById("inscricaoEstadual").value = usuario.inscricao_estadual || "";
                document.getElementById("site").value = usuario.site || "";
            }
        }

        configurarBotoesRevelar(dadosReais);

    } catch (error) {
        console.error("Erro ao carregar perfil do banco:", error);
        alert("Não foi possível carregar as informações atualizadas do servidor.");
    }
});

function configurarBotaoVoltar(tipo) {
    const btnVoltar = document.getElementById("btnVoltar");
    if (btnVoltar) {
        if (tipo === "admin") {
            btnVoltar.href = "/pages/painel-admin.html";
        } else {
            btnVoltar.href = "/pages/painel-cliente.html";
        }
    }
}

/**
 * Controla os botões "Ver" e "Ocultar"
 */
function configurarBotoesRevelar(dadosReais) {
    const botoes = document.querySelectorAll(".btn-revelar");

    botoes.forEach(botao => {
        botao.addEventListener("click", () => {
            const alvoId = botao.getAttribute("data-alvo");
            const input = document.getElementById(alvoId);

            if (!input) return;

            const textoBotao = botao.innerText.trim().toUpperCase();

            if (textoBotao === "VER") {
                // Se for a senha, abre o modal de segurança antes de revelar
                if (alvoId === "senhaAtualPerfil") {
                    abrirModalSenha();
                } else {
                    // Para e-mail ou CPF, revela direto (ou ajuste se quiser senha em todos)
                    input.value = dadosReais[alvoId];
                    botao.innerText = "Ocultar";
                    botao.style.color = "#ffffff";
                    botao.style.backgroundColor = "var(--primary)";
                    botao.style.borderColor = "var(--primary-hover)";
                }
            } else {
                // OCULTAR IMEDIATAMENTE (Sem pedir senha)
                if (alvoId === "email") {
                    input.value = gerarMascaraEmail(dadosReais.email);
                } else if (alvoId === "cpf") {
                    input.value = "***.***.***-**";
                } else if (alvoId === "senhaAtualPerfil") {
                    input.value = "********";
                    input.type = "password"; // Garante que volta a mascarar os caracteres
                }

                botao.innerText = "Ver";
                botao.style.color = "";
                botao.style.backgroundColor = "";
                botao.style.borderColor = "";
            }
        });
    });
}

function abrirModalSenha() {
    const modal = document.getElementById("modalSenha");
    if (modal) {
        modal.style.display = "flex";
        modal.classList.add("mostrar-modal");
        const inputModal = document.getElementById("senhaDigitadaModal");
        if (inputModal) {
            inputModal.value = "";
            inputModal.focus();
        }
    }
}

function fecharModalSenha() {
    const modal = document.getElementById("modalSenha");
    if (modal) {
        modal.classList.remove("mostrar-modal");
        modal.style.display = "none";
    }
}

function toggleSenhaModal() {
    const input = document.getElementById("senhaDigitadaModal");
    const botao = event.target;
    if (!input || !botao) return;

    if (input.type === "password") {
        input.type = "text";
        botao.textContent = "Ocultar";
    } else {
        input.type = "password";
        botao.textContent = "Ver";
    }
}

async function confirmarSenhaModal() {
    const senhaInput = document.getElementById("senhaDigitadaModal");
    const senhaDigitada = senhaInput ? senhaInput.value : "";

    if (!senhaDigitada) {
        alert("Por favor, digite sua senha atual.");
        return;
    }

    try {
        const usuarioLocal = JSON.parse(localStorage.getItem("usuario"));
        if (!usuarioLocal || !usuarioLocal.id) {
            alert("Sessão expirada. Faça login novamente.");
            window.location.href = "/pages/login.html";
            return;
        }

        const response = await fetch("/api/usuarios/verificar-senha", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: usuarioLocal.id,
                senha: senhaDigitada
            })
        });

        const resultado = await response.json();

        if (resultado.sucesso) {
            fecharModalSenha();
            
            // Revela a senha no input de perfil e muda o botão correspondente para "Ocultar"
            const inputSenhaPerfil = document.getElementById("senhaAtualPerfil");
            const botaoRevelarSenha = document.querySelector('[data-alvo="senhaAtualPerfil"]');

            if (inputSenhaPerfil) {
                inputSenhaPerfil.value = resultado.senhaReal || senhaDigitada;
                inputSenhaPerfil.type = "text";
            }

            if (botaoRevelarSenha) {
                botaoRevelarSenha.innerText = "Ocultar";
                botaoRevelarSenha.style.color = "#ffffff";
                botaoRevelarSenha.style.backgroundColor = "var(--primary)";
                botaoRevelarSenha.style.borderColor = "var(--primary-hover)";
            }
        } else {
            alert(resultado.erro || "Senha incorreta.");
            if (senhaInput) {
                senhaInput.value = "";
                senhaInput.focus();
            }
        }

    } catch (error) {
        console.error("Erro ao validar senha:", error);
        alert("Erro de conexão ao tentar validar a senha.");
    }
}

function gerarMascaraEmail(email) {
    if (!email.includes("@")) return "******";
    const [usuario, dominio] = email.split("@");
    if (usuario.length <= 3) return `${usuario}***@${dominio}`;
    return `${usuario.substring(0, 3)}***@${dominio}`;
}

function formatarCPF(cpf) {
    if (!cpf) return "";
    const limpo = cpf.replace(/\D/g, "");
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatarCNPJ(cnpj) {
    if (!cnpj) return "";
    const limpo = cnpj.replace(/\D/g, "");
    return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatarTelefone(tel) {
    if (!tel) return "";
    const limpo = tel.replace(/\D/g, "");
    if (limpo.length === 11) {
        return limpo.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return limpo.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
}