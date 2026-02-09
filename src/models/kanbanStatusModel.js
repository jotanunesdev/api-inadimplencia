const { getPool, sql } = require('../config/db');

const TABLE = 'dbo.KANBAN_STATUS';

async function findAll() {
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT NUM_VENDA_FK,
            PROXIMA_ACAO,
            STATUS,
            STATUS_DATA,
            NOME_USUARIO_FK,
            DT_ATUALIZACAO
     FROM ${TABLE}`
  );

  return result.recordset;
}

async function upsert({ numVenda, proximaAcao, status, statusDate, nomeUsuario }) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .input('proximaAcao', sql.DateTime2, proximaAcao)
    .input('status', sql.VarChar(20), status)
    .input('statusDate', sql.Date, statusDate)
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
                    DT_ATUALIZACAO = GETDATE()
       WHEN NOT MATCHED THEN
         INSERT (NUM_VENDA_FK, PROXIMA_ACAO, STATUS, STATUS_DATA, NOME_USUARIO_FK)
         VALUES (@numVenda, @proximaAcao, @status, @statusDate, @nomeUsuario);

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

module.exports = {
  findAll,
  upsert,
};
