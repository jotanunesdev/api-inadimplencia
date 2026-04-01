const { getPool, sql } = require('../config/db');

const TABLE = 'dbo.OCORRENCIAS';
const NUM_VENDA_COLUMN = 'NUM_VENDA';
const NUM_VENDA_FK_COLUMN = 'NUM_VENDA_FK';

let numVendaReferencePromise;

function quoteIdentifier(value) {
  return `[${String(value).replace(/]/g, ']]')}]`;
}

function normalizeProximaAcao(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const text = String(value).trim();
  return text ? text : null;
}

function buildNumVendaReferenceError(numVendaFk, reference) {
  const referenceLabel = reference?.tableLabel ?? 'tabela referenciada';
  const err = new Error(
    `NUM_VENDA_FK ${numVendaFk} nao existe na tabela referenciada ${referenceLabel}.`
  );
  err.statusCode = 409;
  err.code = 'NUM_VENDA_REFERENCE_NOT_FOUND';
  return err;
}

function mapNumVendaConstraintError(err, numVendaFk, reference) {
  const message = String(err?.message ?? '');
  const constraintName = reference?.constraintName ?? '';

  if (err?.number === 547 || (constraintName && message.includes(constraintName))) {
    return buildNumVendaReferenceError(numVendaFk, reference);
  }

  return err;
}

async function getNumVendaReference() {
  if (!numVendaReferencePromise) {
    numVendaReferencePromise = (async () => {
      const pool = await getPool();
      const result = await pool.request().query(
        `SELECT TOP 1
            fk.name AS constraintName,
            OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS schemaName,
            OBJECT_NAME(fk.referenced_object_id) AS tableName
         FROM sys.foreign_keys fk
         INNER JOIN sys.foreign_key_columns fkc
           ON fkc.constraint_object_id = fk.object_id
         INNER JOIN sys.columns parentColumn
           ON parentColumn.object_id = fkc.parent_object_id
          AND parentColumn.column_id = fkc.parent_column_id
         WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id) = 'dbo'
           AND OBJECT_NAME(fk.parent_object_id) = 'OCORRENCIAS'
           AND parentColumn.name = '${NUM_VENDA_FK_COLUMN}'
         ORDER BY fk.name`
      );

      const reference = result.recordset[0];
      if (!reference) {
        return null;
      }

      return {
        constraintName: reference.constraintName,
        schemaName: reference.schemaName,
        tableName: reference.tableName,
        qualifiedTableName: `${quoteIdentifier(reference.schemaName)}.${quoteIdentifier(reference.tableName)}`,
        tableLabel: `${reference.schemaName}.${reference.tableName}`,
      };
    })().catch((err) => {
      numVendaReferencePromise = undefined;
      throw err;
    });
  }

  return numVendaReferencePromise;
}

async function validateNumVendaFk(numVendaFk) {
  const reference = await getNumVendaReference();

  if (!reference) {
    return {
      exists: true,
      reference: null,
    };
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input('numVendaFk', sql.Int, numVendaFk)
    .query(
      `SELECT TOP 1 ${NUM_VENDA_COLUMN}
       FROM ${reference.qualifiedTableName}
       WHERE ${NUM_VENDA_COLUMN} = @numVendaFk`
    );

  return {
    exists: Boolean(result.recordset[0]),
    reference,
  };
}

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
  const proximaAcao = normalizeProximaAcao(data.proximaAcao);
  const reference = await getNumVendaReference().catch(() => null);

  try {
    const result = await pool
      .request()
      .input('numVendaFk', sql.Int, data.numVendaFk)
      .input('nomeUsuario', sql.VarChar(255), data.nomeUsuario ?? null)
      .input('protocolo', sql.VarChar(20), data.protocolo ?? null)
      .input('descricao', sql.NVarChar(sql.MAX), data.descricao ?? null)
      .input('statusOcorrencia', sql.NVarChar(200), data.statusOcorrencia ?? null)
      .input('dtOcorrencia', sql.Date, data.dtOcorrencia)
      .input('horaOcorrencia', sql.VarChar, data.horaOcorrencia)
      .input('proximaAcao', sql.DateTime, proximaAcao)
      .query(
        `INSERT INTO ${TABLE} (NUM_VENDA_FK, NOME_USUARIO_FK, PROTOCOLO, DESCRICAO, STATUS_OCORRENCIA, DT_OCORRENCIA, HORA_OCORRENCIA, PROXIMA_ACAO)
         OUTPUT inserted.*
         VALUES (@numVendaFk, @nomeUsuario, @protocolo, @descricao, @statusOcorrencia, @dtOcorrencia, CONVERT(time(0), @horaOcorrencia), @proximaAcao)`
      );

    return result.recordset[0];
  } catch (err) {
    throw mapNumVendaConstraintError(err, data.numVendaFk, reference);
  }
}

async function update(id, data) {
  const pool = await getPool();
  const proximaAcao = normalizeProximaAcao(data.proximaAcao);
  const reference = await getNumVendaReference().catch(() => null);

  try {
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
      .input('proximaAcao', sql.DateTime, proximaAcao)
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
  } catch (err) {
    throw mapNumVendaConstraintError(err, data.numVendaFk, reference);
  }
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
  validateNumVendaFk,
};
