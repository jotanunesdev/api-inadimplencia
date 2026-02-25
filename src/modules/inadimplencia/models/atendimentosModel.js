const { getPool, sql } = require('../config/db');

const TABLE = 'dbo.ATENDIMENTOS';

function pad2(value) {
  return String(value).padStart(2, '0');
}

function buildProtocolPrefix(date = new Date()) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}${month}${day}`;
}

function parseCpfDigits(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value.replace(/\D/g, '');
}

async function generateProtocol(transaction) {
  const prefix = buildProtocolPrefix();
  const request = new sql.Request(transaction);
  const result = await request
    .input('prefix', sql.VarChar(8), prefix)
    .query(
      `SELECT MAX(PROTOCOLO) AS maxProtocolo
       FROM ${TABLE} WITH (UPDLOCK, HOLDLOCK)
       WHERE PROTOCOLO LIKE @prefix + '%'`
    );

  const maxProtocolo = result.recordset[0]?.maxProtocolo ?? null;
  let nextSequence = 1;
  if (maxProtocolo && typeof maxProtocolo === 'string' && maxProtocolo.length >= 13) {
    const sequenceText = maxProtocolo.slice(-5);
    const parsed = Number(sequenceText);
    if (Number.isFinite(parsed)) {
      nextSequence = parsed + 1;
    }
  }

  const sequence = String(nextSequence).padStart(5, '0');
  return `${prefix}${sequence}`;
}

function serializeVenda(venda) {
  if (!venda) {
    return null;
  }
  try {
    return JSON.stringify(venda);
  } catch (err) {
    return null;
  }
}

function parseVendaSnapshot(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function attachSnapshot(record) {
  if (!record) {
    return null;
  }
  const snapshot = parseVendaSnapshot(record.DADOS_VENDA);
  const responsavel =
    snapshot?.RESPONSAVEL ?? snapshot?.NOME_USUARIO_FK ?? record.RESPONSAVEL ?? null;
  return {
    ...record,
    VENDA_SNAPSHOT: snapshot ?? null,
    RESPONSAVEL: responsavel ?? null,
  };
}

async function createFromVenda(numVendaFk, vendaSnapshot) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

  try {
    const protocolo = await generateProtocol(transaction);
    const serialized = serializeVenda(vendaSnapshot);

    const request = new sql.Request(transaction);
    const result = await request
      .input('protocolo', sql.VarChar(20), protocolo)
      .input('numVendaFk', sql.Int, numVendaFk)
      .input('cpfCnpj', sql.VarChar(40), vendaSnapshot?.CPF_CNPJ ?? null)
      .input('cliente', sql.NVarChar(255), vendaSnapshot?.CLIENTE ?? null)
      .input('empreendimento', sql.NVarChar(255), vendaSnapshot?.EMPREENDIMENTO ?? null)
      .input('dadosVenda', sql.NVarChar(sql.MAX), serialized)
      .query(
        `INSERT INTO ${TABLE} (PROTOCOLO, NUM_VENDA_FK, CPF_CNPJ, CLIENTE, EMPREENDIMENTO, DADOS_VENDA)
         OUTPUT inserted.*
         VALUES (@protocolo, @numVendaFk, @cpfCnpj, @cliente, @empreendimento, @dadosVenda)`
      );

    await transaction.commit();

    const record = result.recordset[0] || null;
    return attachSnapshot(record);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function findByProtocolo(protocolo) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('protocolo', sql.VarChar(20), protocolo)
    .query(`SELECT * FROM ${TABLE} WHERE PROTOCOLO = @protocolo`);

  const record = result.recordset[0] || null;
  return attachSnapshot(record);
}

async function findByCpf(cpfInput) {
  const pool = await getPool();
  const digits = parseCpfDigits(cpfInput);

  if (digits) {
    const result = await pool
      .request()
      .input('cpfDigits', sql.VarChar(20), digits)
      .query(
        `SELECT * FROM ${TABLE}
         WHERE REPLACE(REPLACE(REPLACE(CPF_CNPJ, '.', ''), '-', ''), '/', '') = @cpfDigits
         ORDER BY CRIADO_EM DESC`
      );
    return result.recordset.map(attachSnapshot);
  }

  const result = await pool
    .request()
    .input('cpf', sql.VarChar(40), cpfInput)
    .query(
      `SELECT * FROM ${TABLE}
       WHERE CPF_CNPJ = @cpf
       ORDER BY CRIADO_EM DESC`
    );
  return result.recordset.map(attachSnapshot);
}

async function findByNumVenda(numVendaFk) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVendaFk', sql.Int, numVendaFk)
    .query(
      `SELECT * FROM ${TABLE}
       WHERE NUM_VENDA_FK = @numVendaFk
       ORDER BY CRIADO_EM DESC`
    );

  return result.recordset.map(attachSnapshot);
}

module.exports = {
  createFromVenda,
  findByProtocolo,
  findByCpf,
  findByNumVenda,
};
