const cron = require('node-cron');
const nodemailer = require('nodemailer');

// Importa o banco de dados de forma segura
let db;
try {
    db = require('../config/db');
} catch (err) {
    console.error('❌ [CRON ERROR] Não foi possível carregar a conexão com o banco:', err.message);
}

// Configuração do Nodemailer com verificação
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT == 465,
    auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || ''
    }
});

// Função para envio do e-mail
async function enviarEmailAvisoInatividade(email, nome, diasRestantes) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn(`⚠️ [EMAIL] Credenciais zeradas no .env. Envio ignorado para: ${email}`);
        return;
    }

    const urlLogin = process.env.URL_FRONTEND || 'http://localhost:4000';

    const mailOptions = {
        from: `"MotorFlex" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Aviso LGPD: Sua conta MotorFlex será desativada em ${diasRestantes} dias`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #2c3e50;">Olá, ${nome || 'Usuário'}!</h2>
                <p>Notamos que você não acessa sua conta no <strong>MotorFlex</strong> há bastante tempo.</p>
                <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                    <strong>Sua conta será desativada em ${diasRestantes} dias.</strong>
                </div>
                <p>Para mantê-la ativa, basta realizar o login na plataforma:</p>
                <div style="text-align: center; margin: 20px 0;">
                    <a href="${urlLogin}" style="background-color: #007bff; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Acessar Minha Conta</a>
                </div>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
}

// Função executora da rotina LGPD
async function executarRotinaInatividade() {
    console.log('⏳ [LGPD - MOTORFLEX] Verificando contas inativas...');

    if (!db) {
        console.error('❌ [LGPD] Abortado: Banco de dados indisponível.');
        return;
    }

    try {
        // 1. AVISO DE 60 DIAS (1765 dias de inatividade)
        const [usuarios60] = await db.query(`
            SELECT id, nome, email FROM usuarios 
            WHERE status = 'ativo' 
              AND ultimo_login <= NOW() - INTERVAL 1765 DAY
              AND aviso_inatividade_enviado = 'nenhum'
        `);

        for (const user of usuarios60) {
            try {
                await enviarEmailAvisoInatividade(user.email, user.nome, 60);
                await db.query(`
                    UPDATE usuarios 
                    SET aviso_inatividade_enviado = '60_dias', 
                        data_ultimo_aviso = NOW(), 
                        status = 'inactive_warning' 
                    WHERE id = ?
                `, [user.id]);
                await db.query(`INSERT INTO logs_avisos_inatividade (usuario_id, tipo_aviso) VALUES (?, '60_dias')`, [user.id]);
            } catch (e) {
                console.error(`❌ Erro no aviso de 60 dias (ID ${user.id}):`, e.message);
            }
        }

        // 2. AVISO DE 30 DIAS (1795 dias de inatividade)
        const [usuarios30] = await db.query(`
            SELECT id, nome, email FROM usuarios 
            WHERE status = 'inactive_warning' 
              AND ultimo_login <= NOW() - INTERVAL 1795 DAY
              AND aviso_inatividade_enviado = '60_dias'
        `);

        for (const user of usuarios30) {
            try {
                await enviarEmailAvisoInatividade(user.email, user.nome, 30);
                await db.query(`
                    UPDATE usuarios 
                    SET aviso_inatividade_enviado = '30_dias', 
                        data_ultimo_aviso = NOW() 
                    WHERE id = ?
                `, [user.id]);
                await db.query(`INSERT INTO logs_avisos_inatividade (usuario_id, tipo_aviso) VALUES (?, '30_dias')`, [user.id]);
            } catch (e) {
                console.error(`❌ Erro no aviso de 30 dias (ID ${user.id}):`, e.message);
            }
        }

        // 3. AVISO DE 7 DIAS (1818 dias de inatividade)
        const [usuarios7] = await db.query(`
            SELECT id, nome, email FROM usuarios 
            WHERE status = 'inactive_warning' 
              AND ultimo_login <= NOW() - INTERVAL 1818 DAY
              AND aviso_inatividade_enviado = '30_dias'
        `);

        for (const user of usuarios7) {
            try {
                await enviarEmailAvisoInatividade(user.email, user.nome, 7);
                await db.query(`
                    UPDATE usuarios 
                    SET aviso_inatividade_enviado = '7_dias', 
                        data_ultimo_aviso = NOW() 
                    WHERE id = ?
                `, [user.id]);
                await db.query(`INSERT INTO logs_avisos_inatividade (usuario_id, tipo_aviso) VALUES (?, '7_dias')`, [user.id]);
            } catch (e) {
                console.error(`❌ Erro no aviso de 7 dias (ID ${user.id}):`, e.message);
            }
        }

        // 4. SOFT DELETE (5 Anos / 1825 Dias de inatividade)
        const [softDeleteList] = await db.query(`
            SELECT id FROM usuarios 
            WHERE status = 'inactive_warning' 
              AND ultimo_login <= NOW() - INTERVAL 1825 DAY
        `);

        for (const user of softDeleteList) {
            await db.query(`
                UPDATE usuarios 
                SET status = 'inactive_expired', 
                    deleted_at = NOW(), 
                    senha = 'DELETED_ACCOUNT' 
                WHERE id = ?
            `, [user.id]);
        }

        // 5. HARD DELETE (30 dias após o Soft Delete)
        const [hardDeleteList] = await db.query(`
            SELECT id FROM usuarios 
            WHERE status = 'inactive_expired' 
              AND deleted_at <= NOW() - INTERVAL 30 DAY
        `);

        for (const user of hardDeleteList) {
            await db.query(`
                INSERT INTO audit_log (usuario_id, acao, tabela_afetada, registro_id) 
                VALUES (NULL, 'PURGA_HARD_DELETE_INATIVIDADE', 'usuarios', ?)
            `, [user.id]);
            await db.query(`DELETE FROM usuarios WHERE id = ?`, [user.id]);
        }

        console.log('✅ [LGPD - MOTORFLEX] Verificação concluída com sucesso.');
    } catch (err) {
        console.error('❌ Erro durante execução das consultas de inatividade:', err.message);
    }
}

// Agendamento diário automático às 03:00 da manhã
cron.schedule('0 3 * * *', () => {
    executarRotinaInatividade();
});

module.exports = { executarRotinaInatividade };