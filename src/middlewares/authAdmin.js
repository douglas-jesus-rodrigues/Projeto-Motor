// src/middlewares/authAdmin.js
module.exports = (req, res, next) => {
    // Exemplo verificando se o usuário está logado e se é admin ou super_admin
    const usuario = req.session.usuario || req.usuarioLogado; // Depende de como gerencia sua sessão/token

    if (!usuario || (usuario.cargo !== 'admin' && usuario.cargo !== 'super_admin')) {
        return res.status(403).json({
            sucesso: false,
            mensagem: "Acesso negado. Apenas administradores autorizados."
        });
    }

    next(); // Se for admin, o fluxo continua para a rota solicitada
};