const { getPool, sql } = require('../config/db');

const TABLE_INAD = "DW.fat_analise_inadimplencia_v4";
const TABLE_VENDA_RESP = "dbo.VENDA_RESPONSAVEL";
const TABLE_KANBAN = "dbo.KANBAN_STATUS";

function normalizeString(value) {
    if (!value || typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
}

async function findOverdueSalesByUsername(username) {
    const normalizedString = normalizeString(username);

    if (!normalizedString) {
        return [];
    }

    const pool = await getPool();
    const result = await pool
        .request()
        .input('username', sql.VarChar(255), normalizedString)
        .query(`
            WITH UltimoKanban AS (
                SELECT
          ks.NUM_VENDA_FK,
          ks.NOME_USUARIO_FK,
          ks.STATUS,
          ks.PROXIMA_ACAO,
          ks.STATUS_DATA,
          ks.DT_ATUALIZACAO,
          ROW_NUMBER() OVER (
            PARTITION BY ks.NUM_VENDA_FK, ks.NOME_USUARIO_FK
            ORDER BY ks.DT_ATUALIZACAO DESC, ks.PROXIMA_ACAO DESC
          ) AS RN
        FROM ${TABLE_KANBAN} ks
      )
      SELECT
        i.NUM_VENDA,
        i.CLIENTE,
        i.CPF_CNPJ,
        i.EMPREENDIMENTO,
        i.VALOR_INADIMPLENTE,
        r.NOME_USUARIO_FK AS RESPONSAVEL,
        r.DT_ATRIBUICAO,
        kb.STATUS AS KANBAN_STATUS,
        kb.PROXIMA_ACAO,
        kb.STATUS_DATA,
        kb.DT_ATUALIZACAO
      FROM ${TABLE_INAD} i
      INNER JOIN ${TABLE_VENDA_RESP} r
        ON r.NUM_VENDA_FK = i.NUM_VENDA
      INNER JOIN UltimoKanban kb
        ON kb.NUM_VENDA_FK = i.NUM_VENDA
        AND kb.NOME_USUARIO_FK = r.NOME_USUARIO_FK
        AND kb.RN = 1
      WHERE LOWER(LTRIM(RTRIM(r.NOME_USUARIO_FK))) = @username
        AND LOWER(LTRIM(RTRIM(kb.STATUS))) = 'todo'
        AND kb.PROXIMA_ACAO IS NOT NULL
        AND CAST(kb.PROXIMA_ACAO AS date) < CAST(GETDATE() AS date)
      ORDER BY kb.PROXIMA_ACAO ASC, i.NUM_VENDA ASC;
    `);

    return result.recordset;
}

async function findAllOverdue({ username } = {}) {
    const pool = await getPool();
    
    let query = `
        WITH UltimoKanban AS (
            SELECT
      ks.NUM_VENDA_FK,
      ks.NOME_USUARIO_FK,
      ks.STATUS,
      ks.PROXIMA_ACAO,
      ks.STATUS_DATA,
      ks.DT_ATUALIZACAO,
      ROW_NUMBER() OVER (
        PARTITION BY ks.NUM_VENDA_FK, ks.NOME_USUARIO_FK
        ORDER BY ks.DT_ATUALIZACAO DESC, ks.PROXIMA_ACAO DESC
      ) AS RN
    FROM ${TABLE_KANBAN} ks
  )
  SELECT
    i.NUM_VENDA,
    i.CLIENTE,
    i.CPF_CNPJ,
    i.EMPREENDIMENTO,
    i.VALOR_INADIMPLENTE,
    r.NOME_USUARIO_FK AS RESPONSAVEL,
    r.DT_ATRIBUICAO,
    kb.STATUS AS KANBAN_STATUS,
    kb.PROXIMA_ACAO,
    kb.STATUS_DATA,
    kb.DT_ATUALIZACAO
  FROM ${TABLE_INAD} i
  INNER JOIN ${TABLE_VENDA_RESP} r
    ON r.NUM_VENDA_FK = i.NUM_VENDA
  INNER JOIN UltimoKanban kb
    ON kb.NUM_VENDA_FK = i.NUM_VENDA
    AND kb.NOME_USUARIO_FK = r.NOME_USUARIO_FK
    AND kb.RN = 1
  WHERE LOWER(LTRIM(RTRIM(kb.STATUS))) = 'todo'
    AND kb.PROXIMA_ACAO IS NOT NULL
    AND CAST(kb.PROXIMA_ACAO AS date) < CAST(GETDATE() AS date)
    `;

    const request = pool.request();

    if (username) {
        const normalizedUsername = normalizeString(username);
        query += `AND LOWER(LTRIM(RTRIM(r.NOME_USUARIO_FK))) = @username `;
        request.input('username', sql.VarChar(255), normalizedUsername);
    }

    query += `ORDER BY kb.PROXIMA_ACAO ASC, i.NUM_VENDA ASC;`;

    const result = await request.query(query);
    return result.recordset;
}

/**
 * @deprecated Use notificationService.getSnapshotForUser instead
 */
async function getInadimplenciaNotificationSnapshot(username) {
    const normalizedString = normalizeString(username);
    const vendas = await findOverdueSalesByUsername(normalizedString);

    const notifications = vendas.map((venda) => ({
        id: `sale-overdue-${venda.NUM_VENDA}`,
        type: 'sale_overdue',
        tipo: 'venda_inadimplente',
        numVenda: venda.NUM_VENDA,
        cliente: venda.CLIENTE ? String(venda.CLIENTE).trim() : 'N/A',
        cpfCnpj: venda.CPF_CNPJ ?? null,
        empreendimento: venda.EMPREENDIMENTO ?? null,
        responsavel: venda.RESPONSAVEL ?? null,
        proximaAcao: venda.PROXIMA_ACAO
        ? new Date(venda.PROXIMA_ACAO).toISOString()
        : null,
        status: venda.KANBAN_STATUS ?? 'todo',
        valorInadimplente: Number(venda.VALOR_INADIMPLENTE ?? 0),
        createdAt: venda.PROXIMA_ACAO
        ? new Date(venda.PROXIMA_ACAO).toISOString()
        : new Date().toISOString(),
        lida: false,
    }));


    return {
        generatedAt: new Date().toISOString(),
        username: normalizedString, notifications,
        unreadCount: notifications.length,
    }
}
module.exports = {
    getInadimplenciaNotificationSnapshot,
    findOverdueSalesByUsername,
    findAllOverdue,
};
