const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");

const db = require("../config/db");

// ==========================================
// CONFIGURAÇÃO DO MULTER (UPLOAD DE FOTOS)
// ==========================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, "../../public/uploads"));
    },
    filename: function (req, file, cb) {
        const nomeLimpo = file.originalname.replace(/\s+/g, '_');
        const nomeArquivo = `${Date.now()}-${nomeLimpo}`;
        cb(null, nomeArquivo);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB por imagem
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos de imagem são permitidos!'), false);
        }
    }
});

// FUNÇÃO AUXILIAR PARA ARREDONDAR PREÇOS (Ex: múltiplo de 100)
function arredondarPreco(valor, casas = 100) {
    return Math.round(valor / casas) * casas;
}

// ==========================================
// ROTA: CADASTRAR VEÍCULO COM FOTO (POST /api/veiculos)
// ==========================================
router.post("/", upload.single("imagem"), async (req, res) => {
    try {
        const {
            usuario_id,
            marca,       
            modelo,      
            versao,
            ano_fabricacao,
            ano_modelo,
            preco,
            quilometragem,
            combustivel, 
            cambio,      
            cor,
            portas,
            carroceria,
            descricao
        } = req.body;

        if (!usuario_id || !marca || !modelo || !ano_fabricacao || !ano_modelo || !preco) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Preencha todos os campos obrigatórios (usuario_id, marca, modelo, anos e preço)."
            });
        }

        const precoNumerico = Number(preco);
        if (isNaN(precoNumerico) || precoNumerico <= 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "O preço informado é inválido."
            });
        }
        const precoArredondado = arredondarPreco(precoNumerico, 100);

        const marcaFormatada = marca.trim();
        const modeloFormatado = modelo.trim();

        // 1. RESOLVER MARCA_ID
        let marcaId;
        const [marcaRows] = await db.query("SELECT id FROM marca WHERE LOWER(nome) = LOWER(?)", [marcaFormatada]);
        if (marcaRows.length > 0) {
            marcaId = marcaRows[0].id;
        } else {
            const [novaMarca] = await db.query("INSERT INTO marca (nome) VALUES (?)", [marcaFormatada]);
            marcaId = novaMarca.insertId;
        }

        // 2. RESOLVER MODELO_ID
        let modeloId;
        const [modeloRows] = await db.query("SELECT id FROM modelo WHERE marca_id = ? AND LOWER(nome) = LOWER(?)", [marcaId, modeloFormatado]);
        if (modeloRows.length > 0) {
            modeloId = modeloRows[0].id;
        } else {
            const [novoModelo] = await db.query("INSERT INTO modelo (marca_id, nome) VALUES (?, ?)", [marcaId, modeloFormatado]);
            modeloId = novoModelo.insertId;
        }

        // 3. RESOLVER TIPO_COMBUSTIVEL_ID
        let combustivelId = 3; 
        if (combustivel !== undefined && combustivel !== '') {
            if (!isNaN(combustivel)) {
                combustivelId = Number(combustivel);
            } else {
                const [combRows] = await db.query("SELECT id FROM tipo_combustivel WHERE LOWER(nome) = LOWER(?)", [combustivel.trim()]);
                if (combRows.length > 0) combustivelId = combRows[0].id;
            }
        }

        // 4. RESOLVER TIPO_TRANSMISSAO_ID
        let transmissaoId = 1; 
        if (cambio !== undefined && cambio !== '') {
            if (!isNaN(cambio)) {
                transmissaoId = Number(cambio);
            } else {
                const [transRows] = await db.query("SELECT id FROM tipo_transmissao WHERE LOWER(nome) = LOWER(?)", [cambio.trim()]);
                if (transRows.length > 0) transmissaoId = transRows[0].id;
            }
        }

        // 5. INSERIR O VEÍCULO
        const [resultado] = await db.query(
            `
            INSERT INTO veiculos
            (
                usuario_id,
                marca_id,
                modelo_id,
                versao,
                ano_fabricacao,
                ano_modelo,
                preco,
                quilometragem,
                tipo_combustivel_id,
                tipo_transmissao_id,
                cor,
                portas,
                carroceria,
                descricao,
                status_anuncio_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `,
            [
                usuario_id,
                marcaId,
                modeloId,
                versao ? versao.trim() : null,
                Number(ano_fabricacao),
                Number(ano_modelo),
                precoArredondado,
                quilometragem ? Number(quilometragem) : 0,
                combustivelId,
                transmissaoId,
                cor ? cor.trim() : null,
                portas ? Number(portas) : null,
                carroceria ? carroceria.trim() : null,
                descricao ? descricao.trim() : null
            ]
        );

        const veiculoId = resultado.insertId;

        // 6. SALVAR FOTO SE HOUVER
        if (req.file) {
            await db.query(
                `
                INSERT INTO fotos_veiculos
                (veiculo_id, imagem, principal)
                VALUES (?, ?, ?)
                `,
                [veiculoId, req.file.filename, true]
            );
        }

        return res.status(201).json({
            sucesso: true,
            mensagem: "Veículo publicado com sucesso!",
            precoFinal: precoArredondado
        });

    } catch (erro) {
        console.error("❌ Erro ao cadastrar veículo:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno no servidor ao cadastrar veículo."
        });
    }
});

