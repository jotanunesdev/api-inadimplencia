import { env } from '../config/env';
import { getPool, sql } from '../config/db';
import { AppError } from '../types/errors';
import type {
  EstoqueMinPayload,
  EstoqueOnlineKey,
  EstoqueOnlineRow,
} from '../types/estoqueOnline';
import { quoteSqlIdentifier } from '../utils/sqlIdentifier';
import { logger } from '../utils/logger';

type RawEstoqueRecord = {
  codigoPrd: string;
  nomeFantasia: string;
  codUndControle: string | null;
  codFilial: string;
  codLoc: string;
  saldoMov: number | null;
  totalMov: number | null;
  custoMedio: number | null;
  estoqueMin: number | null;
};

let estoqueMinColumnCache:
  | {
      value: boolean;
      expiresAt: number;
    }
  | null = null;

function getTableReference(): string {
  return `${quoteSqlIdentifier(env.DB_SCHEMA)}.${quoteSqlIdentifier(env.DB_TABLE)}`;
}

function buildSelectClause(hasEstoqueMinColumn: boolean): string {
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

function mapRecord(record: RawEstoqueRecord): EstoqueOnlineRow {
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

async function hasEstoqueMinColumn(): Promise<boolean> {
  if (estoqueMinColumnCache && estoqueMinColumnCache.expiresAt > Date.now()) {
    return estoqueMinColumnCache.value;
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input('schema', sql.NVarChar(128), env.DB_SCHEMA)
    .input('table', sql.NVarChar(128), env.DB_TABLE)
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

async function ensureEstoqueMinColumn(): Promise<void> {
  if (await hasEstoqueMinColumn()) {
    return;
  }

  throw new AppError(
    503,
    'A coluna ESTOQUEMIN ainda nao existe na tabela dw.fat_estoque_online.',
    'ESTOQUE_MIN_COLUMN_NOT_AVAILABLE'
  );
}

function createKeyRequest(pool: sql.ConnectionPool, key: EstoqueOnlineKey): sql.Request {
  return pool
    .request()
    .input('codigoPrd', sql.NVarChar(60), key.codigoPrd)
    .input('codFilial', sql.NVarChar(30), key.codFilial)
    .input('codLoc', sql.NVarChar(30), key.codLoc);
}

export async function getHealthSnapshot(): Promise<{
  configured: boolean;
  estoqueMinColumnAvailable: boolean;
}> {
  if (!env.isConfigured) {
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
  } catch (error) {
    logger.warn('EstoqueOnlineService', 'Falha ao verificar coluna ESTOQUEMIN.', error);
    return {
      configured: true,
      estoqueMinColumnAvailable: false,
    };
  }
}

export async function listItems(): Promise<{
  items: EstoqueOnlineRow[];
  estoqueMinColumnAvailable: boolean;
}> {
  const pool = await getPool();
  const estoqueMinAvailable = await hasEstoqueMinColumn();
  const tableReference = getTableReference();
  const selectClause = buildSelectClause(estoqueMinAvailable);

  const result = await pool
    .request()
    .input('blockedPrefix', sql.NVarChar(50), '(NAO USAR)%')
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

export async function getItemByKey(
  key: EstoqueOnlineKey
): Promise<{
  item: EstoqueOnlineRow | null;
  estoqueMinColumnAvailable: boolean;
}> {
  const pool = await getPool();
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

async function ensureItemExists(key: EstoqueOnlineKey): Promise<EstoqueOnlineRow> {
  const { item } = await getItemByKey(key);

  if (!item) {
    throw new AppError(404, 'Registro nao encontrado na tabela de estoque.', 'ITEM_NOT_FOUND');
  }

  return item;
}

export async function createEstoqueMin(
  key: EstoqueOnlineKey,
  payload: EstoqueMinPayload
): Promise<EstoqueOnlineRow> {
  await ensureEstoqueMinColumn();
  const currentItem = await ensureItemExists(key);

  if (currentItem.estoqueMin !== null) {
    throw new AppError(
      409,
      'O campo ESTOQUEMIN ja esta preenchido para este registro.',
      'ESTOQUE_MIN_ALREADY_DEFINED'
    );
  }

  const pool = await getPool();
  const tableReference = getTableReference();

  await createKeyRequest(pool, key)
    .input('estoqueMin', sql.Decimal(18, 4), payload.estoqueMin)
    .query(`
      UPDATE ${tableReference}
      SET [ESTOQUEMIN] = @estoqueMin
      WHERE [CODIGOPRD] = @codigoPrd
        AND CAST([CODFILIAL] AS NVARCHAR(30)) = @codFilial
        AND CAST([CODLOC] AS NVARCHAR(30)) = @codLoc
    `);

  const { item } = await getItemByKey(key);
  return item as EstoqueOnlineRow;
}

export async function updateEstoqueMin(
  key: EstoqueOnlineKey,
  payload: EstoqueMinPayload
): Promise<EstoqueOnlineRow> {
  await ensureEstoqueMinColumn();
  await ensureItemExists(key);

  const pool = await getPool();
  const tableReference = getTableReference();

  await createKeyRequest(pool, key)
    .input('estoqueMin', sql.Decimal(18, 4), payload.estoqueMin)
    .query(`
      UPDATE ${tableReference}
      SET [ESTOQUEMIN] = @estoqueMin
      WHERE [CODIGOPRD] = @codigoPrd
        AND CAST([CODFILIAL] AS NVARCHAR(30)) = @codFilial
        AND CAST([CODLOC] AS NVARCHAR(30)) = @codLoc
    `);

  const { item } = await getItemByKey(key);
  return item as EstoqueOnlineRow;
}

export async function deleteEstoqueMin(key: EstoqueOnlineKey): Promise<EstoqueOnlineRow> {
  await ensureEstoqueMinColumn();
  await ensureItemExists(key);

  const pool = await getPool();
  const tableReference = getTableReference();

  await createKeyRequest(pool, key).query(`
    UPDATE ${tableReference}
    SET [ESTOQUEMIN] = NULL
    WHERE [CODIGOPRD] = @codigoPrd
      AND CAST([CODFILIAL] AS NVARCHAR(30)) = @codFilial
      AND CAST([CODLOC] AS NVARCHAR(30)) = @codLoc
  `);

  const { item } = await getItemByKey(key);
  return item as EstoqueOnlineRow;
}
