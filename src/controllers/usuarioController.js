const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../config/db");
const resend = require("../config/email");

// ==========================================
// CADASTRAR USUÁRIO
// ==========================================
exports.cadastrarUsuario = async (req, res) => {
    let conn;

    try {
        let {
            nome,
            sobrenome,
            email,
            telefone,
            cpf,
            tipo,
            senha,

            // CAMPOS DA EMPRESA
            cnpj,
            nome_empresa,
            razao_social,
            inscricao_estadual,
            site
        } = req.body;

        if (!nome || !sobrenome || !email || !telefone || !cpf || !tipo || !senha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Preencha todos os campos obrigatórios."
            });
        }

        nome = nome.trim();
        sobrenome = sobrenome.trim();
        email = email.trim().toLowerCase();
        telefone = telefone.replace(/\D/g, "");
        cpf = cpf.replace(/\D/g, "");

        if (!validarEmail(email)) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Digite um e-mail válido."
            });
        }

        if (telefone.length < 10 || telefone.length > 11) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Digite um telefone válido."
            });
        }

        if (cpf.length !== 11) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "CPF inválido."
            });
        }

        if (tipo !== "individual" && tipo !== "empresa") {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Tipo de conta inválido."
            });
        }

        if (tipo === "empresa") {
            if (!cnpj || !nome_empresa) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: "Empresa precisa informar CNPJ e nome da empresa."
                });
            }

            cnpj = cnpj.replace(/\D/g, "");

            if (cnpj.length !== 14) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: "CNPJ inválido."
                });
            }
        }

        conn = await db.getConnection();
        await conn.beginTransaction();

        const [emailExiste] = await conn.query(
            "SELECT id FROM usuarios WHERE email = ?",
            [email]
        );

        if (emailExiste.length > 0) {
            await conn.rollback();

            return res.status(400).json({
                sucesso: false,
                mensagem: "Este e-mail já está cadastrado."
            });
        }

        const [cpfExiste] = await conn.query(
            "SELECT id FROM usuarios WHERE cpf = ?",
            [cpf]
        );

        if (cpfExiste.length > 0) {
            await conn.rollback();

            return res.status(400).json({
                sucesso: false,
                mensagem: "CPF já cadastrado."
            });
        }

        if (tipo === "empresa") {
            const [cnpjExiste] = await conn.query(
                "SELECT id FROM empresas WHERE cnpj = ?",
                [cnpj]
            );

            if (cnpjExiste.length > 0) {
                await conn.rollback();

                return res.status(400).json({
                    sucesso: false,
                    mensagem: "CNPJ já cadastrado."
                });
            }
        }

        const senhaCriptografada = await bcrypt.hash(senha, 10);
        const tokenVerificacao = crypto.randomBytes(32).toString("hex");

        const [resultadoUsuario] = await conn.query(
            `
            INSERT INTO usuarios
            (
                nome,
                sobrenome,
                email,
                telefone,
                cpf,
                tipo,
                senha,
                email_verificado,
                token_verificacao
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                nome,
                sobrenome,
                email,
                telefone,
                cpf,
                tipo,
                senhaCriptografada,
                false,
                tokenVerificacao
            ]
        );

        const usuarioId = resultadoUsuario.insertId;

        if (tipo === "empresa") {
            await conn.query(
                `
                INSERT INTO empresas
                (
                    usuario_id,
                    cnpj,
                    nome_empresa,
                    razao_social,
                    inscricao_estadual,
                    site
                )
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                    usuarioId,
                    cnpj,
                    nome_empresa.trim(),
                    razao_social ? razao_social.trim() : null,
                    inscricao_estadual ? inscricao_estadual.trim() : null,
                    site ? site.trim() : null
                ]
            );
        }

        await conn.commit();

        try {
            await enviarEmailConfirmacao(email, nome, tokenVerificacao);
        } catch (erroEmail) {
            console.error("Usuário cadastrado, mas e-mail não enviado:", erroEmail.message);
        }

        return res.status(201).json({
            sucesso: true,
            mensagem: "Cadastro realizado! Verifique seu e-mail."
        });

    } catch (erro) {
        if (conn) await conn.rollback();

        console.error("Erro no cadastro:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno no servidor."
        });

    } finally {
        if (conn) conn.release();
    }
};

// ==========================================
// LOGIN
// ==========================================
exports.loginUsuario = async (req, res) => {
    try {
        let { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Informe e-mail e senha."
            });
        }

        email = email.trim().toLowerCase();

        const [usuarios] = await db.query(
            "SELECT * FROM usuarios WHERE email = ?",
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "E-mail ou senha inválidos."
            });
        }

        const usuario = usuarios[0];

        if (!usuario.email_verificado) {
            return res.status(403).json({
                sucesso: false,
                mensagem: "Confirme seu e-mail antes de fazer login."
            });
        }

        if (usuario.status !== "ativo") {
            return res.status(403).json({
                sucesso: false,
                mensagem: "Usuário inativo ou bloqueado."
            });
        }

        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

        if (!senhaCorreta) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "E-mail ou senha inválidos."
            });
        }

        // ATUALIZA ÚLTIMO LOGIN
        await db.query(
            `
            UPDATE usuarios
            SET ultimo_login = NOW()
            WHERE id = ?
            `,
            [usuario.id]
        );

        let empresa = null;

        if (usuario.tipo === "empresa") {
            const [empresas] = await db.query(
                "SELECT * FROM empresas WHERE usuario_id = ?",
                [usuario.id]
            );

            empresa = empresas[0] || null;
        }

        return res.status(200).json({
            sucesso: true,
            mensagem: "Login realizado!",
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                sobrenome: usuario.sobrenome,
                email: usuario.email,
                telefone: usuario.telefone,
                cpf: usuario.cpf,
                tipo: usuario.tipo,
                empresa
            }
        });

    } catch (erro) {
        console.error("Erro no login:", erro);

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno no servidor."
        });
    }
};

