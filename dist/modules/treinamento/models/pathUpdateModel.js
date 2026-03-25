"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTrilhaPathsByPrefix = updateTrilhaPathsByPrefix;
exports.updateMaterialPathsByPrefix = updateMaterialPathsByPrefix;
exports.replaceMaterialStoredPathExact = replaceMaterialStoredPathExact;
const db_1 = require("../config/db");
function buildUpdateSql(table, column) {
    return `
    UPDATE ${table}
    SET ${column} = @NEW + SUBSTRING(${column}, LEN(@OLD) + 1, 4000)
    WHERE LEFT(${column}, LEN(@OLD) + 1) = @OLD + '/'
  `;
}
async function updateTrilhaPathsByPrefix(oldPrefix, newPrefix) {
    if (!oldPrefix || !newPrefix || oldPrefix === newPrefix) {
        return;
    }
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("OLD", db_1.sql.NVarChar(500), oldPrefix)
        .input("NEW", db_1.sql.NVarChar(500), newPrefix)
        .query(buildUpdateSql("dbo.TTRILHAS", "PATH"));
}
async function updateMaterialPathsByPrefix(oldPrefix, newPrefix) {
    if (!oldPrefix || !newPrefix || oldPrefix === newPrefix) {
        return;
    }
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("OLD", db_1.sql.NVarChar(1000), oldPrefix)
        .input("NEW", db_1.sql.NVarChar(1000), newPrefix)
        .query([
        buildUpdateSql("dbo.TVIDEOS", "PATH_VIDEO"),
        buildUpdateSql("dbo.TPDFS", "PDF_PATH"),
        buildUpdateSql("dbo.TPROVAS", "PROVA_PATH"),
    ].join("\n"));
}
async function replaceMaterialStoredPathExact(oldPath, newPath) {
    if (!oldPath || !newPath || oldPath === newPath) {
        return;
    }
    const pool = await (0, db_1.getPool)();
    await pool
        .request()
        .input("OLD", db_1.sql.NVarChar(1000), oldPath)
        .input("NEW", db_1.sql.NVarChar(1000), newPath)
        .query(`
      UPDATE dbo.TVIDEOS
      SET PATH_VIDEO = @NEW
      WHERE PATH_VIDEO = @OLD;

      UPDATE dbo.TPDFS
      SET PDF_PATH = @NEW
      WHERE PDF_PATH = @OLD
    `);
}
