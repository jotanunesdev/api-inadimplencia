const { getPool, sql } = require('../config/db');

const TABLE = 'dbo.VENDA_RESPONSAVEL';

async function findAll() {
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT vr.NUM_VENDA_FK,
            vr.NOME_USUARIO_FK,
            vr.DT_ATRIBUICAO,
            u.COR_HEX
     FROM ${TABLE} vr
     LEFT JOIN dbo.USUARIO u ON u.NOME = vr.NOME_USUARIO_FK`
  );

  return result.recordset;
}

async function findByNumVenda(numVenda) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .query(
      `SELECT vr.NUM_VENDA_FK,
              vr.NOME_USUARIO_FK,
              vr.DT_ATRIBUICAO,
              u.COR_HEX
       FROM ${TABLE} vr
       LEFT JOIN dbo.USUARIO u ON u.NOME = vr.NOME_USUARIO_FK
       WHERE vr.NUM_VENDA_FK = @numVenda`
    );

  return result.recordset[0] || null;
}

async function upsert(numVenda, nomeUsuario) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .input('nomeUsuario', sql.VarChar, nomeUsuario)
    .query(
      `MERGE ${TABLE} AS target
       USING (SELECT @numVenda AS NUM_VENDA_FK, @nomeUsuario AS NOME_USUARIO_FK) AS source
       ON target.NUM_VENDA_FK = source.NUM_VENDA_FK
       WHEN MATCHED THEN
         UPDATE SET NOME_USUARIO_FK = source.NOME_USUARIO_FK,
                    DT_ATRIBUICAO = GETDATE()
       WHEN NOT MATCHED THEN
         INSERT (NUM_VENDA_FK, NOME_USUARIO_FK)
         VALUES (source.NUM_VENDA_FK, source.NOME_USUARIO_FK);

       SELECT vr.NUM_VENDA_FK,
              vr.NOME_USUARIO_FK,
              vr.DT_ATRIBUICAO,
              u.COR_HEX
       FROM ${TABLE} vr
       LEFT JOIN dbo.USUARIO u ON u.NOME = vr.NOME_USUARIO_FK
       WHERE vr.NUM_VENDA_FK = @numVenda;`
    );

  return result.recordset[0] || null;
}

async function remove(numVenda) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .query(`DELETE FROM ${TABLE} WHERE NUM_VENDA_FK = @numVenda`);

  return result.rowsAffected[0] > 0;
}

module.exports = {
  findAll,
  findByNumVenda,
  upsert,
  remove,
};