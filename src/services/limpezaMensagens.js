"use strict";

const db = require("../config/db");

const DEZ_DIAS_EM_SQL =
    "NOW() - INTERVAL 10 DAY";

const INTERVALO_LIMPEZA =
    1000 * 60 * 60 * 6; // 6 horas

const ATRASO_INICIAL =
    1000 * 15; // 15 segundos

const NOME_TRAVA =
    "motorflex_limpeza_mensagens";

let limpezaEmExecucao = false;
let temporizadorInicial = null;
let temporizadorIntervalo = null;

// ==========================================
// LIMPAR MENSAGENS ANTIGAS
// ==========================================
async function limparMensagensAntigas() {
    if (limpezaEmExecucao) {
        return;
    }

    limpezaEmExecucao = true;

    let conexao;
    let possuiTrava = false;

    try {
        conexao =
            await db.getConnection();

        /*
         * Impede que dois servidores executem
         * a limpeza ao mesmo tempo.
         */
        const [resultadoTrava] =
            await conexao.query(
                `SELECT
                    GET_LOCK(?, 0) AS obteve_trava`,
                [NOME_TRAVA]
            );

        possuiTrava =
            Number(
                resultadoTrava[0]
                    ?.obteve_trava
            ) === 1;

        if (!possuiTrava) {
            console.log(
                "🧹 A limpeza das mensagens já está sendo executada por outro processo."
            );

            return;
        }

        await conexao.beginTransaction();

        /*
         * Remove todas as mensagens com mais
         * de 10 dias.
         *
         * As linhas relacionadas na tabela
         * mensagens_exclusoes serão apagadas
         * automaticamente pelo ON DELETE CASCADE.
         */
        const [mensagensRemovidas] =
            await conexao.query(
                `DELETE FROM mensagens_conversa
                 WHERE criado_em < ${DEZ_DIAS_EM_SQL}`
            );

        /*
         * Remove conversas antigas que ficaram
         * completamente vazias.
         */
        const [conversasRemovidas] =
            await conexao.query(
                `DELETE c

                 FROM mensagens c

                 LEFT JOIN mensagens_conversa mc
                   ON mc.conversa_id = c.id

                 WHERE mc.id IS NULL

                 AND COALESCE(
                        c.ultimo_envio,
                        c.criado_em
                 ) < ${DEZ_DIAS_EM_SQL}`
            );

        await conexao.commit();

        console.log(
            `🧹 Limpeza do chat concluída: ` +
            `${mensagensRemovidas.affectedRows} mensagem(ns) e ` +
            `${conversasRemovidas.affectedRows} conversa(s) antiga(s) removida(s).`
        );
    } catch (erro) {
        if (conexao) {
            try {
                await conexao.rollback();
            } catch (erroRollback) {
                console.error(
                    "❌ Erro ao desfazer a limpeza das mensagens:",
                    erroRollback.message
                );
            }
        }

        console.error(
            "❌ Erro ao limpar mensagens antigas:",
            erro.sqlMessage ||
            erro.message ||
            erro
        );
    } finally {
        if (
            conexao &&
            possuiTrava
        ) {
            try {
                await conexao.query(
                    "SELECT RELEASE_LOCK(?)",
                    [NOME_TRAVA]
                );
            } catch (erroTrava) {
                console.error(
                    "⚠️ Não foi possível liberar a trava da limpeza:",
                    erroTrava.message
                );
            }
        }

        if (conexao) {
            conexao.release();
        }

        limpezaEmExecucao = false;
    }
}

// ==========================================
// INICIAR AGENDADOR
// ==========================================
function iniciarLimpezaMensagens() {
    if (
        temporizadorInicial ||
        temporizadorIntervalo
    ) {
        return;
    }

    console.log(
        "⏳ Limpeza automática das mensagens configurada para cada 6 horas."
    );

    /*
     * Primeira limpeza:
     * acontece 15 segundos após o servidor iniciar.
     */
    temporizadorInicial =
        setTimeout(
            async () => {
                temporizadorInicial = null;

                await limparMensagensAntigas();
            },
            ATRASO_INICIAL
        );

    /*
     * Próximas limpezas:
     * acontecem de 6 em 6 horas.
     */
    temporizadorIntervalo =
        setInterval(
            limparMensagensAntigas,
            INTERVALO_LIMPEZA
        );

    /*
     * Permite que o Node encerre normalmente
     * mesmo com os temporizadores ativos.
     */
    temporizadorInicial.unref?.();
    temporizadorIntervalo.unref?.();
}

// ==========================================
// PARAR AGENDADOR
// ==========================================
function pararLimpezaMensagens() {
    if (temporizadorInicial) {
        clearTimeout(
            temporizadorInicial
        );

        temporizadorInicial = null;
    }

    if (temporizadorIntervalo) {
        clearInterval(
            temporizadorIntervalo
        );

        temporizadorIntervalo = null;
    }
}

module.exports = {
    iniciarLimpezaMensagens,
    pararLimpezaMensagens,
    limparMensagensAntigas
};