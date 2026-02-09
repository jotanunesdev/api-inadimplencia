const { getPool, sql } = require('../config/db');

const TABLE = 'DW.fat_analise_inadimplencia';

async function findAll() {
  const pool = await getPool();
  const result = await pool.request().query(`SELECT * FROM ${TABLE}`);
  return result.recordset;
}

async function findByCpf(cpfInput) {
  const pool = await getPool();
  const digitsOnly = /^[0-9]+$/.test(cpfInput);

  if (digitsOnly) {
    const result = await pool
      .request()
      .input('cpfDigits', sql.VarChar, cpfInput)
      .query(
        `SELECT * FROM ${TABLE} WHERE REPLACE(REPLACE(REPLACE(CPF_CNPJ, '.', ''), '-', ''), '/', '') = @cpfDigits`
      );
    return result.recordset;
  }

  const result = await pool
    .request()
    .input('cpf', sql.VarChar, cpfInput)
    .query(`SELECT * FROM ${TABLE} WHERE CPF_CNPJ = @cpf`);

  return result.recordset;
}

async function findByNumVenda(numVendaInput) {
  const pool = await getPool();
  const isInteger = /^[0-9]+$/.test(numVendaInput);

  if (isInteger) {
    const num = Number(numVendaInput);
    if (Number.isSafeInteger(num)) {
      const result = await pool
        .request()
        .input('numVenda', sql.Int, num)
        .query(`SELECT * FROM ${TABLE} WHERE NUM_VENDA = @numVenda`);
      return result.recordset;
    }
  }

  const result = await pool
    .request()
    .input('numVenda', sql.VarChar, numVendaInput)
    .query(`SELECT * FROM ${TABLE} WHERE NUM_VENDA = @numVenda`);
  return result.recordset;
}

module.exports = {
  findAll,
  findByCpf,
  findByNumVenda,
};