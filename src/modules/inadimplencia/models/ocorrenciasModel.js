const { getPool, sql } = require('../config/db');

const TABLE = 'dbo.OCORRENCIAS';

async function findAll() {
  const pool = await getPool();
  const result = await pool.request().query(`SELECT * FROM ${TABLE}`);
  return result.recordset;
}

async function findById(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`SELECT * FROM ${TABLE} WHERE ID = @id`);

  return result.recordset[0] || null;
}

async function findByNumVenda(numVendaFk) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVendaFk', sql.Int, numVendaFk)
    .query(
      `SELECT * FROM ${TABLE}
       WHERE NUM_VENDA_FK = @numVendaFk
       ORDER BY DT_OCORRENCIA DESC, HORA_OCORRENCIA DESC`
    );

  return result.recordset;
}

async function findByProtocolo(protocolo) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('protocolo', sql.VarChar(20), protocolo)
    .query(
      `SELECT * FROM ${TABLE}
       WHERE PROTOCOLO = @protocolo
       ORDER BY DT_OCORRENCIA DESC, HORA_OCORRENCIA DESC`
    );

  return result.recordset;
}

async function create(data) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVendaFk', sql.Int, data.numVendaFk)
    .input('nomeUsuario', sql.VarChar(255), data.nomeUsuario ?? null)
    .input('protocolo', sql.VarChar(20), data.protocolo ?? null)
    .input('descricao', sql.NVarChar(sql.MAX), data.descricao ?? null)
    .input('statusOcorrencia', sql.NVarChar(200), data.statusOcorrencia ?? null)
    .input('dtOcorrencia', sql.Date, data.dtOcorrencia)
    .input('horaOcorrencia', sql.VarChar, data.horaOcorrencia)
    .input('proximaAcao', sql.DateTime, data.proximaAcao ?? null)
    .query(
      `INSERT INTO ${TABLE} (NUM_VENDA_FK, NOME_USUARIO_FK, PROTOCOLO, DESCRICAO, STATUS_OCORRENCIA, DT_OCORRENCIA, HORA_OCORRENCIA, PROXIMA_ACAO)
       OUTPUT inserted.*
       VALUES (@numVendaFk, @nomeUsuario, @protocolo, @descricao, @statusOcorrencia, @dtOcorrencia, CONVERT(time(0), @horaOcorrencia), @proximaAcao)`
    );

  return result.recordset[0];
}

async function update(id, data) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .input('numVendaFk', sql.Int, data.numVendaFk)
    .input('nomeUsuario', sql.VarChar(255), data.nomeUsuario ?? null)
    .input('protocolo', sql.VarChar(20), data.protocolo ?? null)
    .input('descricao', sql.NVarChar(sql.MAX), data.descricao ?? null)
    .input('statusOcorrencia', sql.NVarChar(200), data.statusOcorrencia ?? null)
    .input('dtOcorrencia', sql.Date, data.dtOcorrencia)
    .input('horaOcorrencia', sql.VarChar, data.horaOcorrencia)
    .input('proximaAcao', sql.DateTime, data.proximaAcao ?? null)
    .query(
      `UPDATE ${TABLE}
       SET NUM_VENDA_FK = @numVendaFk,
           NOME_USUARIO_FK = @nomeUsuario,
           PROTOCOLO = @protocolo,
           DESCRICAO = @descricao,
           STATUS_OCORRENCIA = @statusOcorrencia,
           DT_OCORRENCIA = @dtOcorrencia,
           HORA_OCORRENCIA = CONVERT(time(0), @horaOcorrencia),
           PROXIMA_ACAO = @proximaAcao
       WHERE ID = @id;
       SELECT * FROM ${TABLE} WHERE ID = @id;`
    );

  return result.recordset[0] || null;
}

async function remove(id) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`DELETE FROM ${TABLE} WHERE ID = @id`);

  return result.rowsAffected[0] > 0;
}

module.exports = {
  findAll,
  findById,
  findByNumVenda,
  create,
  update,
  remove,
  findByProtocolo,
};
