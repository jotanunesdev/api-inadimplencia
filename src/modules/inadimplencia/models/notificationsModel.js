import { getPool, sql } from "../config/db";

const TABLE_INAD = "DW.fat_analise_inadimplencia_v4";
const TABLE_VENDA_RESP = "dbo.VENDA_RESPONSAVEL";
const TABLE_OC = "dbo.OCORRENCIAS";
const TABLE_KANBAN = "dbo.KANBAN_STATUS";

async function findVendasInadimplentesByUsername(username) {
    const pool = await getPool();
    const result = await pool
        .request()
        .input("username", sql.VarChar(255), username).query(`
        WITH UltimaOcorrencia AS (
            SELECT 
                NUM_VENDA_FK, 
                PROXIMA_ACAO,
                STATUS_OCORRENCIA,
                DT_OCORRENCIA,
                HORA_OCORRENCIA,
                ROW_NUMBER() OVER (
                    PARTITION BY NUM_VENDA_FK 
                    ORDER BY DT_OCORRENCIA DESC, HORA_OCORRENCIA DESC, ID DESC
                ) as RN
            FROM ${TABLE_OC}
        ),
        UltimoKanban AS (
            SELECT 
                NUM_VENDA_FK, 
                NOME_USUARIO_FK,
                STATUS, 
                PROXIMA_ACAO,
                DT_ATUALIZACAO,
                ROW_NUMBER() OVER (
                    PARTITION BY NUM_VENDA_FK, NOME_USUARIO_FK 
                    ORDER BY DT_ATUALIZACAO DESC
                ) as RN
            FROM ${TABLE_KANBAN}
        )
        SELECT
            i.NUM_VENDA,
            i.CLIENTE,
            i.CPF_CNPJ,
            i.EMPREENDIMENTO,
            i.VALOR_INADIMPLENTE,
            r.NOME_USUARIO_FK AS RESPONSAVEL,
            r.DT_ATRIBUICAO,
            
            oc.PROXIMA_ACAO AS PROXIMA_ACAO,
            oc.STATUS_OCORRENCIA AS STATUS_OCORRENCIA,
            oc.DT_OCORRENCIA AS DT_OCORRENCIA,
            
            kb.STATUS AS KANBAN_STATUS,
            kb.DT_ATUALIZACAO AS KANBAN_DATA

        FROM ${TABLE_INAD} i      

        INNER JOIN ${TABLE_VENDA_RESP} r
            ON r.NUM_VENDA_FK = i.NUM_VENDA

        LEFT JOIN UltimaOcorrencia oc
            ON oc.NUM_VENDA_FK = i.NUM_VENDA 
            AND oc.RN = 1

        LEFT JOIN UltimoKanban kb
            ON kb.NUM_VENDA_FK = i.NUM_VENDA 
            AND kb.NOME_USUARIO_FK = r.NOME_USUARIO_FK
            AND kb.RN = 1

        WHERE 
            LOWER(LTRIM(RTRIM(r.NOME_USUARIO_FK))) = LOWER(LTRIM(RTRIM(@username)))
            AND i.QTD_PARCELAS_INADIMPLENTES > 0  

        ORDER BY i.NUM_VENDA;
    `);

    return result.recordset;
}

async function getInadimplenciaNotificationSnapshot(username) {
    const vendas = await findVendasInadimplentesByUsername(username);

    const notifications = vendas.map((venda) => {
        const dataNotificacao = venda.DT_ATRIBUICAO || "";

        const statusAtual = venda.KANBAN_STATUS || "todo";

        return {
            id: `inadimplencia-${venda.NUM_VENDA}`, // ID único para o snapshot
            tipo: "venda_inadimplente",
            numVenda: venda.NUM_VENDA,
            cliente: venda.CLIENTE ? venda.CLIENTE.trim() : "N/A",
            cpfCnpj: venda.CPF_CNPJ,
            empreendimento: venda.EMPREENDIMENTO,
            proximaAcao: venda.PROXIMA_ACAO || "Definir ação",
            status: statusAtual,
            valorInadimplente: venda.VALOR_INADIMPLENTE || 0,
            createdAt: dataNotificacao,
            lida: false,
        };
    });

    return {
        generatedAt: new Date().toISOString(),
        username,
        notifications,
        unreadCount: notifications.length,
    };
}

module.exports = {
    getInadimplenciaNotificationSnapshot,
};
