const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");

const db = require("../config/db");

// CONFIGURAÇÃO DO MULTER
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, "../../public/uploads"));
    },
    filename: function (req, file, cb) {
        const nomeArquivo = Date.now() + "-" + file.originalname;
        cb(null, nomeArquivo);
    }
});

const upload = multer({ storage });

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

        // VALIDAÇÃO E ARREDONDAMENTO DO PREÇO
        const precoNumerico = Number(preco);
        if (isNaN(precoNumerico) || precoNumerico <= 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "O preço informado é inválido."
            });
        }
        const precoArredondado = arredondarPreco(precoNumerico, 100);

        // 1. RESOLVER MARCA_ID
        let marcaId;
        const [marcaRows] = await db.query("SELECT id FROM marca WHERE LOWER(nome) = LOWER(?)", [marca]);
        if (marcaRows.length > 0) {
            marcaId = marcaRows[0].id;
        } else {
            const [novaMarca] = await db.query("INSERT INTO marca (nome) VALUES (?)", [marca]);
            marcaId = novaMarca.insertId;
        }

        // 2. RESOLVER MODELO_ID
        let modeloId;
        const [modeloRows] = await db.query("SELECT id FROM modelo WHERE marca_id = ? AND LOWER(nome) = LOWER(?)", [marcaId, modelo]);
        if (modeloRows.length > 0) {
            modeloId = modeloRows[0].id;
        } else {
            const [novoModelo] = await db.query("INSERT INTO modelo (marca_id, nome) VALUES (?, ?)", [marcaId, modelo]);
            modeloId = novoModelo.insertId;
        }

        // 3. RESOLVER TIPO_COMBUSTIVEL_ID
        let combustivelId = 3; 
        if (combustivel) {
            if (!isNaN(combustivel)) {
                combustivelId = combustivel;
            } else {
                const [combRows] = await db.query("SELECT id FROM tipo_combustivel WHERE LOWER(nome) = LOWER(?)", [combustivel]);
                if (combRows.length > 0) combustivelId = combRows[0].id;
            }
        }

        // 4. RESOLVER TIPO_TRANSMISSAO_ID
        let transmissaoId = 1; 
        if (cambio) {
            if (!isNaN(cambio)) {
                transmissaoId = cambio;
            } else {
                const [transRows] = await db.query("SELECT id FROM tipo_transmissao WHERE LOWER(nome) = LOWER(?)", [cambio]);
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
                versao || null,
                ano_fabricacao,
                ano_modelo,
                precoArredondado,
                quilometragem || 0,
                combustivelId,
                transmissaoId,
                cor || null,
                portas || null,
                carroceria || null,
                descricao || null
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
        console.error("Erro ao cadastrar veículo:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno no servidor."
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
        console.error("Erro ao listar veículos:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar veículos."
        });
    }
});

// ==========================================
// ROTA: LISTAR VEÍCULOS DE UM USUÁRIO (GET /api/veiculos/usuario/:usuarioId)
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
                fotos_veiculos.imagem AS imagem
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
        console.error("Erro ao buscar veículos do usuário:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar os anúncios do usuário."
        });
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
        console.error("Erro ao buscar veículo por ID:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar os dados do veículo."
        });
    }
});

// ==========================================
// ROTA: ATUALIZAR VEÍCULO (PUT /api/veiculos/:id)  <-- ESTA É A ROTA DE EDIÇÃO
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
        // 1. Tratamento e limpeza rigorosa do preço enviado pelo front-end
        let precoArredondado = null;
        
        if (preco !== undefined && preco !== null && preco !== '' && preco !== 'NaN') {
            const precoLimpo = String(preco).replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
            const precoNumerico = Number(precoLimpo);
            
            if (!isNaN(precoNumerico) && precoNumerico > 0) {
                precoArredondado = arredondarPreco(precoNumerico, 100);
            }
        }

        // Se o preço veio nulo ou inválido, busca o preço atual no banco para preservar e nunca zerar
        if (!precoArredondado || precoArredondado <= 0) {
            const [veiculoAtual] = await db.query("SELECT preco FROM veiculos WHERE id = ?", [id]);
            if (veiculoAtual.length > 0) {
                precoArredondado = veiculoAtual[0].preco;
            }
        }

        // 2. Resolver marca_id
        let marcaId;
        const [marcaRows] = await db.query("SELECT id FROM marca WHERE LOWER(nome) = LOWER(?)", [marca]);
        if (marcaRows.length > 0) {
            marcaId = marcaRows[0].id;
        } else {
            const [novaMarca] = await db.query("INSERT INTO marca (nome) VALUES (?)", [marca]);
            marcaId = novaMarca.insertId;
        }

        // 3. Resolver modelo_id
        let modeloId;
        const [modeloRows] = await db.query("SELECT id FROM modelo WHERE marca_id = ? AND LOWER(nome) = LOWER(?)", [marcaId, modelo]);
        if (modeloRows.length > 0) {
            modeloId = modeloRows[0].id;
        } else {
            const [novoModelo] = await db.query("INSERT INTO modelo (marca_id, nome) VALUES (?, ?)", [marcaId, modelo]);
            modeloId = novoModelo.insertId;
        }

        // 4. Resolver combustível
        let combustivelId = 3;
        if (combustivel) {
            if (!isNaN(combustivel)) {
                combustivelId = combustivel;
            } else {
                const [combRows] = await db.query("SELECT id FROM tipo_combustivel WHERE LOWER(nome) = LOWER(?)", [combustivel]);
                if (combRows.length > 0) combustivelId = combRows[0].id;
            }
        }

        // 5. Resolver transmissão
        let transmissaoId = 1;
        if (cambio) {
            if (!isNaN(cambio)) {
                transmissaoId = cambio;
            } else {
                const [transRows] = await db.query("SELECT id FROM tipo_transmissao WHERE LOWER(nome) = LOWER(?)", [cambio]);
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
                versao || null,
                ano_fabricacao,
                ano_modelo,
                precoArredondado,
                quilometragem || 0,
                combustivelId,
                transmissaoId,
                cor || null,
                portas || null,
                carroceria || null,
                descricao || null,
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
        console.error("Erro ao atualizar veículo:", erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno ao atualizar o anúncio."
        });
    }
});

// EXPORTAÇÃO CORRETA
module.exports = router;