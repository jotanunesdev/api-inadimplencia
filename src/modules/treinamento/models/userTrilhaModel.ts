import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"
import type { TrilhaRecord } from "./trilhaModel"

export type UserTrilhaRecord = {
  ID: string
  USUARIO_CPF: string
  TRILHA_ID: string
  DT_ATRIBUICAO: Date
  ATRIBUIDO_POR: string | null
}

export async function assignTrilhas(
  cpf: string,
  trilhaIds: string[],
  atribuidoPor?: string | null,
) {
  const pool = await getPool()
  let inserted = 0

  for (const trilhaId of trilhaIds) {
    // eslint-disable-next-line no-await-in-loop
    const result = await pool
      .request()
      .input("ID", sql.UniqueIdentifier, randomUUID())
      .input("USUARIO_CPF", sql.VarChar(100), cpf)
      .input("TRILHA_ID", sql.UniqueIdentifier, trilhaId)
      .input("ATRIBUIDO_POR", sql.VarChar(100), atribuidoPor ?? null)
      .query(`
        INSERT INTO dbo.TUSUARIO_TRILHAS (
          ID,
          USUARIO_CPF,
          TRILHA_ID,
          ATRIBUIDO_POR
        )
        SELECT
          @ID,
          @USUARIO_CPF,
          @TRILHA_ID,
          @ATRIBUIDO_POR
        WHERE NOT EXISTS (
          SELECT 1
          FROM dbo.TUSUARIO_TRILHAS
          WHERE USUARIO_CPF = @USUARIO_CPF
            AND TRILHA_ID = @TRILHA_ID
        )
      `)

    if (result.rowsAffected[0] > 0) {
      inserted += 1
    }
  }

  return { inserted }
}

export async function listUserTrilhas(
  cpf: string,
  moduloId?: string,
): Promise<TrilhaRecord[]> {
  const pool = await getPool()
  const request = pool.request().input("USUARIO_CPF", sql.VarChar(100), cpf)
  let query = `
    SELECT t.*
    FROM dbo.TTRILHAS t
    JOIN dbo.TUSUARIO_TRILHAS ut ON ut.TRILHA_ID = t.ID
    WHERE ut.USUARIO_CPF = @USUARIO_CPF
  `

  if (moduloId) {
    request.input("MODULO_FK_ID", sql.UniqueIdentifier, moduloId)
    query += " AND t.MODULO_FK_ID = @MODULO_FK_ID"
  }

  const result = await request.query(query)
  return result.recordset as TrilhaRecord[]
}

export async function removeUserTrilha(cpf: string, trilhaId: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("USUARIO_CPF", sql.VarChar(100), cpf)
    .input("TRILHA_ID", sql.UniqueIdentifier, trilhaId)
    .query(
      "DELETE FROM dbo.TUSUARIO_TRILHAS WHERE USUARIO_CPF = @USUARIO_CPF AND TRILHA_ID = @TRILHA_ID",
    )

  return result.rowsAffected[0] > 0
}

export async function isUserAssignedToTrilha(cpf: string, trilhaId: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("USUARIO_CPF", sql.VarChar(100), cpf)
    .input("TRILHA_ID", sql.UniqueIdentifier, trilhaId)
    .query(`
      SELECT TOP 1 1 AS EXISTS_ROW
      FROM dbo.TUSUARIO_TRILHAS
      WHERE USUARIO_CPF = @USUARIO_CPF
        AND TRILHA_ID = @TRILHA_ID
    `)

  return result.recordset.length > 0
}
