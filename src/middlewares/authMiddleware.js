const jwt = require("jsonwebtoken");

/**
 * Middleware de Autenticação para Utilizadores Logados no MotorFlex
 */
function authMiddleware(req, res, next) {
    let token = null;

    // 1. Tenta extrair o token do Header 'Authorization: Bearer <token>'
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    } 
    // 2. Fallback: Procura nos Cookies da requisição
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    // 3. Fallback: Procura na Query String (útil para testes ou downloads)
    else if (req.query && req.query.token) {
        token = req.query.token;
    }

    // Se não houver token, rejeita com 401 Unauthorized
    if (!token) {
        return res.status(401).json({
            sucesso: false,
            erro: "Acesso negado. Token de autenticação não fornecido."
        });
    }

    try {
        const segredo = process.env.JWT_SECRET || "motorflex_secret_key";
        const decodificado = jwt.verify(token, segredo);

        // Padroniza a propriedade 'id' do utilizador em req.usuario
        req.usuario = {
            ...decodificado,
            id: decodificado.id || decodificado._id || decodificado.usuario_id
        };

        return next();
    } catch (erro) {
        if (erro.name === "TokenExpiredError") {
            return res.status(401).json({
                sucesso: false,
                erro: "Sessão expirada. Faça login novamente."
            });
        }
        
        return res.status(401).json({
            sucesso: false,
            erro: "Token de acesso inválido ou malformatado."
        });
    }
}

module.exports = authMiddleware;