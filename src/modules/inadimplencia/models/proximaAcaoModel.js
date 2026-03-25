const { getPool, sql } = require('../config/db');

const TABLE_OC = 'dbo.OCORRENCIAS';
const TABLE_FAT = 'DW.fat_analise_inadimplencia_v3';
const COL_STATUS_INADIMPLENCIA = 'INADIMPLENTE';

function buildInadimplenteCondition(alias = 'f') {
  return `UPPER(LTRIM(RTRIM(COALESCE(${alias}.${COL_STATUS_INADIMPLENCIA}, '')))) = 'SIM'`;
}

async function listAll() {
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT DISTINCT ranked.NUM_VENDA_FK AS NUM_VENDA, ranked.PROXIMA_ACAO
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
     INNER JOIN ${TABLE_FAT} f ON f.NUM_VENDA = ranked.NUM_VENDA_FK
     WHERE ranked.rn = 1
       AND ${buildInadimplenteCondition('f')}`
  );
  return result.recordset;
}

async function findByNumVenda(numVenda) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .query(
      `SELECT TOP 1 o.NUM_VENDA_FK AS NUM_VENDA, o.PROXIMA_ACAO
       FROM ${TABLE_OC} o
       INNER JOIN ${TABLE_FAT} f ON f.NUM_VENDA = o.NUM_VENDA_FK
       WHERE o.NUM_VENDA_FK = @numVenda
         AND o.PROXIMA_ACAO IS NOT NULL
         AND ${buildInadimplenteCondition('f')}
       ORDER BY o.DT_OCORRENCIA DESC, o.HORA_OCORRENCIA DESC, o.PROXIMA_ACAO DESC`
    );

  return result.recordset[0] || null;
}

module.exports = {
  listAll,
  findByNumVenda,
};
