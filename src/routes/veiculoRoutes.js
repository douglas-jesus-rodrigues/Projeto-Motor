const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const db = require("../config/db");

// ==========================================
// CONFIGURAÇÃO DO MULTER (UPLOAD DE FOTOS)
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, "../../public/uploads")),
    filename: (req, file, cb) => {
        const nomeLimpo = file.originalname.replace(/[^\w.\-]+/g, "_");
        cb(null, `${Date.now()}-${nomeLimpo}`);
    }
});

const UPLOAD_DIR = path.join(__dirname, "../../public/uploads");

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB por imagem
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Apenas arquivos de imagem são permitidos!"), false);
    }
});

// Upload de 1 imagem; erros do multer viram JSON (limite de 5MB, tipo inválido)
const uploadImagem = (req, res, next) => upload.single("imagem")(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === "LIMIT_FILE_SIZE" ? "A imagem deve ter no máximo 5MB." : err.message;
    return res.status(400).json({ sucesso: false, mensagem: msg });
});

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================
function arredondarPreco(valor, casas = 100) {
    return Math.round(valor / casas) * casas;
}

// Resolve (ou cria) marca e modelo e devolve os ids
async function resolverMarcaModelo(marca, modelo) {
    let marcaId;
    const [marcaRows] = await db.query("SELECT id FROM marca WHERE LOWER(nome) = LOWER(?)", [marca]);
    if (marcaRows.length > 0) marcaId = marcaRows[0].id;
    else marcaId = (await db.query("INSERT INTO marca (nome) VALUES (?)", [marca]))[0].insertId;

    let modeloId;
    const [modeloRows] = await db.query("SELECT id FROM modelo WHERE marca_id = ? AND LOWER(nome) = LOWER(?)", [marcaId, modelo]);
    if (modeloRows.length > 0) modeloId = modeloRows[0].id;
    else modeloId = (await db.query("INSERT INTO modelo (marca_id, nome) VALUES (?, ?)", [marcaId, modelo]))[0].insertId;

    return { marcaId, modeloId };
}

// Aceita id numérico ou nome (ex.: "Flex") e devolve o id da tabela auxiliar
async function resolverAuxiliar(tabela, valor, padrao) {
    if (valor === undefined || valor === null || valor === "") return padrao;
    if (!isNaN(valor)) return Number(valor);
    const [rows] = await db.query(`SELECT id FROM ${tabela} WHERE LOWER(nome) = LOWER(?)`, [String(valor).trim()]);
    return rows.length > 0 ? rows[0].id : padrao;
}

// Confere se quem está pedindo é o dono do anúncio (ou admin).
// O front envia usuario_id (body ou query). Para segurança real, troque por validação de token/sessão.
async function podeGerenciar(req, veiculoId, obrigatorio) {
    const solicitante = Number(req.body?.usuario_id ?? req.query.usuario_id ?? req.get("x-usuario-id"));
    if (!solicitante) return !obrigatorio;       // sem identificação: só passa se não for obrigatório

    const [[dono]] = await db.query("SELECT usuario_id FROM veiculos WHERE id = ?", [veiculoId]);
    if (!dono) return true;                       // inexistente: a rota responde 404
    if (Number(dono.usuario_id) === solicitante) return true;

    const [[u]] = await db.query("SELECT tipo FROM usuarios WHERE id = ?", [solicitante]);
    return !!u && u.tipo === "admin";
}

