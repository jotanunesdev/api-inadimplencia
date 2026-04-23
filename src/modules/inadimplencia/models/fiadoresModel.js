const db = require('../config/db');
const { sql } = db;

const VIEW = 'DW.vw_fiadores_por_venda';

const SELECT_COLUMNS = `
  NUM_VENDA,
  ID_ASSOCIADO,
  ID_RESERVA,
  ID_PESSOA,
  NOME,
  DOCUMENTO,
  DATA_CADASTRO,
  RENDA_FAMILIAR,
  TIPO_ASSOCIACAO,
  ENDERECO
`;

async function findByNumVenda(numVenda) {
  const pool = await db.getPool();
  const result = await pool
    .request()
    .input('numVenda', sql.Int, numVenda)
    .query(
      `SELECT ${SELECT_COLUMNS}
       FROM ${VIEW}
       WHERE NUM_VENDA = @numVenda
       ORDER BY DATA_CADASTRO DESC, NOME ASC`
    );

  return result.recordset;
}

async function findByCpf(cpfDigits) {
  const pool = await db.getPool();
  const result = await pool
    .request()
    .input('cpfDigits', sql.VarChar(20), cpfDigits)
    .query(
      `SELECT ${SELECT_COLUMNS}
       FROM ${VIEW}
       WHERE REPLACE(REPLACE(REPLACE(DOCUMENTO, '.', ''), '-', ''), '/', '') = @cpfDigits
       ORDER BY DATA_CADASTRO DESC, NOME ASC`
    );

  return result.recordset;
}

module.exports = {
  findByNumVenda,
  findByCpf,
};
