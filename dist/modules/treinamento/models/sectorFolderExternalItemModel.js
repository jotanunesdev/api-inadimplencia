"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YOUTUBE_STORED_PATH_PREFIX = exports.YOUTUBE_EXTERNAL_ITEM_TYPE = void 0;
exports.buildYouTubeStoredPathToken = buildYouTubeStoredPathToken;
exports.parseYouTubeStoredPathToken = parseYouTubeStoredPathToken;
exports.isSectorFolderExternalItemTableMissingError = isSectorFolderExternalItemTableMissingError;
exports.listSectorFolderExternalItemsByParent = listSectorFolderExternalItemsByParent;
exports.listSectorFolderExternalItemsByIds = listSectorFolderExternalItemsByIds;
exports.getSectorFolderExternalItemById = getSectorFolderExternalItemById;
exports.listSectorFolderExternalItemsByPathPrefix = listSectorFolderExternalItemsByPathPrefix;
exports.createSectorFolderExternalItem = createSectorFolderExternalItem;
exports.updateSectorFolderExternalItem = updateSectorFolderExternalItem;
exports.updateSectorFolderExternalItemPathsByPrefix = updateSectorFolderExternalItemPathsByPrefix;
exports.deleteSectorFolderExternalItemsByIds = deleteSectorFolderExternalItemsByIds;
const crypto_1 = require("crypto");
const db_1 = require("../config/db");
const TABLE_NAME = "dbo.TGESTAO_ARQUIVOS_SETOR_LINKS_EXTERNOS";
exports.YOUTUBE_EXTERNAL_ITEM_TYPE = "youtube";
exports.YOUTUBE_STORED_PATH_PREFIX = "youtube-item:";
const GUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function mapExternalItem(record) {
    if (!record) {
        return null;
    }
    return {
        id: record.ID,
        sectorKey: record.SETOR_CHAVE,
        parentItemId: record.PARENT_ITEM_ID ?? null,
        name: record.NOME_EXIBICAO,
        path: record.CAMINHO,
        linkType: record.TIPO_LINK,
        url: record.URL,
        createdByName: record.CRIADO_POR_NOME ?? null,
        createdByEmail: record.CRIADO_POR_EMAIL ?? null,
        createdByUsername: record.CRIADO_POR_USUARIO ?? null,
        updatedByName: record.ATUALIZADO_POR_NOME ?? null,
        updatedByEmail: record.ATUALIZADO_POR_EMAIL ?? null,
        updatedByUsername: record.ATUALIZADO_POR_USUARIO ?? null,
        createdAt: record.CRIADO_EM ?? null,
        updatedAt: record.ATUALIZADO_EM ?? null,
    };
}
function buildYouTubeStoredPathToken(itemId) {
    return `${exports.YOUTUBE_STORED_PATH_PREFIX}${String(itemId ?? "").trim()}`;
}
function parseYouTubeStoredPathToken(value) {
    const normalizedValue = String(value ?? "").trim();
    if (!normalizedValue.startsWith(exports.YOUTUBE_STORED_PATH_PREFIX)) {
        return null;
    }
    const itemId = normalizedValue.slice(exports.YOUTUBE_STORED_PATH_PREFIX.length).trim();
    return itemId || null;
}
function isSectorFolderExternalItemTableMissingError(error) {
    const code = error?.code;
    return code === "SECTOR_FOLDER_EXTERNAL_ITEM_TABLE_MISSING";
}
async function ensureSectorFolderExternalItemTable() {
    const pool = await (0, db_1.getPool)();
    const result = await pool.request().query(`
    SELECT OBJECT_ID('${TABLE_NAME}', 'U') AS TABLE_ID
  `);
    if (result.recordset[0]?.TABLE_ID) {
        return;
    }
    const error = new Error("Tabela de links externos do gerenciador ausente");
    error.code =
        "SECTOR_FOLDER_EXTERNAL_ITEM_TABLE_MISSING";
    throw error;
}
async function listSectorFolderExternalItemsByParent(params) {
    await ensureSectorFolderExternalItemTable();
    const pool = await (0, db_1.getPool)();
    const request = pool
        .request()
        .input("SETOR_CHAVE", db_1.sql.NVarChar(120), params.sectorKey);
    const whereClause = params.parentItemId == null
        ? "PARENT_ITEM_ID IS NULL"
        : "PARENT_ITEM_ID = @PARENT_ITEM_ID";
    if (params.parentItemId != null) {
        request.input("PARENT_ITEM_ID", db_1.sql.NVarChar(255), params.parentItemId);
    }
    const result = await request.query(`
    SELECT
      ID,
      SETOR_CHAVE,
      PARENT_ITEM_ID,
      NOME_EXIBICAO,
      CAMINHO,
      TIPO_LINK,
      URL,
      CRIADO_POR_NOME,
      CRIADO_POR_EMAIL,
      CRIADO_POR_USUARIO,
      ATUALIZADO_POR_NOME,
      ATUALIZADO_POR_EMAIL,
      ATUALIZADO_POR_USUARIO,
      CRIADO_EM,
      ATUALIZADO_EM
    FROM ${TABLE_NAME}
    WHERE SETOR_CHAVE = @SETOR_CHAVE
      AND ${whereClause}
    ORDER BY NOME_EXIBICAO
  `);
    return result.recordset
        .map((record) => mapExternalItem(record))
        .filter(Boolean);
}
async function listSectorFolderExternalItemsByIds(itemIds) {
    await ensureSectorFolderExternalItemTable();
    const normalizedIds = Array.from(new Set(itemIds
        .map((itemId) => String(itemId ?? "").trim())
        .filter((itemId) => GUID_REGEX.test(itemId))));
    if (normalizedIds.length === 0) {
        return [];
    }
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    const idParameters = normalizedIds.map((itemId, index) => {
        const inputName = `ID_${index}`;
        request.input(inputName, db_1.sql.UniqueIdentifier, itemId);
        return `@${inputName}`;
    });
    const result = await request.query(`
    SELECT
      ID,
      SETOR_CHAVE,
      PARENT_ITEM_ID,
      NOME_EXIBICAO,
      CAMINHO,
      TIPO_LINK,
      URL,
      CRIADO_POR_NOME,
      CRIADO_POR_EMAIL,
      CRIADO_POR_USUARIO,
      ATUALIZADO_POR_NOME,
      ATUALIZADO_POR_EMAIL,
      ATUALIZADO_POR_USUARIO,
      CRIADO_EM,
      ATUALIZADO_EM
    FROM ${TABLE_NAME}
    WHERE ID IN (${idParameters.join(", ")})
  `);
    return result.recordset
        .map((record) => mapExternalItem(record))
        .filter(Boolean);
}
async function getSectorFolderExternalItemById(itemId) {
    await ensureSectorFolderExternalItemTable();
    if (!GUID_REGEX.test(String(itemId ?? "").trim())) {
        return null;
    }
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, itemId)
        .query(`
      SELECT TOP 1
        ID,
        SETOR_CHAVE,
        PARENT_ITEM_ID,
        NOME_EXIBICAO,
        CAMINHO,
        TIPO_LINK,
        URL,
        CRIADO_POR_NOME,
        CRIADO_POR_EMAIL,
        CRIADO_POR_USUARIO,
        ATUALIZADO_POR_NOME,
        ATUALIZADO_POR_EMAIL,
        ATUALIZADO_POR_USUARIO,
        CRIADO_EM,
        ATUALIZADO_EM
      FROM ${TABLE_NAME}
      WHERE ID = @ID
    `);
    return mapExternalItem(result.recordset[0]);
}
async function listSectorFolderExternalItemsByPathPrefix(params) {
    await ensureSectorFolderExternalItemTable();
    const normalizedPrefix = String(params.pathPrefix ?? "").trim();
    if (!normalizedPrefix) {
        return [];
    }
    const pool = await (0, db_1.getPool)();
    const result = await pool
        .request()
        .input("SETOR_CHAVE", db_1.sql.NVarChar(120), params.sectorKey)
        .input("CAMINHO", db_1.sql.NVarChar(1000), normalizedPrefix)
        .query(`
      SELECT
        ID,
        SETOR_CHAVE,
        PARENT_ITEM_ID,
        NOME_EXIBICAO,
        CAMINHO,
        TIPO_LINK,
        URL,
        CRIADO_POR_NOME,
        CRIADO_POR_EMAIL,
        CRIADO_POR_USUARIO,
        ATUALIZADO_POR_NOME,
        ATUALIZADO_POR_EMAIL,
        ATUALIZADO_POR_USUARIO,
        CRIADO_EM,
        ATUALIZADO_EM
      FROM ${TABLE_NAME}
      WHERE SETOR_CHAVE = @SETOR_CHAVE
        AND (
          CAMINHO = @CAMINHO OR
          LEFT(CAMINHO, LEN(@CAMINHO) + 1) = @CAMINHO + '/'
        )
      ORDER BY CAMINHO, NOME_EXIBICAO
    `);
    return result.recordset
        .map((record) => mapExternalItem(record))
        .filter(Boolean);
}
async function createSectorFolderExternalItem(input) {
    await ensureSectorFolderExternalItemTable();
    const itemId = input.id ?? (0, crypto_1.randomUUID)();
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, itemId)
        .input("SETOR_CHAVE", db_1.sql.NVarChar(120), input.sectorKey)
        .input("PARENT_ITEM_ID", db_1.sql.NVarChar(255), input.parentItemId ?? null)
        .input("NOME_EXIBICAO", db_1.sql.NVarChar(255), input.name)
        .input("CAMINHO", db_1.sql.NVarChar(1000), input.path)
        .input("TIPO_LINK", db_1.sql.VarChar(30), input.linkType)
        .input("URL", db_1.sql.NVarChar(1200), input.url)
        .input("CRIADO_POR_NOME", db_1.sql.NVarChar(255), input.createdByName ?? null)
        .input("CRIADO_POR_EMAIL", db_1.sql.NVarChar(255), input.createdByEmail ?? null)
        .input("CRIADO_POR_USUARIO", db_1.sql.NVarChar(255), input.createdByUsername ?? null)
        .input("ATUALIZADO_POR_NOME", db_1.sql.NVarChar(255), input.updatedByName ?? null)
        .input("ATUALIZADO_POR_EMAIL", db_1.sql.NVarChar(255), input.updatedByEmail ?? null)
        .input("ATUALIZADO_POR_USUARIO", db_1.sql.NVarChar(255), input.updatedByUsername ?? null)
        .input("CRIADO_EM", db_1.sql.DateTime2, input.createdAt ?? new Date())
        .input("ATUALIZADO_EM", db_1.sql.DateTime2, input.updatedAt ?? new Date())
        .query(`
      INSERT INTO ${TABLE_NAME} (
        ID,
        SETOR_CHAVE,
        PARENT_ITEM_ID,
        NOME_EXIBICAO,
        CAMINHO,
        TIPO_LINK,
        URL,
        CRIADO_POR_NOME,
        CRIADO_POR_EMAIL,
        CRIADO_POR_USUARIO,
        ATUALIZADO_POR_NOME,
        ATUALIZADO_POR_EMAIL,
        ATUALIZADO_POR_USUARIO,
        CRIADO_EM,
        ATUALIZADO_EM
      )
      VALUES (
        @ID,
        @SETOR_CHAVE,
        @PARENT_ITEM_ID,
        @NOME_EXIBICAO,
        @CAMINHO,
        @TIPO_LINK,
        @URL,
        @CRIADO_POR_NOME,
        @CRIADO_POR_EMAIL,
        @CRIADO_POR_USUARIO,
        @ATUALIZADO_POR_NOME,
        @ATUALIZADO_POR_EMAIL,
        @ATUALIZADO_POR_USUARIO,
        @CRIADO_EM,
        @ATUALIZADO_EM
      )
    `);
    return getSectorFolderExternalItemById(itemId);
}
async function updateSectorFolderExternalItem(input) {
    await ensureSectorFolderExternalItemTable();
    if (!GUID_REGEX.test(String(input.itemId ?? "").trim())) {
        return null;
    }
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("ID", db_1.sql.UniqueIdentifier, input.itemId)
        .input("URL", db_1.sql.NVarChar(1200), input.url)
        .input("ATUALIZADO_POR_NOME", db_1.sql.NVarChar(255), input.updatedByName ?? null)
        .input("ATUALIZADO_POR_EMAIL", db_1.sql.NVarChar(255), input.updatedByEmail ?? null)
        .input("ATUALIZADO_POR_USUARIO", db_1.sql.NVarChar(255), input.updatedByUsername ?? null)
        .input("ATUALIZADO_EM", db_1.sql.DateTime2, input.updatedAt ?? new Date())
        .query(`
      UPDATE ${TABLE_NAME}
      SET
        URL = @URL,
        ATUALIZADO_POR_NOME = @ATUALIZADO_POR_NOME,
        ATUALIZADO_POR_EMAIL = @ATUALIZADO_POR_EMAIL,
        ATUALIZADO_POR_USUARIO = @ATUALIZADO_POR_USUARIO,
        ATUALIZADO_EM = @ATUALIZADO_EM
      WHERE ID = @ID
    `);
    return getSectorFolderExternalItemById(input.itemId);
}
async function updateSectorFolderExternalItemPathsByPrefix(params) {
    await ensureSectorFolderExternalItemTable();
    const oldPathPrefix = String(params.oldPathPrefix ?? "").trim();
    const newPathPrefix = String(params.newPathPrefix ?? "").trim();
    if (!oldPathPrefix || !newPathPrefix || oldPathPrefix === newPathPrefix) {
        return;
    }
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("SETOR_CHAVE", db_1.sql.NVarChar(120), params.sectorKey)
        .input("OLD", db_1.sql.NVarChar(1000), oldPathPrefix)
        .input("NEW", db_1.sql.NVarChar(1000), newPathPrefix)
        .query(`
      UPDATE ${TABLE_NAME}
      SET
        CAMINHO = @NEW + SUBSTRING(CAMINHO, LEN(@OLD) + 1, 1000),
        ATUALIZADO_EM = SYSUTCDATETIME()
      WHERE SETOR_CHAVE = @SETOR_CHAVE
        AND LEFT(CAMINHO, LEN(@OLD) + 1) = @OLD + '/'
    `);
}
async function deleteSectorFolderExternalItemsByIds(itemIds) {
    await ensureSectorFolderExternalItemTable();
    const normalizedIds = Array.from(new Set(itemIds
        .map((itemId) => String(itemId ?? "").trim())
        .filter((itemId) => GUID_REGEX.test(itemId))));
    if (normalizedIds.length === 0) {
        return;
    }
    const pool = await (0, db_1.getPool)();
    const request = pool.request();
    const idParameters = normalizedIds.map((itemId, index) => {
        const inputName = `ID_${index}`;
        request.input(inputName, db_1.sql.UniqueIdentifier, itemId);
        return `@${inputName}`;
    });
    await request.query(`
    DELETE FROM ${TABLE_NAME}
    WHERE ID IN (${idParameters.join(", ")})
  `);
}