// ==========================================
// VERIFICAR EMAIL
// ==========================================
exports.verificarEmail = async (req, res) => {
    try {
        const { token } = req.params;

        const [usuarios] = await db.query(
            "SELECT * FROM usuarios WHERE token_verificacao = ?",
            [token]
        );

        if (usuarios.length === 0) {
            return res.status(400).send("Token inválido.");
        }

        const usuario = usuarios[0];

        await db.query(
            `
            UPDATE usuarios
            SET email_verificado = true,
                token_verificacao = NULL
            WHERE id = ?
            `,
            [usuario.id]
        );

        await enviarEmailCadastroSucesso(usuario.email, usuario.nome);

        return res.redirect("/pages/confirmar-email.html");

    } catch (erro) {
        console.error("Erro ao verificar e-mail:", erro);
        return res.status(500).send("Erro interno.");
    }
};

// ==========================================
// PAINEL ADMINISTRATIVO (NOVAS FUNÇÕES)
// ==========================================

// 1. Listar todos os usuários para a tabela do painel
exports.listarUsuarios = async (req, res) => {
    try {
        const [usuarios] = await db.query("SELECT id, nome, email, tipo, status FROM usuarios");
        return res.status(200).json(usuarios);
    } catch (erro) {
        console.error("Erro ao listar usuários:", erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar usuários." });
    }
};

// 2. Estatísticas para os cards do topo do painel
exports.obterEstatisticasAdmin = async (req, res) => {
    try {
        const [usuarios] = await db.query("SELECT COUNT(*) AS total FROM usuarios");
        const [empresas] = await db.query("SELECT COUNT(*) AS total FROM empresas");
        const [veiculos] = await db.query("SELECT COUNT(*) AS total FROM veiculos");
        
        // Caso possua uma tabela ou status de veículos vendidos, ajuste conforme sua base
        const [vendidos] = await db.query("SELECT COUNT(*) AS total FROM veiculos WHERE status = 'vendido'").catch(() => [[{ total: 0 }]]);

        return res.status(200).json({
            totalUsuarios: usuarios[0].total,
            totalEmpresas: empresas[0].total,
            totalVeiculos: veiculos[0].total,
            totalVendidos: vendidos[0].total || 0
        });
    } catch (erro) {
        console.error("Erro ao buscar estatísticas:", erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar estatísticas." });
    }
};

// 3. Deletar usuário pelo ID (botão de lixeira na tabela)
exports.deletarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query("DELETE FROM usuarios WHERE id = ?", [id]);
        return res.status(200).json({ sucesso: true, mensagem: "Usuário excluído com sucesso!" });
    } catch (erro) {
        console.error("Erro ao excluir usuário:", erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro ao excluir usuário." });
    }
};

// ==========================================
// FUNÇÕES AUXILIARES DE E-MAIL
// ==========================================
function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.(com|com\.br|net|org|edu|gov|br)$/i;
    return regex.test(email);
}

async function enviarEmailConfirmacao(email, nome, token) {
    const link = `${process.env.PROD}/api/usuarios/verificar-email/${token}`;

    await resend.emails.send({
        from: "onboarding@resend.dev",
        to: email,
        subject: "Confirme seu cadastro - MotorFlex",
        html: `
            <div style="font-family: Arial; background:#111; color:white; padding:25px; border-radius:10px;">
                <h1 style="color:#e50914;">MotorFlex</h1>
                <h2>Olá, ${nome}</h2>
                <p>Clique no botão abaixo para confirmar sua conta.</p>

                <a href="${link}"
                   style="display:inline-block; background:#e50914; color:white; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:bold;">
                   Confirmar cadastro
                </a>
            </div>
        `
    });
}

async function enviarEmailCadastroSucesso(email, nome) {
    await resend.emails.send({
        from: "onboarding@resend.dev",
        to: email,
        subject: "Cadastro confirmado - MotorFlex",
        html: `
            <div style="font-family: Arial; background:#111; color:white; padding:25px; border-radius:10px;">
                <h1 style="color:#e50914;">MotorFlex</h1>
                <h2>Cadastro confirmado!</h2>
                <p>Olá, ${nome}. Sua conta foi confirmada com sucesso.</p>
            </div>
        `
    });
}

// Retorna a quantidade de cadastros por mês para o gráfico
exports.obterCadastrosPorMes = async (req, res) => {
    try {
        // Consulta que agrupa os usuários pelo mês da data de criação (ex: campo criado_em ou data_cadastro)
        // Substitua 'criado_em' pelo nome real da coluna de data na sua tabela 'usuarios'
        const [resultado] = await db.query(`
            SELECT MONTH(criado_em) AS mes, COUNT(*) AS total 
            FROM usuarios 
            WHERE YEAR(criado_em) = YEAR(CURDATE()) 
            GROUP BY MONTH(criado_em)
            ORDER BY mes ASC
        `);

        // Cria um array com 12 posições (de Jan a Dez) zeradas
        const mesesContagem = Array(12).fill(0);

        // Preenche com os valores reais vindos do banco
        resultado.forEach(row => {
            const indiceMes = row.mes - 1; // Meses em JS vão de 0 a 11
            mesesContagem[indiceMes] = row.total;
        });

        return res.status(200).json(mesesContagem);
    } catch (erro) {
        console.error("Erro ao buscar cadastros por mês:", erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar dados do gráfico." });
    }
};