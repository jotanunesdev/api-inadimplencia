"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealthSnapshot = getHealthSnapshot;
exports.listItems = listItems;
exports.getItemByKey = getItemByKey;
exports.createEstoqueMin = createEstoqueMin;
exports.updateEstoqueMin = updateEstoqueMin;
exports.deleteEstoqueMin = deleteEstoqueMin;
const env_1 = require("../config/env");
const db_1 = require("../config/db");
const errors_1 = require("../types/errors");
const sqlIdentifier_1 = require("../utils/sqlIdentifier");
const logger_1 = require("../utils/logger");
let estoqueMinColumnCache = null;
function getTableReference() {
    return `${(0, sqlIdentifier_1.quoteSqlIdentifier)(env_1.env.DB_SCHEMA)}.${(0, sqlIdentifier_1.quoteSqlIdentifier)(env_1.env.DB_TABLE)}`;
}
function buildSelectClause(hasEstoqueMinColumn) {
    const estoqueMinProjection = hasEstoqueMinColumn
        ? 'CAST([ESTOQUEMIN] AS DECIMAL(18, 4)) AS estoqueMin'
        : 'CAST(NULL AS DECIMAL(18, 4)) AS estoqueMin';
    return `
    SELECT
      CAST([CODIGOPRD] AS NVARCHAR(60)) AS codigoPrd,
      CAST([NOMEFANTASIA] AS NVARCHAR(255)) AS nomeFantasia,
      CAST([CODUNDCONTROLE] AS NVARCHAR(30)) AS codUndControle,
      CAST([CODFILIAL] AS NVARCHAR(30)) AS codFilial,
      CAST([CODLOC] AS NVARCHAR(30)) AS codLoc,
      CAST([SALDOMOV] AS DECIMAL(18, 4)) AS saldoMov,
      CAST([TOTALMOV] AS DECIMAL(18, 4)) AS totalMov,
      CAST([CUSTOMEDIO] AS DECIMAL(18, 6)) AS custoMedio,
      ${estoqueMinProjection}
  `;
}
function mapRecord(record) {
    return {
        codigoPrd: String(record.codigoPrd ?? '').trim(),
        nomeFantasia: String(record.nomeFantasia ?? '').trim(),
        codUndControle: record.codUndControle ? String(record.codUndControle).trim() : null,
        codFilial: String(record.codFilial ?? '').trim(),
        codLoc: String(record.codLoc ?? '').trim(),
        saldoMov: record.saldoMov === null ? null : Number(record.saldoMov),
        totalMov: record.totalMov === null ? null : Number(record.totalMov),
        custoMedio: record.custoMedio === null ? null : Number(record.custoMedio),
        estoqueMin: record.estoqueMin === null ? null : Number(record.estoqueMin),
    };
}
async function hasEstoqueMinColumn() {
    if (estoqueMinColumnCache && estoqueMinColumnCache.expiresAt > Date.now()) {
        return estoqueMinColumnCache.value;
    }
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input('schema', db_1.sql.NVarChar(128), env_1.env.DB_SCHEMA)
        .input('table', db_1.sql.NVarChar(128), env_1.env.DB_TABLE)
        .query(`
      SELECT TOP 1 1 AS existsFlag
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @schema
        AND TABLE_NAME = @table
        AND COLUMN_NAME = 'ESTOQUEMIN'
    `);
    const value = result.recordset.length > 0;
    estoqueMinColumnCache = {
        value,
        expiresAt: Date.now() + 30000,
    };
    return value;
}
async function ensureEstoqueMinColumn() {
    if (await hasEstoqueMinColumn()) {
        return;
    }
    throw new errors_1.AppError(503, 'A coluna ESTOQUEMIN ainda nao existe na tabela dw.fat_estoque_online.', 'ESTOQUE_MIN_COLUMN_NOT_AVAILABLE');
}
function createKeyRequest(pool, key) {
    return pool
        .request()
        .input('codigoPrd', db_1.sql.NVarChar(60), key.codigoPrd)
        .input('codFilial', db_1.sql.NVarChar(30), key.codFilial)
        .input('codLoc', db_1.sql.NVarChar(30), key.codLoc);
}
async function getHealthSnapshot() {
    if (!env_1.env.isConfigured) {
        return {
            configured: false,
            estoqueMinColumnAvailable: false,
        };
    }
    try {
        return {
            configured: true,
            estoqueMinColumnAvailable: await hasEstoqueMinColumn(),
        };
    }
    catch (error) {
        logger_1.logger.warn('EstoqueOnlineService', 'Falha ao verificar coluna ESTOQUEMIN.', error);
        return {
            configured: true,
            estoqueMinColumnAvailable: false,
        };
    }
}
async function listItems() {
    const pool = await (0, db_1.getPool)();
    const estoqueMinAvailable = await hasEstoqueMinColumn();
    const tableReference = getTableReference();
    const selectClause = buildSelectClause(estoqueMinAvailable);
    const result = await pool
        .request()
        .input('blockedPrefix', db_1.sql.NVarChar(50), '(NAO USAR)%')
        .query(`
      ${selectClause}
      FROM ${tableReference}
      WHERE [NOMEFANTASIA] NOT LIKE @blockedPrefix
      ORDER BY [NOMEFANTASIA], [CODIGOPRD], [CODFILIAL], [CODLOC]
    `);
    return {
        items: result.recordset.map(mapRecord),
        estoqueMinColumnAvailable: estoqueMinAvailable,
    };
}
async function getItemByKey(key) {
    const pool = await (0, db_1.getPool)();
    const estoqueMinAvailable = await hasEstoqueMinColumn();
    const tableReference = getTableReference();
    const selectClause = buildSelectClause(estoqueMinAvailable);
    const result = await createKeyRequest(pool, key)
        .query(`
      ${selectClause}
      FROM ${tableReference}
      WHERE [CODIGOPRD] = @codigoPrd
        AND CAST([CODFILIAL] AS NVARCHAR(30)) = @codFilial
        AND CAST([CODLOC] AS NVARCHAR(30)) = @codLoc
    `);
    return {
        item: result.recordset[0] ? mapRecord(result.recordset[0]) : null,
        estoqueMinColumnAvailable: estoqueMinAvailable,
    };
}
async function ensureItemExists(key) {
    const { item } = await getItemByKey(key);
    if (!item) {
        throw new errors_1.AppError(404, 'Registro nao encontrado na tabela de estoque.', 'ITEM_NOT_FOUND');
    }
    return item;
}
async function createEstoqueMin(key, payload) {
    await ensureEstoqueMinColumn();
    const currentItem = await ensureItemExists(key);
    if (currentItem.estoqueMin !== null) {
        throw new errors_1.AppError(409, 'O campo ESTOQUEMIN ja esta preenchido para este registro.', 'ESTOQUE_MIN_ALREADY_DEFINED');
    }
    const pool = await (0, db_1.getPool)();
    const tableReference = getTableReference();
    await createKeyRequest(pool, key)
        .input('estoqueMin', db_1.sql.Decimal(18, 4), payload.estoqueMin)
        .query(`
      UPDATE ${tableReference}
      SET [ESTOQUEMIN] = @estoqueMin
      WHERE [CODIGOPRD] = @codigoPrd
        AND CAST([CODFILIAL] AS NVARCHAR(30)) = @codFilial
        AND CAST([CODLOC] AS NVARCHAR(30)) = @codLoc
    `);
    const { item } = await getItemByKey(key);
    return item;
}
async function updateEstoqueMin(key, payload) {
    await ensureEstoqueMinColumn();
    await ensureItemExists(key);
    const pool = await (0, db_1.getPool)();
    const tableReference = getTableReference();
    await createKeyRequest(pool, key)
        .input('estoqueMin', db_1.sql.Decimal(18, 4), payload.estoqueMin)
        .query(`
      UPDATE ${tableReference}
      SET [ESTOQUEMIN] = @estoqueMin
      WHERE [CODIGOPRD] = @codigoPrd
        AND CAST([CODFILIAL] AS NVARCHAR(30)) = @codFilial
        AND CAST([CODLOC] AS NVARCHAR(30)) = @codLoc
    `);
    const { item } = await getItemByKey(key);
    return item;
}
async function deleteEstoqueMin(key) {
    await ensureEstoqueMinColumn();
    await ensureItemExists(key);
    const pool = await (0, db_1.getPool)();
    const tableReference = getTableReference();
    await createKeyRequest(pool, key).query(`
    UPDATE ${tableReference}
    SET [ESTOQUEMIN] = NULL
    WHERE [CODIGOPRD] = @codigoPrd
      AND CAST([CODFILIAL] AS NVARCHAR(30)) = @codFilial
      AND CAST([CODLOC] AS NVARCHAR(30)) = @codLoc
  `);
    const { item } = await getItemByKey(key);
    return item;
}
