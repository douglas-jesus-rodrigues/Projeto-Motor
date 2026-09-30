// src/middlewares/authAdmin.js
// Libera a rota apenas para administradores.
//
// - Identifica o usuário por: sessão (express-session), req.usuarioLogado
//   OU token JWT enviado em "Authorization: Bearer <token>".
// - Confere o usuário no BANCO a cada chamada: se ele foi bloqueado, apagado ou
//   rebaixado depois do login, perde o acesso na hora.
// - Aceita admin pelo `tipo` OU pelo `cargo` ('admin' / 'super_admin').
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const PAPEIS_ADMIN = ["admin", "super_admin"];

function lerSessao(req) {
    // 1) Sessão do servidor
    if (req.session && req.session.usuario) return req.session.usuario;
    if (req.usuarioLogado) return req.usuarioLogado;

    // 2) Token JWT no header Authorization
    const cabecalho = req.headers.authorization || "";
    const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : null;
    if (!token) return null;

    if (!process.env.JWT_SECRET) {
        console.error("❌ JWT_SECRET não está definido no .env");
        return null;
    }

    try {
        return jwt.verify(token, process.env.JWT_SECRET); // { id, tipo, iat, exp }
    } catch (e) {
        console.warn("[authAdmin] JWT rejeitado:", e.message);
        return null; // token inválido ou expirado
    }
}

module.exports = async (req, res, next) => {
    const sessao = lerSessao(req);

    if (!sessao) {
        console.warn(
            "[authAdmin] 401 em", req.originalUrl,
            "| sessão:", req.session && req.session.usuario ? "sim" : "não",
            "| Authorization:", req.headers.authorization ? "sim" : "não"
        );
        return res.status(401).json({
            sucesso: false,
            mensagem: "Sessão expirada. Faça login novamente."
        });
    }

    try {
        let atual = sessao;

        if (sessao.id) {
            const [linhas] = await db.query(
                "SELECT id, tipo, cargo, status FROM usuarios WHERE id = ? AND deleted_at IS NULL LIMIT 1",
                [sessao.id]
            );

            if (!linhas.length) {
                return res.status(401).json({
                    sucesso: false,
                    mensagem: "Conta não encontrada. Faça login novamente."
                });
            }

            atual = linhas[0];

            if (atual.status === "bloqueado") {
                return res.status(403).json({
                    sucesso: false,
                    mensagem: "Conta bloqueada."
                });
            }
        }

        const ehAdmin = PAPEIS_ADMIN.includes(atual.tipo) || PAPEIS_ADMIN.includes(atual.cargo);

        if (!ehAdmin) {
            return res.status(403).json({
                sucesso: false,
                mensagem: "Acesso negado. Apenas administradores autorizados."
            });
        }

        req.admin = atual; // disponível para as rotas (ex.: logs de auditoria)
        next();

    } catch (erro) {
        console.error("❌ Erro em authAdmin:", erro.sqlMessage || erro.message || erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao validar permissões de administrador."
        });
    }
};
