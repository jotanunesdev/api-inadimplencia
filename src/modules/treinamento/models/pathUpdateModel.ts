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
    .input("OLD", sql.NVarChar(1000), oldPrefix)
    .input("NEW", sql.NVarChar(1000), newPrefix)
    .query(
      [
        buildUpdateSql("dbo.TVIDEOS", "PATH_VIDEO"),
        buildUpdateSql("dbo.TPDFS", "PDF_PATH"),
        buildUpdateSql("dbo.TPROVAS", "PROVA_PATH"),
      ].join("\n"),
    )
}