// ==========================================
// ROTA: LISTAR TODOS OS VEÍCULOS (GET /api/veiculos)
// ==========================================
router.get("/", async (req, res) => {
    try {
        const [veiculos] = await db.query(
            `
            SELECT 
                veiculos.*,
                marca.nome AS marca_nome,
                modelo.nome AS modelo_nome,
                fotos_veiculos.imagem AS imagem
            FROM veiculos
            LEFT JOIN marca ON marca.id = veiculos.marca_id
            LEFT JOIN modelo ON modelo.id = veiculos.modelo_id
            LEFT JOIN fotos_veiculos
            ON fotos_veiculos.veiculo_id = veiculos.id
            AND fotos_veiculos.principal = true
            ORDER BY veiculos.id DESC
            `
        );

        return res.status(200).json({
            sucesso: true,
            veiculos
        });

    } catch (erro) {
        console.error("❌ Erro ao listar veículos:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar veículos."
        });
    }
});

// ==========================================
// ROTA: LISTAR VEÍCULOS DE UM USUÁRIO COM VISUALIZAÇÕES (GET /api/veiculos/usuario/:usuarioId)
// ==========================================
router.get("/usuario/:usuarioId", async (req, res) => {
    const { usuarioId } = req.params;

    try {
        const [veiculos] = await db.query(
            `
            SELECT 
                veiculos.*,
                marca.nome AS marca,
                modelo.nome AS modelo,
                fotos_veiculos.imagem AS imagem,
                (
                    SELECT COUNT(DISTINCT usuario_id) 
                    FROM visualizacoes_anuncios 
                    WHERE visualizacoes_anuncios.veiculo_id = veiculos.id
                ) AS total_visualizacoes
            FROM veiculos
            LEFT JOIN marca ON marca.id = veiculos.marca_id
            LEFT JOIN modelo ON modelo.id = veiculos.modelo_id
            LEFT JOIN fotos_veiculos
            ON fotos_veiculos.veiculo_id = veiculos.id
            AND fotos_veiculos.principal = true
            WHERE veiculos.usuario_id = ?
            ORDER BY veiculos.id DESC
            `,
            [usuarioId]
        );

        return res.status(200).json({
            sucesso: true,
            veiculos
        });

    } catch (erro) {
        console.error("❌ Erro ao buscar veículos do usuário:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar os anúncios do usuário."
        });
    }
});

// ==========================================
// ROTA: REGISTAR VISUALIZAÇÃO DE UM ANÚNCIO (POST /api/veiculos/:id/visualizar)
// ==========================================
router.post("/:id/visualizar", async (req, res) => {
    const { id } = req.params;
    const { usuario_id } = req.body;

    if (!usuario_id) {
        return res.status(400).json({ sucesso: false, mensagem: "Usuário não autenticado." });
    }

    try {
        await db.query(
            `INSERT IGNORE INTO visualizacoes_anuncios (veiculo_id, usuario_id) VALUES (?, ?)`,
            [id, usuario_id]
        );

        return res.status(200).json({ sucesso: true });
    } catch (erro) {
        console.error("❌ Erro ao registar visualização:", erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro interno ao registar visualização." });
    }
});

// ==========================================
// ROTA: BUSCAR UM VEÍCULO POR ID (GET /api/veiculos/:id)
// ==========================================
router.get("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const [veiculos] = await db.query(
            `
            SELECT 
                veiculos.*,
                marca.nome AS marca,
                modelo.nome AS modelo,
                fotos_veiculos.imagem AS imagem
            FROM veiculos
            LEFT JOIN marca ON marca.id = veiculos.marca_id
            LEFT JOIN modelo ON modelo.id = veiculos.modelo_id
            LEFT JOIN fotos_veiculos
            ON fotos_veiculos.veiculo_id = veiculos.id
            AND fotos_veiculos.principal = true
            WHERE veiculos.id = ?
            `,
            [id]
        );

        if (veiculos.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Veículo não encontrado."
            });
        }

        return res.status(200).json({
            sucesso: true,
            veiculo: veiculos[0]
        });

    } catch (erro) {
        console.error("❌ Erro ao buscar veículo por ID:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar os dados do veículo."
        });
    }
});

