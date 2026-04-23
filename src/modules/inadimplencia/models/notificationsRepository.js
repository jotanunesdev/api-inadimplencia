const { getPool, sql } = require('../config/db');

const TABLE = 'dbo.INAD_NOTIFICACOES';

function normalizeUsername(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function buildResponsibilityVisibilityClause(alias = 'n') {
  return `(
    ${alias}.TIPO <> 'VENDA_ATRIBUIDA'
    OR EXISTS (
      SELECT 1
      FROM dbo.VENDA_RESPONSAVEL vr
      WHERE vr.NUM_VENDA_FK = ${alias}.NUM_VENDA
        AND LOWER(LTRIM(RTRIM(vr.NOME_USUARIO_FK))) = @username
    )
  )`;
}

async function insert({ tipo, usuarioDestinatario, origemUsuario, numVenda, proximaAcao, payload }) {
  const normalizedDestinatario = normalizeUsername(usuarioDestinatario);
  const normalizedOrigem = origemUsuario ? normalizeUsername(origemUsuario) : null;

  const pool = await getPool();
  const result = await pool
    .request()
    .input('tipo', sql.VarChar(32), tipo)
    .input('usuarioDestinatario', sql.VarChar(255), normalizedDestinatario)
    .input('origemUsuario', sql.VarChar(255), normalizedOrigem)
    .input('numVenda', sql.Int, numVenda)
    .input('proximaAcao', sql.DateTime, proximaAcao || null)
    .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(payload))
    .query(`
      INSERT INTO ${TABLE} (
        TIPO,
        USUARIO_DESTINATARIO,
        ORIGEM_USUARIO,
        NUM_VENDA,
        PROXIMA_ACAO,
        PAYLOAD
      )
      OUTPUT
        INSERTED.ID,
        INSERTED.TIPO,
        INSERTED.USUARIO_DESTINATARIO,
        INSERTED.ORIGEM_USUARIO,
        INSERTED.NUM_VENDA,
        INSERTED.PROXIMA_ACAO,
        INSERTED.PAYLOAD,
        INSERTED.LIDA,
        INSERTED.DT_CRIACAO,
        INSERTED.DT_LEITURA,
        INSERTED.DT_EXCLUSAO
      VALUES (
        @tipo,
        @usuarioDestinatario,
        @origemUsuario,
        @numVenda,
        @proximaAcao,
        @payload
      )
    `);

  return result.recordset[0];
}

async function findById(id, username) {
  const normalizedUsername = normalizeUsername(username);

  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .input('username', sql.VarChar(255), normalizedUsername)
    .query(`
      SELECT
        ID,
        TIPO,
        USUARIO_DESTINATARIO,
        ORIGEM_USUARIO,
        NUM_VENDA,
        PROXIMA_ACAO,
        PAYLOAD,
        LIDA,
        DT_CRIACAO,
        DT_LEITURA,
        DT_EXCLUSAO
      FROM ${TABLE}
      WHERE ID = @id
        AND USUARIO_DESTINATARIO = @username
        AND DT_EXCLUSAO IS NULL
    `);

  return result.recordset[0] || null;
}

async function findByDedupeKey({ tipo, usuarioDestinatario, numVenda, proximaAcao }) {
  const normalizedDestinatario = normalizeUsername(usuarioDestinatario);

  const pool = await getPool();
  const result = await pool
    .request()
    .input('tipo', sql.VarChar(32), tipo)
    .input('usuarioDestinatario', sql.VarChar(255), normalizedDestinatario)
    .input('numVenda', sql.Int, numVenda)
    .input('proximaAcao', sql.DateTime, proximaAcao)
    .query(`
      SELECT
        ID,
        TIPO,
        USUARIO_DESTINATARIO,
        ORIGEM_USUARIO,
        NUM_VENDA,
        PROXIMA_ACAO,
        PAYLOAD,
        LIDA,
        DT_CRIACAO,
        DT_LEITURA,
        DT_EXCLUSAO
      FROM ${TABLE}
      WHERE TIPO = @tipo
        AND USUARIO_DESTINATARIO = @usuarioDestinatario
        AND NUM_VENDA = @numVenda
        AND PROXIMA_ACAO_DIA = CAST(@proximaAcao AS date)
        AND DT_EXCLUSAO IS NULL
    `);

  return result.recordset[0] || null;
}

