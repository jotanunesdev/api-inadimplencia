const { getPool, sql } = require('../config/db');

const TABLE = 'DW.fat_analise_inadimplencia';

async function listAll() {
  const pool = await getPool();
  const result = await pool.request().query(`SELECT NUM_VENDA, PROXIMA_ACAO FROM ${TABLE}`);
  return result.recordset;
}

async function findByNumVenda(numVenda) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .query(`SELECT NUM_VENDA, PROXIMA_ACAO FROM ${TABLE} WHERE NUM_VENDA = @numVenda`);

  return result.recordset[0] || null;
}

async function setByNumVenda(numVenda, proximaAcao) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .input('proximaAcao', sql.NVarChar, proximaAcao)
    .query(
      `UPDATE ${TABLE} SET PROXIMA_ACAO = @proximaAcao WHERE NUM_VENDA = @numVenda;
       SELECT NUM_VENDA, PROXIMA_ACAO FROM ${TABLE} WHERE NUM_VENDA = @numVenda;`
    );

  return result.recordset[0] || null;
}

async function clearByNumVenda(numVenda) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .query(
      `UPDATE ${TABLE} SET PROXIMA_ACAO = NULL WHERE NUM_VENDA = @numVenda;
       SELECT NUM_VENDA, PROXIMA_ACAO FROM ${TABLE} WHERE NUM_VENDA = @numVenda;`
    );

  return result.recordset[0] || null;
}

module.exports = {
  listAll,
  findByNumVenda,
  setByNumVenda,
  clearByNumVenda,
};