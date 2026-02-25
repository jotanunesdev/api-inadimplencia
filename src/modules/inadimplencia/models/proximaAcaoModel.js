const { getPool, sql } = require('../config/db');

const TABLE_OC = 'dbo.OCORRENCIAS';

async function listAll() {
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT NUM_VENDA_FK AS NUM_VENDA, PROXIMA_ACAO
     FROM (
       SELECT
         NUM_VENDA_FK,
         PROXIMA_ACAO,
         ROW_NUMBER() OVER (
           PARTITION BY NUM_VENDA_FK
           ORDER BY DT_OCORRENCIA DESC, HORA_OCORRENCIA DESC, PROXIMA_ACAO DESC
         ) AS rn
       FROM ${TABLE_OC}
       WHERE PROXIMA_ACAO IS NOT NULL
     ) AS ranked
     WHERE rn = 1`
  );
  return result.recordset;
}

async function findByNumVenda(numVenda) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .query(
      `SELECT TOP 1 NUM_VENDA_FK AS NUM_VENDA, PROXIMA_ACAO
       FROM ${TABLE_OC}
       WHERE NUM_VENDA_FK = @numVenda
         AND PROXIMA_ACAO IS NOT NULL
       ORDER BY DT_OCORRENCIA DESC, HORA_OCORRENCIA DESC, PROXIMA_ACAO DESC`
    );

  return result.recordset[0] || null;
}

module.exports = {
  listAll,
  findByNumVenda,
};
