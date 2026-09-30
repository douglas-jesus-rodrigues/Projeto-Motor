const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const usuarioController = require("../controllers/usuarioController");
const authAdmin = require("../middlewares/authAdmin");
const db = require("../config/db");
const { enviarEmailRecuperacao } = require("../config/emailService");

const TIPOS_VALIDOS = ["individual", "empresa", "admin"];

// ==========================================
// CONFIGURAÇÃO DO MULTER (FOTO DE PERFIL)
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, "../../public/uploads")),
    filename: (req, file, cb) => {
        const sufixo = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, sufixo + path.extname(file.originalname).toLowerCase());
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Apenas imagens são permitidas."), false);
    }
});

// ==========================================
// LOGIN: GUARDA A SESSÃO E GARANTE O TOKEN (corrige o 401 do painel admin)
// ==========================================
// Envolve o loginUsuario existente. Quando o login dá certo:
//  - grava o usuário em req.session (o authAdmin lê dali);
//  - se o controller não enviou token, gera um JWT;
//  - só responde depois de a sessão estar salva.
function extrairUsuario(corpo) {
    const u = corpo.usuario || corpo.user || corpo.dados || corpo.data;
    if (!u || typeof u !== "object") return null;
    return {
        id: u.id ?? u.id_usuario ?? u.usuario_id ?? null,
        email: u.email || null,
        tipo: u.tipo,
        cargo: u.cargo
    };
}

async function prepararSessao(req, res, corpo) {
    if (res.statusCode >= 400 || !corpo || typeof corpo !== "object" || corpo.sucesso === false) return;

    const u = extrairUsuario(corpo);
    if (!u) {
        console.warn("[login] Resposta sem objeto de usuário; sessão NÃO criada. Chaves:", Object.keys(corpo));
        return;
    }

    // Se o controller não devolveu o id, descobre pelo e-mail
    if (!u.id && u.email) {
        const [rows] = await db.query(
            "SELECT id, tipo, cargo FROM usuarios WHERE email = ? AND deleted_at IS NULL LIMIT 1",
            [u.email]
        );
        if (rows.length) Object.assign(u, rows[0]);
    }

    if (!u.id) {
        console.warn("[login] Não foi possível identificar o id do usuário; sessão NÃO criada.");
        return;
    }

    if (req.session) {
        req.session.usuario = { id: u.id, tipo: u.tipo, cargo: u.cargo };
        await new Promise((resolve) => req.session.save(() => resolve()));
    }

    if (!corpo.token) {
        if (process.env.JWT_SECRET) {
            corpo.token = jwt.sign({ id: u.id, tipo: u.tipo }, process.env.JWT_SECRET, { expiresIn: "1d" });
        } else {
            console.warn("[login] JWT_SECRET não definido no .env; token NÃO gerado.");
        }
    }

    console.log(`[login] Sessão criada para usuário id=${u.id} tipo=${u.tipo}`);
}

function comSessao(handler) {
    return (req, res, next) => {
        const jsonOriginal = res.json.bind(res);

        res.json = (corpo) => {
            Promise.resolve(prepararSessao(req, res, corpo))
                .catch((e) => console.error("[login] Erro ao gravar sessão:", e.sqlMessage || e.message || e))
                .then(() => jsonOriginal(corpo));
            return res;
        };

        return handler(req, res, next);
    };
}

// ==========================================
// CADASTRO, LOGIN E PERFIL
// ==========================================
router.post("/cadastro", usuarioController.cadastrarUsuario);
router.post("/login", comSessao(usuarioController.loginUsuario));
router.get("/verificar-email/:token", usuarioController.verificarEmail);

// Solicitar recuperação de senha
router.post("/esqueci-senha", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ sucesso: false, erro: "O e-mail é obrigatório." });

    try {
        const [usuarios] = await db.query("SELECT id, email FROM usuarios WHERE email = ?", [email]);

        // Mesma resposta exista ou não o e-mail (não revela cadastros)
        if (usuarios.length === 0) {
            return res.status(200).json({ sucesso: true, mensagem: "Se o e-mail estiver cadastrado, as instruções foram enviadas." });
        }

        const usuario = usuarios[0];
        const token = crypto.randomBytes(32).toString("hex");
        const expiracao = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

        await db.query("UPDATE usuarios SET token_recuperacao = ?, token_expiracao = ? WHERE id = ?", [token, expiracao, usuario.id]);
        await enviarEmailRecuperacao(usuario.email, token);

        return res.status(200).json({ sucesso: true, mensagem: "E-mail de recuperação enviado com sucesso!" });

    } catch (erro) {
        console.error("Erro na rota de esqueci-senha:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro interno ao processar a recuperação de senha." });
    }
});

