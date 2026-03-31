import { getPool, sql } from "../config/db"

function buildUpdateSql(table: string, column: string) {
  return `
    UPDATE ${table}
    SET ${column} = @NEW + SUBSTRING(${column}, LEN(@OLD) + 1, 4000)
    WHERE LEFT(${column}, LEN(@OLD) + 1) = @OLD + '/'
  `
}

export async function updateTrilhaPathsByPrefix(
  oldPrefix: string,
  newPrefix: string,
) {
  if (!oldPrefix || !newPrefix || oldPrefix === newPrefix) {
    return
  }

  const pool = await getPool()
  await pool
    .request()
    .input("OLD", sql.NVarChar(500), oldPrefix)
    .input("NEW", sql.NVarChar(500), newPrefix)
    .query(buildUpdateSql("dbo.TTRILHAS", "PATH"))
}

export async function updateMaterialPathsByPrefix(
  oldPrefix: string,
  newPrefix: string,
) {
  if (!oldPrefix || !newPrefix || oldPrefix === newPrefix) {
    return
  }

  const pool = await getPool()
  await pool
    .request()
    .input("OLD", sql.NVarChar(2000), oldPrefix)
    .input("NEW", sql.NVarChar(2000), newPrefix)
    .query(
      [
        buildUpdateSql("dbo.TVIDEOS", "PATH_VIDEO"),
        buildUpdateSql("dbo.TPDFS", "PDF_PATH"),
        buildUpdateSql("dbo.TPROCEDIMENTOS", "PATH_PDF"),
        buildUpdateSql("dbo.TNORMAS", "PATH_PDF"),
        buildUpdateSql("dbo.TPROVAS", "PROVA_PATH"),
      ].join("\n"),
    )
}

export async function replaceMaterialStoredPathExact(
  oldPath: string,
  newPath: string,
) {
  if (!oldPath || !newPath || oldPath === newPath) {
    return
  }

  const pool = await getPool()
  await pool
    .request()
    .input("OLD", sql.NVarChar(2000), oldPath)
    .input("NEW", sql.NVarChar(2000), newPath)
    .query(`
      UPDATE dbo.TVIDEOS
      SET PATH_VIDEO = @NEW
      WHERE PATH_VIDEO = @OLD;

      UPDATE dbo.TPDFS
      SET PDF_PATH = @NEW
      WHERE PDF_PATH = @OLD;

      UPDATE dbo.TPROCEDIMENTOS
      SET PATH_PDF = @NEW
      WHERE PATH_PDF = @OLD;

      UPDATE dbo.TNORMAS
      SET PATH_PDF = @NEW
      WHERE PATH_PDF = @OLD
    `)
}