// ==========================================
// ROTA: ATUALIZAR VEÍCULO (PUT /api/veiculos/:id)
// ==========================================
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { 
        marca, 
        modelo, 
        versao, 
        ano_fabricacao, 
        ano_modelo, 
        preco, 
        quilometragem,
        combustivel,
        cambio,
        cor,
        portas,
        carroceria,
        descricao
    } = req.body;

    try {
        let precoArredondado = null;
        
        if (preco !== undefined && preco !== null && preco !== '' && preco !== 'NaN') {
            const precoLimpo = String(preco).replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
            const precoNumerico = Number(precoLimpo);
            
            if (!isNaN(precoNumerico) && precoNumerico > 0) {
                precoArredondado = arredondarPreco(precoNumerico, 100);
            }
        }

        if (!precoArredondado || precoArredondado <= 0) {
            const [veiculoAtual] = await db.query("SELECT preco FROM veiculos WHERE id = ?", [id]);
            if (veiculoAtual.length > 0) {
                precoArredondado = veiculoAtual[0].preco;
            }
        }

        const marcaFormatada = marca ? marca.trim() : '';
        const modeloFormatado = modelo ? modelo.trim() : '';

        // 2. Resolver marca_id
        let marcaId;
        const [marcaRows] = await db.query("SELECT id FROM marca WHERE LOWER(nome) = LOWER(?)", [marcaFormatada]);
        if (marcaRows.length > 0) {
            marcaId = marcaRows[0].id;
        } else {
            const [novaMarca] = await db.query("INSERT INTO marca (nome) VALUES (?)", [marcaFormatada]);
            marcaId = novaMarca.insertId;
        }

        // 3. Resolver modelo_id
        let modeloId;
        const [modeloRows] = await db.query("SELECT id FROM modelo WHERE marca_id = ? AND LOWER(nome) = LOWER(?)", [marcaId, modeloFormatado]);
        if (modeloRows.length > 0) {
            modeloId = modeloRows[0].id;
        } else {
            const [novoModelo] = await db.query("INSERT INTO modelo (marca_id, nome) VALUES (?, ?)", [marcaId, modeloFormatado]);
            modeloId = novoModelo.insertId;
        }

        // 4. Resolver combustível
        let combustivelId = 3;
        if (combustivel !== undefined && combustivel !== '') {
            if (!isNaN(combustivel)) {
                combustivelId = Number(combustivel);
            } else {
                const [combRows] = await db.query("SELECT id FROM tipo_combustivel WHERE LOWER(nome) = LOWER(?)", [combustivel.trim()]);
                if (combRows.length > 0) combustivelId = combRows[0].id;
            }
        }

        // 5. Resolver transmissão
        let transmissaoId = 1;
        if (cambio !== undefined && cambio !== '') {
            if (!isNaN(cambio)) {
                transmissaoId = Number(cambio);
            } else {
                const [transRows] = await db.query("SELECT id FROM tipo_transmissao WHERE LOWER(nome) = LOWER(?)", [cambio.trim()]);
                if (transRows.length > 0) transmissaoId = transRows[0].id;
            }
        }

        // 6. Atualizar todos os campos na tabela principal
        const [resultado] = await db.query(
            `
            UPDATE veiculos 
            SET 
                marca_id = ?, 
                modelo_id = ?, 
                versao = ?, 
                ano_fabricacao = ?, 
                ano_modelo = ?, 
                preco = ?, 
                quilometragem = ?,
                tipo_combustivel_id = ?,
                tipo_transmissao_id = ?,
                cor = ?,
                portas = ?,
                carroceria = ?,
                descricao = ?
            WHERE id = ?
            `,
            [
                marcaId,
                modeloId,
                versao ? versao.trim() : null,
                ano_fabricacao ? Number(ano_fabricacao) : null,
                ano_modelo ? Number(ano_modelo) : null,
                precoArredondado,
                quilometragem ? Number(quilometragem) : 0,
                combustivelId,
                transmissaoId,
                cor ? cor.trim() : null,
                portas ? Number(portas) : null,
                carroceria ? carroceria.trim() : null,
                descricao ? descricao.trim() : null,
                id
            ]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Veículo não encontrado para atualização."
            });
        }

        return res.status(200).json({
            sucesso: true,
            mensagem: "Anúncio atualizado com sucesso!"
        });

    } catch (erro) {
        console.error("❌ Erro ao atualizar veículo:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno ao atualizar o anúncio."
        });
    }
});

// ==========================================
// ROTA: EXCLUIR VEÍCULO (DELETE /api/veiculos/:id)
// ==========================================
router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        // Opcional: remover fotos associadas antes ou confiar no ON DELETE CASCADE da base de dados
        await db.query("DELETE FROM fotos_veiculos WHERE veiculo_id = ?", [id]);
        await db.query("DELETE FROM visualizacoes_anuncios WHERE veiculo_id = ?", [id]);
        
        const [resultado] = await db.query("DELETE FROM veiculos WHERE id = ?", [id]);

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Veículo não encontrado para exclusão."
            });
        }

        return res.status(200).json({
            sucesso: true,
            mensagem: "Anúncio excluído com sucesso!"
        });

    } catch (erro) {
        console.error("❌ Erro ao excluir veículo:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno ao excluir o anúncio."
        });
    }
});

module.exports = router;