// Salvar nova senha
router.post("/redefinir-senha", async (req, res) => {
    const { token, novaSenha } = req.body;
    if (!token || !novaSenha) return res.status(400).json({ sucesso: false, erro: "Token e nova senha são obrigatórios." });

    try {
        const [usuarios] = await db.query(
            "SELECT id, senha FROM usuarios WHERE token_recuperacao = ? AND token_expiracao > NOW()",
            [token]
        );
        if (usuarios.length === 0) return res.status(400).json({ sucesso: false, erro: "Token inválido ou expirado." });

        const usuario = usuarios[0];

        if (await bcrypt.compare(novaSenha, usuario.senha)) {
            return res.status(400).json({ sucesso: false, erro: "A nova senha não pode ser igual à sua senha atual." });
        }

        const hash = await bcrypt.hash(novaSenha, 10);
        await db.query(
            "UPDATE usuarios SET senha = ?, token_recuperacao = NULL, token_expiracao = NULL WHERE id = ?",
            [hash, usuario.id]
        );

        return res.status(200).json({ sucesso: true, mensagem: "Senha redefinida com sucesso!" });

    } catch (erro) {
        console.error("Erro ao redefinir senha:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro interno ao redefinir a senha." });
    }
});

// Upload de foto de perfil (coluna correta: foto_perfil)
router.post("/upload-foto", upload.single("fotoPerfil"), async (req, res) => {
    try {
        const { usuarioId } = req.body;
        const arquivo = req.file;

        if (!arquivo) return res.status(400).json({ sucesso: false, erro: "Nenhum arquivo enviado." });
        if (!usuarioId) return res.status(400).json({ sucesso: false, erro: "ID do usuário não informado." });

        const fotoUrl = `/uploads/${arquivo.filename}`;

        const [resultado] = await db.query("UPDATE usuarios SET foto_perfil = ? WHERE id = ?", [fotoUrl, usuarioId]);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ sucesso: false, erro: "Usuário não encontrado no banco de dados." });
        }

        return res.status(200).json({ sucesso: true, mensagem: "Foto de perfil atualizada com sucesso!", fotoUrl });

    } catch (erro) {
        console.error("Erro no upload da foto de perfil:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro interno no servidor ao salvar a foto." });
    }
});

// ==========================================
// PAINEL ADMINISTRATIVO (ROTAS PROTEGIDAS)
// ==========================================
router.get("/", authAdmin, usuarioController.listarUsuarios);
router.get("/admin/estatisticas", authAdmin, usuarioController.obterEstatisticasAdmin);
router.get("/admin/cadastros-mes", authAdmin, usuarioController.obterCadastrosPorMes);
router.delete("/:id", authAdmin, usuarioController.deletarUsuario);

router.put("/:id/tipo", authAdmin, async (req, res) => {
    const { id } = req.params;
    const { tipo } = req.body;

    if (!tipo) return res.status(400).json({ sucesso: false, erro: "O novo tipo de acesso é obrigatório." });
    if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({ sucesso: false, erro: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(", ")}.` });
    }

    try {
        const [resultado] = await db.query("UPDATE usuarios SET tipo = ? WHERE id = ?", [tipo, id]);
        if (resultado.affectedRows === 0) return res.status(404).json({ sucesso: false, erro: "Usuário não encontrado." });

        return res.status(200).json({ sucesso: true, mensagem: `Tipo de acesso alterado para ${tipo} com sucesso!` });

    } catch (erro) {
        console.error("Erro ao alterar tipo do usuário:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro interno no servidor ao alterar o tipo de acesso." });
    }
});

// ==========================================
// VERIFICAR SENHA ATUAL (modal) — não devolve mais a senha
// ==========================================
router.post("/verificar-senha", async (req, res) => {
    const { id, senha } = req.body;
    if (!id || !senha) return res.status(400).json({ sucesso: false, erro: "ID e senha são obrigatórios." });

    try {
        const [usuarios] = await db.query("SELECT senha FROM usuarios WHERE id = ?", [id]);
        if (usuarios.length === 0) return res.status(404).json({ sucesso: false, erro: "Usuário não encontrado." });

        if (!(await bcrypt.compare(senha, usuarios[0].senha))) {
            return res.status(200).json({ sucesso: false, erro: "Senha incorreta." });
        }
        return res.status(200).json({ sucesso: true, mensagem: "Senha verificada com sucesso!" });

    } catch (erro) {
        console.error("Erro ao verificar senha:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, erro: "Erro interno no servidor ao verificar a senha." });
    }
});

module.exports = router;