async function listPaginated({ username, page = 1, pageSize = 20, lida }) {
  const normalizedUsername = normalizeUsername(username);
  const offset = (page - 1) * pageSize;

  const pool = await getPool();
  
  let lidaFilter = '';
  if (lida !== undefined) {
    lidaFilter = `AND LIDA = ${lida ? 1 : 0}`;
  }

  const result = await pool
    .request()
    .input('username', sql.VarChar(255), normalizedUsername)
    .input('offset', sql.Int, offset)
    .input('pageSize', sql.Int, pageSize)
    .query(`
      ;WITH CountCTE AS (
        SELECT COUNT(*) as Total
        FROM ${TABLE}
        WHERE USUARIO_DESTINATARIO = @username
          AND DT_EXCLUSAO IS NULL
          ${lidaFilter}
      ),
      UnreadCTE AS (
        SELECT COUNT(*) as UnreadCount
        FROM ${TABLE}
        WHERE USUARIO_DESTINATARIO = @username
          AND LIDA = 0
          AND DT_EXCLUSAO IS NULL
      )
      SELECT
        n.ID,
        n.TIPO,
        n.USUARIO_DESTINATARIO,
        n.ORIGEM_USUARIO,
        n.NUM_VENDA,
        n.PROXIMA_ACAO,
        n.PAYLOAD,
        n.LIDA,
        n.DT_CRIACAO,
        n.DT_LEITURA,
        n.DT_EXCLUSAO,
        c.Total,
        u.UnreadCount
      FROM ${TABLE} n
      CROSS JOIN CountCTE c
      CROSS JOIN UnreadCTE u
      WHERE n.USUARIO_DESTINATARIO = @username
        AND n.DT_EXCLUSAO IS NULL
        ${lidaFilter}
      ORDER BY n.LIDA ASC, n.DT_CRIACAO DESC
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `);

  const rows = result.recordset;
  const total = rows[0]?.Total || 0;
  const unreadCount = rows[0]?.UnreadCount || 0;

  return { rows, total, unreadCount };
}

