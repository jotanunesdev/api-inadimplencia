const { getPool, sql } = require('../config/db');

const TABLE = 'dbo.KANBAN_STATUS';
const LOCK_TIMEOUT_SECONDS = 300;

function buildLatestRowsCte() {
  return `
    WITH UltimoKanban AS (
      SELECT
        ks.NUM_VENDA_FK,
        ks.PROXIMA_ACAO,
        ks.STATUS,
        ks.STATUS_DATA,
        ks.NOME_USUARIO_FK,
        ks.DT_ATUALIZACAO,
        ROW_NUMBER() OVER (
          PARTITION BY ks.NUM_VENDA_FK, ks.NOME_USUARIO_FK
          ORDER BY ks.DT_ATUALIZACAO DESC, ks.PROXIMA_ACAO DESC
        ) AS RN
      FROM ${TABLE} ks
    )
  `;
}

function normalizeProximaAcao(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const text = String(value).trim();
  return text ? text : null;
}


async function findAll() {
  const pool = await getPool();
  const result = await pool.request().query(
    `${buildLatestRowsCte()}
     SELECT NUM_VENDA_FK,
            PROXIMA_ACAO,
            STATUS,
            STATUS_DATA,
            NOME_USUARIO_FK,
            DT_ATUALIZACAO
     FROM UltimoKanban
     WHERE RN = 1
     ORDER BY DT_ATUALIZACAO DESC, PROXIMA_ACAO DESC`
  );

  return result.recordset;
}

async function upsert({ numVenda, proximaAcao, status, statusDate, nomeUsuario }) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .input('proximaAcao', sql.VarChar(50), proximaAcao)
    .input('status', sql.VarChar(20), status)
    .input('statusDate', sql.VarChar(50), statusDate)
    .input('nomeUsuario', sql.VarChar(255), nomeUsuario || null)
    .query(
      `MERGE ${TABLE} AS target
       USING (
         SELECT @numVenda AS NUM_VENDA_FK, @proximaAcao AS PROXIMA_ACAO
       ) AS source
       ON target.NUM_VENDA_FK = source.NUM_VENDA_FK
          AND target.PROXIMA_ACAO = source.PROXIMA_ACAO
       WHEN MATCHED THEN
         UPDATE SET STATUS = @status,
                    STATUS_DATA = @statusDate,
                    NOME_USUARIO_FK = @nomeUsuario,
                    DT_ATUALIZACAO = CASE
                      WHEN target.STATUS = 'inProgress' AND @status = 'inProgress'
                        THEN target.DT_ATUALIZACAO
                      ELSE GETDATE()
                    END
        WHEN NOT MATCHED THEN
          INSERT (NUM_VENDA_FK, PROXIMA_ACAO, STATUS, STATUS_DATA, NOME_USUARIO_FK, DT_ATUALIZACAO)
          VALUES (@numVenda, @proximaAcao, @status, @statusDate, @nomeUsuario, GETDATE());
       
        SELECT NUM_VENDA_FK,
              PROXIMA_ACAO,
              STATUS,
              STATUS_DATA,
              NOME_USUARIO_FK,
              DT_ATUALIZACAO
       FROM ${TABLE}
       WHERE NUM_VENDA_FK = @numVenda AND PROXIMA_ACAO = @proximaAcao;`
    );

  return result.recordset[0] || null;
}

async function findActiveByNumVenda(numVenda) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .query(
      `${buildLatestRowsCte()}
      SELECT TOP 1
        NUM_VENDA_FK,
        PROXIMA_ACAO,
        STATUS,
        STATUS_DATA,
        NOME_USUARIO_FK,
        DT_ATUALIZACAO
      FROM UltimoKanban
      WHERE NUM_VENDA_FK = @numVenda
        AND RN = 1
        AND STATUS = 'inProgress'
      ORDER BY DT_ATUALIZACAO DESC, PROXIMA_ACAO DESC`
    );

    return result.recordset[0] || null;
}

async function findTimedOutInProgress() {
  const pool = await getPool();
  const result = await pool
    .request()
    .query(
      `${buildLatestRowsCte()}
      SELECT DISTINCT NUM_VENDA_FK
      FROM UltimoKanban
      WHERE RN = 1
        AND STATUS = 'inProgress'
        AND DT_ATUALIZACAO IS NOT NULL
        AND DATEDIFF(SECOND, DT_ATUALIZACAO, GETDATE()) >= ${LOCK_TIMEOUT_SECONDS}`
    );

    return result.recordset;
}

async function moveTimedOutToTodo(numVenda) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .query(
      `${buildLatestRowsCte()}
      UPDATE target
      SET target.STATUS = 'todo',
          target.DT_ATUALIZACAO = GETDATE()
      FROM ${TABLE} target
      INNER JOIN UltimoKanban uk
        ON uk.NUM_VENDA_FK = target.NUM_VENDA_FK
       AND uk.NOME_USUARIO_FK = target.NOME_USUARIO_FK
       AND (
         (uk.PROXIMA_ACAO IS NULL AND target.PROXIMA_ACAO IS NULL)
         OR uk.PROXIMA_ACAO = target.PROXIMA_ACAO
       )
      WHERE uk.NUM_VENDA_FK = @numVenda
        AND uk.RN = 1
        AND uk.STATUS = 'inProgress'
        AND uk.DT_ATUALIZACAO IS NOT NULL
        AND DATEDIFF(SECOND, uk.DT_ATUALIZACAO, GETDATE()) >= ${LOCK_TIMEOUT_SECONDS}`
    );

    return result.rowsAffected[0] > 0;
}

module.exports = {
  findAll,
  upsert,
  findActiveByNumVenda,
  findTimedOutInProgress,
  moveTimedOutToTodo,
};
