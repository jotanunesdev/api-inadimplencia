const { getPool, sql } = require('../config/db');

const TABLE = 'DW.fat_analise_inadimplencia';
const COL_SALDO = 'VALOR_TOTAL';
const COL_INADIMPLENTE = 'VALOR_INADIMPLENTE';
const SELECT_FIELDS = [
  'CLIENTE',
  'EMPREENDIMENTO',
  'BLOCO',
  'UNIDADE',
  'CPF_CNPJ',
  'NUM_VENDA',
  'QTD_PARCELAS_INADIMPLENTES',
  'STATUS_REPASSE',
  'PROXIMA_ACAO',
  'VENCIMENTO_MAIS_ANTIGO',
  'SCORE',
  'SUGESTAO',
  'VALOR_NAO_CONTRATUAL_INAD',
  'VALOR_POUPANCA_INAD',
  'VALOR_INADIMPLENTE',
  'VALOR_TOTAL',
  `CAST(${COL_SALDO} AS float) AS SALDO`,
  `CAST(${COL_INADIMPLENTE} AS float) AS VALOR_SOMENTE_INADIMPLENTE`,
].join(', ');

async function findAll() {
  const pool = await getPool();
  const result = await pool.request().query(`SELECT ${SELECT_FIELDS} FROM ${TABLE}`);
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
        `SELECT ${SELECT_FIELDS} FROM ${TABLE} WHERE REPLACE(REPLACE(REPLACE(CPF_CNPJ, '.', ''), '-', ''), '/', '') = @cpfDigits`
      );
    return result.recordset;
  }

  const result = await pool
    .request()
    .input('cpf', sql.VarChar, cpfInput)
    .query(`SELECT ${SELECT_FIELDS} FROM ${TABLE} WHERE CPF_CNPJ = @cpf`);

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
        .query(`SELECT ${SELECT_FIELDS} FROM ${TABLE} WHERE NUM_VENDA = @numVenda`);
      return result.recordset;
    }
  }

  const result = await pool
    .request()
    .input('numVenda', sql.VarChar, numVendaInput)
    .query(`SELECT ${SELECT_FIELDS} FROM ${TABLE} WHERE NUM_VENDA = @numVenda`);
  return result.recordset;
}

module.exports = {
  findAll,
  findByCpf,
  findByNumVenda,
};