// ==========================================
// POST /api/veiculos — CADASTRAR VEÍCULO COM FOTO
// ==========================================
router.post("/", upload.single("imagem"), async (req, res) => {
    try {
        const {
            usuario_id, marca, modelo, versao, ano_fabricacao, ano_modelo, preco,
            quilometragem, combustivel, cambio, cor, portas, carroceria, descricao
        } = req.body;

        if (!usuario_id || !marca || !modelo || !ano_fabricacao || !ano_modelo || !preco) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Preencha todos os campos obrigatórios (usuario_id, marca, modelo, anos e preço)."
            });
        }

        const precoNumerico = Number(preco);
        if (isNaN(precoNumerico) || precoNumerico <= 0) {
            return res.status(400).json({ sucesso: false, mensagem: "O preço informado é inválido." });
        }
        const precoArredondado = arredondarPreco(precoNumerico, 100);

        const { marcaId, modeloId } = await resolverMarcaModelo(marca.trim(), modelo.trim());
        const combustivelId = await resolverAuxiliar("tipo_combustivel", combustivel, 3);
        const transmissaoId = await resolverAuxiliar("tipo_transmissao", cambio, 1);

        const [resultado] = await db.query(
            `INSERT INTO veiculos
             (usuario_id, marca_id, modelo_id, versao, ano_fabricacao, ano_modelo, preco, quilometragem,
              tipo_combustivel_id, tipo_transmissao_id, cor, portas, carroceria, descricao, status_anuncio_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                usuario_id, marcaId, modeloId,
                versao ? versao.trim() : null,
                Number(ano_fabricacao), Number(ano_modelo),
                precoArredondado,
                quilometragem ? Number(quilometragem) : 0,
                combustivelId, transmissaoId,
                cor ? cor.trim() : null,
                portas ? Number(portas) : null,
                carroceria ? carroceria.trim() : null,
                descricao ? descricao.trim() : null
            ]
        );

        if (req.file) {
            await db.query(
                "INSERT INTO fotos_veiculos (veiculo_id, imagem, principal) VALUES (?, ?, 1)",
                [resultado.insertId, req.file.filename]
            );
        }

        return res.status(201).json({ sucesso: true, mensagem: "Veículo publicado com sucesso!", precoFinal: precoArredondado });

    } catch (erro) {
        console.error("❌ Erro ao cadastrar veículo:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro interno no servidor ao cadastrar veículo." });
    }
});

// ==========================================
// GET /api/veiculos — LISTAR TODOS
// ==========================================
router.get("/", async (req, res) => {
    try {
        const [veiculos] = await db.query(
            `SELECT v.*, m.nome AS marca_nome, mo.nome AS modelo_nome, f.imagem AS imagem
             FROM veiculos v
             LEFT JOIN marca m ON m.id = v.marca_id
             LEFT JOIN modelo mo ON mo.id = v.modelo_id
             LEFT JOIN fotos_veiculos f ON f.veiculo_id = v.id AND f.principal = 1
             ORDER BY v.id DESC`
        );
        return res.status(200).json({ sucesso: true, veiculos });
    } catch (erro) {
        console.error("❌ Erro ao listar veículos:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar veículos." });
    }
});

// ==========================================
// GET /api/veiculos/usuario/:usuarioId — ANÚNCIOS DE UMA CONTA (com visualizações)
// Deve ficar ANTES de "/:id".
// ==========================================
router.get("/usuario/:usuarioId", async (req, res) => {
    const usuarioId = Number(req.params.usuarioId);
    if (!usuarioId) return res.status(400).json({ sucesso: false, mensagem: "ID de usuário inválido." });

    try {
        const [veiculos] = await db.query(
            `SELECT v.*,
                    m.nome  AS marca,
                    mo.nome AS modelo,
                    s.nome  AS status_anuncio,
                    f.imagem AS imagem,
                    (SELECT COUNT(*) FROM visualizacoes_anuncios va WHERE va.veiculo_id = v.id) AS total_visualizacoes
             FROM veiculos v
             LEFT JOIN marca m  ON m.id  = v.marca_id
             LEFT JOIN modelo mo ON mo.id = v.modelo_id
             LEFT JOIN status_anuncio s ON s.id = v.status_anuncio_id
             LEFT JOIN fotos_veiculos f ON f.veiculo_id = v.id AND f.principal = 1
             WHERE v.usuario_id = ?
             ORDER BY v.id DESC`,
            [usuarioId]
        );
        return res.status(200).json({ sucesso: true, veiculos });
    } catch (erro) {
        console.error("❌ Erro ao buscar veículos do usuário:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar os anúncios do usuário." });
    }
});

// ==========================================
// POST /api/veiculos/:id/visualizar — REGISTRAR VISUALIZAÇÃO ÚNICA
// ==========================================
router.post("/:id/visualizar", async (req, res) => {
    const { id } = req.params;
    const { usuario_id } = req.body;

    if (!usuario_id) return res.status(400).json({ sucesso: false, mensagem: "Usuário não autenticado." });

    try {
        const [usuarios] = await db.query("SELECT tipo FROM usuarios WHERE id = ?", [usuario_id]);
        if (usuarios.length > 0 && usuarios[0].tipo === "admin") {
            return res.status(200).json({ sucesso: true, ignorado: true, mensagem: "Visualização de administrador ignorada." });
        }

        const [veiculos] = await db.query("SELECT usuario_id FROM veiculos WHERE id = ?", [id]);
        if (veiculos.length === 0) return res.status(404).json({ sucesso: false, mensagem: "Veículo não encontrado." });

        if (Number(veiculos[0].usuario_id) === Number(usuario_id)) {
            return res.status(200).json({ sucesso: true, ignorado: true, mensagem: "Visualização do próprio proprietário ignorada." });
        }

        // UNIQUE (veiculo_id, usuario_id) garante 1 visualização por pessoa
        await db.query("INSERT IGNORE INTO visualizacoes_anuncios (veiculo_id, usuario_id) VALUES (?, ?)", [id, Number(usuario_id)]);
        return res.status(200).json({ sucesso: true, mensagem: "Visualização registrada com sucesso." });

    } catch (erro) {
        console.error("❌ Erro ao registrar visualização:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro interno ao registrar visualização." });
    }
});

// ==========================================
// GET /api/veiculos/:id — BUSCAR UM VEÍCULO
// ==========================================
router.get("/:id", async (req, res) => {
    try {
        const [veiculos] = await db.query(
            `SELECT v.*, m.nome AS marca, mo.nome AS modelo, f.imagem AS imagem
             FROM veiculos v
             LEFT JOIN marca m ON m.id = v.marca_id
             LEFT JOIN modelo mo ON mo.id = v.modelo_id
             LEFT JOIN fotos_veiculos f ON f.veiculo_id = v.id AND f.principal = 1
             WHERE v.id = ?`,
            [req.params.id]
        );
        if (veiculos.length === 0) return res.status(404).json({ sucesso: false, mensagem: "Veículo não encontrado." });
        return res.status(200).json({ sucesso: true, veiculo: veiculos[0] });
    } catch (erro) {
        console.error("❌ Erro ao buscar veículo por ID:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro ao buscar os dados do veículo." });
    }
});

// ==========================================
// PUT /api/veiculos/:id — ATUALIZAR VEÍCULO (aceita JSON ou multipart com nova foto)
// Só altera os campos ENVIADOS: o que não vier no corpo permanece como está.
// ==========================================
router.put("/:id", uploadImagem, async (req, res) => {
    const { id } = req.params;
    const descartarUpload = () => { if (req.file) fs.unlink(req.file.path, () => {}); };

    try {
        if (!(await podeGerenciar(req, id, true))) {
            descartarUpload();
            return res.status(403).json({ sucesso: false, mensagem: "Você não tem permissão para editar este anúncio." });
        }

        const [[atual]] = await db.query("SELECT * FROM veiculos WHERE id = ?", [id]);
        if (!atual) {
            descartarUpload();
            return res.status(404).json({ sucesso: false, mensagem: "Veículo não encontrado para atualização." });
        }

        const b = req.body;
        const enviado = (k) => b[k] !== undefined;
        const texto = (k, antigo) => (enviado(k) ? (String(b[k]).trim() || null) : antigo);
        const inteiro = (k, antigo) => (enviado(k) && String(b[k]).trim() !== "" ? Number(b[k]) : (enviado(k) ? null : antigo));

        // marca / modelo
        let marcaId = atual.marca_id, modeloId = atual.modelo_id;
        if (enviado("marca") && enviado("modelo") && String(b.marca).trim() && String(b.modelo).trim()) {
            ({ marcaId, modeloId } = await resolverMarcaModelo(String(b.marca).trim(), String(b.modelo).trim()));
        }

        // preço (aceita "150.000", "150000" ou "150.000,00")
        let preco = atual.preco;
        if (enviado("preco") && String(b.preco).trim() !== "") {
            const n = Number(String(b.preco).replace("R$", "").trim().replace(/\./g, "").replace(",", "."));
            if (!isNaN(n) && n > 0) preco = arredondarPreco(n, 100);
        }

        const combustivelId = enviado("combustivel") ? await resolverAuxiliar("tipo_combustivel", b.combustivel, atual.tipo_combustivel_id) : atual.tipo_combustivel_id;
        const transmissaoId = enviado("cambio") ? await resolverAuxiliar("tipo_transmissao", b.cambio, atual.tipo_transmissao_id) : atual.tipo_transmissao_id;

        await db.query(
            `UPDATE veiculos SET
                marca_id = ?, modelo_id = ?, versao = ?, ano_fabricacao = ?, ano_modelo = ?, preco = ?,
                quilometragem = ?, tipo_combustivel_id = ?, tipo_transmissao_id = ?, cor = ?, portas = ?,
                carroceria = ?, descricao = ?
             WHERE id = ?`,
            [
                marcaId, modeloId,
                texto("versao", atual.versao),
                inteiro("ano_fabricacao", atual.ano_fabricacao),
                inteiro("ano_modelo", atual.ano_modelo),
                preco,
                inteiro("quilometragem", atual.quilometragem) ?? 0,
                combustivelId, transmissaoId,
                texto("cor", atual.cor),
                inteiro("portas", atual.portas),
                texto("carroceria", atual.carroceria),
                texto("descricao", atual.descricao),
                id
            ]
        );

        // Troca da foto principal (remove o arquivo antigo do disco)
        let imagem = null;
        if (req.file) {
            const [fotos] = await db.query("SELECT id, imagem FROM fotos_veiculos WHERE veiculo_id = ? AND principal = 1 ORDER BY id LIMIT 1", [id]);
            if (fotos[0]) {
                await db.query(
                    "UPDATE fotos_veiculos SET imagem = ?, nome_original = ?, mime_type = ?, tamanho_bytes = ? WHERE id = ?",
                    [req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, fotos[0].id]
                );
                fs.unlink(path.join(UPLOAD_DIR, path.basename(fotos[0].imagem)), () => {});
            } else {
                await db.query(
                    "INSERT INTO fotos_veiculos (veiculo_id, imagem, nome_original, mime_type, tamanho_bytes, principal) VALUES (?, ?, ?, ?, ?, 1)",
                    [id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size]
                );
            }
            imagem = req.file.filename;
        }

        return res.status(200).json({ sucesso: true, mensagem: "Anúncio atualizado com sucesso!", imagem });

    } catch (erro) {
        descartarUpload();
        console.error("❌ Erro ao atualizar veículo:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro interno ao atualizar o anúncio." });
    }
});

// ==========================================
// DELETE /api/veiculos/:id — EXCLUIR (só o dono ou admin)
// ==========================================
router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        if (!(await podeGerenciar(req, id, true))) {
            return res.status(403).json({ sucesso: false, mensagem: "Você não tem permissão para excluir este anúncio." });
        }

        await db.query("DELETE FROM fotos_veiculos WHERE veiculo_id = ?", [id]);
        await db.query("DELETE FROM visualizacoes_anuncios WHERE veiculo_id = ?", [id]);
        const [resultado] = await db.query("DELETE FROM veiculos WHERE id = ?", [id]);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ sucesso: false, mensagem: "Veículo não encontrado para exclusão." });
        }
        return res.status(200).json({ sucesso: true, mensagem: "Anúncio excluído com sucesso!" });

    } catch (erro) {
        console.error("❌ Erro ao excluir veículo:", erro.sqlMessage || erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro interno ao excluir o anúncio." });
    }
});

module.exports = router;