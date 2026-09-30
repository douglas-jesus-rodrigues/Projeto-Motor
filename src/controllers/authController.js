// controllers/authController.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

async function login(req, res) {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const senha = String(req.body?.senha || "");

    if (!email || !senha) {
        return res.status(400).json({ sucesso: false, mensagem: "Informe e-mail e senha." });
    }

    if (!process.env.JWT_SECRET) {
        console.error("❌ JWT_SECRET não está definido no .env");
        return res.status(500).json({ sucesso: false, mensagem: "Erro de configuração do servidor." });
    }

    try {
        // 1. Busca o usuário (ignora contas apagadas)
        const [rows] = await db.query(
            "SELECT * FROM usuarios WHERE email = ? AND deleted_at IS NULL LIMIT 1",
            [email]
        );
        const usuario = rows[0];

        if (!usuario) {
            return res.status(401).json({ sucesso: false, mensagem: "E-mail ou senha incorretos." });
        }

        // 2. Confere a senha
        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) {
            return res.status(401).json({ sucesso: false, mensagem: "E-mail ou senha incorretos." });
        }

        // 3. Conta bloqueada não entra (e NÃO pode ser reativada pelo login)
        if (usuario.status === "bloqueado") {
            return res.status(403).json({ sucesso: false, mensagem: "Conta bloqueada. Entre em contato com o suporte." });
        }

        // 4. Zera a régua de inatividade e registra o último acesso
        //    (só reativa se estava 'inativo'; qualquer outro status é mantido)
        await db.query(
            `UPDATE usuarios
                SET ultimo_login = NOW(),
                    aviso_inatividade_enviado = 'nenhum',
                    data_ultimo_aviso = NULL,
                    status = CASE WHEN status = 'inativo' THEN 'ativo' ELSE status END
              WHERE id = ?`,
            [usuario.id]
        );

        // 5. Gera o JWT
        const token = jwt.sign(
            { id: usuario.id, tipo: usuario.tipo },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        // 6. (Opcional) Se o app usa express-session, também grava a sessão
        if (req.session) {
            req.session.usuario = { id: usuario.id, tipo: usuario.tipo, cargo: usuario.cargo };
        }

        // 7. Resposta: inclui `tipo` e `cargo`, que o front usa para decidir o painel
        return res.status(200).json({
            sucesso: true,
            mensagem: "Login realizado com sucesso!",
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                sobrenome: usuario.sobrenome,
                email: usuario.email,
                tipo: usuario.tipo,
                cargo: usuario.cargo,
                fotoUrl: usuario.foto_perfil || null
            }
        });

    } catch (erro) {
        console.error("Erro no login:", erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro interno no servidor." });
    }
}

module.exports = { login };
