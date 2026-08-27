// controllers/authController.js ou routes/auth.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db'); // Sua conexão MySQL

async function login(req, res) {
    const { email, senha } = req.body;

    try {
        // 1. Busca o usuário no banco de dados
        const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        const usuario = rows[0];

        if (!usuario) {
            return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' });
        }

        // 2. Verifica se a senha fornecida bate com o hash salvo no banco
        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) {
            return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' });
        }

        // 3. SE A SENHA ESTIVER CORRETA:
        // Zeramos a régua de inatividade e atualizamos a data do último acesso
        await db.query(`
            UPDATE usuarios 
            SET ultimo_login = NOW(),
                aviso_inatividade_enviado = 'nenhum',
                data_ultimo_aviso = NULL,
                status = 'ativo'
            WHERE id = ?
        `, [usuario.id]);

        // 4. Gera o token de acesso (JWT) e finaliza o login
        const token = jwt.sign(
            { id: usuario.id, tipo: usuario.tipo },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        return res.status(200).json({
            sucesso: true,
            mensagem: 'Login realizado com sucesso!',
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email
            }
        });

    } catch (erro) {
        console.error('Erro no login:', erro);
        return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
}

module.exports = { login };