async function listUnread({ username, limit = 20 }) {
  const normalizedUsername = normalizeUsername(username);

  const pool = await getPool();
  const result = await pool
    .request()
    .input('username', sql.VarChar(255), normalizedUsername)
    .input('limit', sql.Int, limit)
    .query(`
      ;WITH UnreadCTE AS (
        SELECT COUNT(*) as TotalUnread
        FROM ${TABLE}
        WHERE USUARIO_DESTINATARIO = @username
          AND LIDA = 0
          AND DT_EXCLUSAO IS NULL
      )
      SELECT
        n.ID,
        n.TIPO,
        n.USUARIO_DESTINATARIO,
        n.ORIGEM_USUARIO,
        n.NUM_VENDA,
        n.PROXIMA_ACAO,
        n.PAYLOAD,
        n.LIDA,
        n.DT_CRIACAO,
        n.DT_LEITURA,
        n.DT_EXCLUSAO,
        u.TotalUnread
      FROM ${TABLE} n
      CROSS JOIN UnreadCTE u
      WHERE n.USUARIO_DESTINATARIO = @username
        AND n.LIDA = 0
        AND n.DT_EXCLUSAO IS NULL
      ORDER BY n.DT_CRIACAO DESC
      OFFSET 0 ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

  const rows = result.recordset;
  const totalUnread = rows[0]?.TotalUnread || 0;

  return { rows, totalUnread };
}

async function listPaginatedForCurrentResponsibility({ username, page = 1, pageSize = 20, lida }) {
  const normalizedUsername = normalizeUsername(username);
  const offset = (page - 1) * pageSize;

  const pool = await getPool();

  let lidaFilter = '';
  if (lida !== undefined) {
    lidaFilter = `AND n.LIDA = ${lida ? 1 : 0}`;
  }

  const responsibilityClause = buildResponsibilityVisibilityClause('n');

  const result = await pool
    .request()
    .input('username', sql.VarChar(255), normalizedUsername)
    .input('offset', sql.Int, offset)
    .input('pageSize', sql.Int, pageSize)
    .query(`
      ;WITH CountCTE AS (
        SELECT COUNT(*) as Total
        FROM ${TABLE} n
        WHERE n.USUARIO_DESTINATARIO = @username
          AND n.DT_EXCLUSAO IS NULL
          AND ${responsibilityClause}
          ${lidaFilter}
      ),
      UnreadCTE AS (
        SELECT COUNT(*) as UnreadCount
        FROM ${TABLE} n
        WHERE n.USUARIO_DESTINATARIO = @username
          AND n.LIDA = 0
          AND n.DT_EXCLUSAO IS NULL
          AND ${responsibilityClause}
      )
      SELECT
        n.ID,
        n.TIPO,
        n.USUARIO_DESTINATARIO,
        n.ORIGEM_USUARIO,
        n.NUM_VENDA,
        n.PROXIMA_ACAO,
        n.PAYLOAD,
        n.LIDA,
        n.DT_CRIACAO,
        n.DT_LEITURA,
        n.DT_EXCLUSAO,
        c.Total,
        u.UnreadCount
      FROM ${TABLE} n
      CROSS JOIN CountCTE c
      CROSS JOIN UnreadCTE u
      WHERE n.USUARIO_DESTINATARIO = @username
        AND n.DT_EXCLUSAO IS NULL
        AND ${responsibilityClause}
        ${lidaFilter}
      ORDER BY n.LIDA ASC, n.DT_CRIACAO DESC
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `);

  const rows = result.recordset;
  const total = rows[0]?.Total || 0;
  const unreadCount = rows[0]?.UnreadCount || 0;

  return { rows, total, unreadCount };
}

async function listUnreadForCurrentResponsibility({ username, limit = 20 }) {
  const normalizedUsername = normalizeUsername(username);

  const pool = await getPool();
  const responsibilityClause = buildResponsibilityVisibilityClause('n');

  const result = await pool
    .request()
    .input('username', sql.VarChar(255), normalizedUsername)
    .input('limit', sql.Int, limit)
    .query(`
      ;WITH UnreadCTE AS (
        SELECT COUNT(*) as TotalUnread
        FROM ${TABLE} n
        WHERE n.USUARIO_DESTINATARIO = @username
          AND n.LIDA = 0
          AND n.DT_EXCLUSAO IS NULL
          AND ${responsibilityClause}
      )
      SELECT
        n.ID,
        n.TIPO,
        n.USUARIO_DESTINATARIO,
        n.ORIGEM_USUARIO,
        n.NUM_VENDA,
        n.PROXIMA_ACAO,
        n.PAYLOAD,
        n.LIDA,
        n.DT_CRIACAO,
        n.DT_LEITURA,
        n.DT_EXCLUSAO,
        u.TotalUnread
      FROM ${TABLE} n
      CROSS JOIN UnreadCTE u
      WHERE n.USUARIO_DESTINATARIO = @username
        AND n.LIDA = 0
        AND n.DT_EXCLUSAO IS NULL
        AND ${responsibilityClause}
      ORDER BY n.DT_CRIACAO DESC
      OFFSET 0 ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

  const rows = result.recordset;
  const totalUnread = rows[0]?.TotalUnread || 0;

  return { rows, totalUnread };
}

async function markRead(id, username) {
  const normalizedUsername = normalizeUsername(username);

  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .input('username', sql.VarChar(255), normalizedUsername)
    .query(`
      UPDATE ${TABLE}
      SET LIDA = 1,
          DT_LEITURA = SYSUTCDATETIME()
      OUTPUT
        INSERTED.ID,
        INSERTED.TIPO,
        INSERTED.USUARIO_DESTINATARIO,
        INSERTED.ORIGEM_USUARIO,
        INSERTED.NUM_VENDA,
        INSERTED.PROXIMA_ACAO,
        INSERTED.PAYLOAD,
        INSERTED.LIDA,
        INSERTED.DT_CRIACAO,
        INSERTED.DT_LEITURA,
        INSERTED.DT_EXCLUSAO
      WHERE ID = @id
        AND USUARIO_DESTINATARIO = @username
        AND DT_EXCLUSAO IS NULL
    `);

  return result.recordset[0] || null;
}

async function markAllRead(username) {
  const normalizedUsername = normalizeUsername(username);

  const pool = await getPool();
  const result = await pool
    .request()
    .input('username', sql.VarChar(255), normalizedUsername)
    .query(`
      UPDATE ${TABLE}
      SET LIDA = 1,
          DT_LEITURA = SYSUTCDATETIME()
      WHERE USUARIO_DESTINATARIO = @username
        AND LIDA = 0
        AND DT_EXCLUSAO IS NULL
    `);

  return result.rowsAffected[0];
}

async function softDelete(id, username) {
  const normalizedUsername = normalizeUsername(username);

  const pool = await getPool();

  // Atomic UPDATE with OUTPUT that includes LIDA check in WHERE clause
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .input('username', sql.VarChar(255), normalizedUsername)
    .query(`
      UPDATE ${TABLE}
      SET DT_EXCLUSAO = SYSUTCDATETIME()
      OUTPUT
        INSERTED.ID,
        INSERTED.TIPO,
        INSERTED.USUARIO_DESTINATARIO,
        INSERTED.ORIGEM_USUARIO,
        INSERTED.NUM_VENDA,
        INSERTED.PROXIMA_ACAO,
        INSERTED.PAYLOAD,
        INSERTED.LIDA,
        INSERTED.DT_CRIACAO,
        INSERTED.DT_LEITURA,
        INSERTED.DT_EXCLUSAO
      WHERE ID = @id
        AND USUARIO_DESTINATARIO = @username
        AND LIDA = 1
        AND DT_EXCLUSAO IS NULL
    `);

  const row = result.recordset[0];

  // If no rows affected, need to distinguish between "not found" and "not read"
  if (!row) {
    // Do a separate SELECT to check if notification exists
    const checkResult = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .input('username', sql.VarChar(255), normalizedUsername)
      .query(`
        SELECT LIDA
        FROM ${TABLE}
        WHERE ID = @id
          AND USUARIO_DESTINATARIO = @username
          AND DT_EXCLUSAO IS NULL
      `);

    const notification = checkResult.recordset[0];

    if (!notification) {
      return null; // Not found (404)
    }

    // Notification exists but LIDA = 0 (not read)
    const error = new Error('Cannot delete unread notification');
    error.statusCode = 409;
    throw error;
  }

  return row;
}

async function softDeleteAssignmentNotificationsBySaleAndUsername({ numVenda, username }) {
  const normalizedUsername = normalizeUsername(username);

  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .input('username', sql.VarChar(255), normalizedUsername)
    .query(`
      UPDATE ${TABLE}
      SET DT_EXCLUSAO = SYSUTCDATETIME()
      OUTPUT
        INSERTED.ID,
        INSERTED.TIPO,
        INSERTED.USUARIO_DESTINATARIO,
        INSERTED.ORIGEM_USUARIO,
        INSERTED.NUM_VENDA,
        INSERTED.PROXIMA_ACAO,
        INSERTED.PAYLOAD,
        INSERTED.LIDA,
        INSERTED.DT_CRIACAO,
        INSERTED.DT_LEITURA,
        INSERTED.DT_EXCLUSAO
      WHERE TIPO = 'VENDA_ATRIBUIDA'
        AND NUM_VENDA = @numVenda
        AND USUARIO_DESTINATARIO = @username
        AND DT_EXCLUSAO IS NULL
    `);

  return result.recordset;
}

module.exports = {
  insert,
  findById,
  findByDedupeKey,
  listPaginated,
  listUnread,
  listPaginatedForCurrentResponsibility,
  listUnreadForCurrentResponsibility,
  markRead,
  markAllRead,
  softDelete,
  softDeleteAssignmentNotificationsBySaleAndUsername,
};
