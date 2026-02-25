import { getPool, sql } from "../config/db"

export type TrainingMatrixRecord = {
  ID: string
  CARGO_FK: string
  CURSO_ID: string
  QTD_HORAS: number | null
  TITULO: string | null
  PROVA: Buffer | null
}

export async function listTrainingMatrix(cargo?: string) {
  const pool = await getPool()
  const request = pool.request()
  let query = "SELECT * FROM dbo.TMTREINAMENTO"

  if (cargo) {
    request.input("CARGO_FK", sql.VarChar(255), cargo)
    query += " WHERE CARGO_FK = @CARGO_FK"
  }

  const result = await request.query(query)
  return result.recordset as TrainingMatrixRecord[]
}

export async function getTrainingMatrixById(id: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("SELECT * FROM dbo.TMTREINAMENTO WHERE ID = @ID")

  return result.recordset[0] as TrainingMatrixRecord | undefined
}

export type TrainingMatrixInput = {
  id: string
  cargoFk: string
  cursoId: string
  qtdHoras?: number | null
  titulo?: string | null
  prova?: Buffer | null
}

export async function createTrainingMatrix(input: TrainingMatrixInput) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, input.id)
    .input("CARGO_FK", sql.VarChar(255), input.cargoFk)
    .input("CURSO_ID", sql.UniqueIdentifier, input.cursoId)
    .input("QTD_HORAS", sql.Int, input.qtdHoras ?? null)
    .input("TITULO", sql.VarChar(255), input.titulo ?? null)
    .input("PROVA", sql.VarBinary(sql.MAX), input.prova ?? null)
    .query(
      "INSERT INTO dbo.TMTREINAMENTO (ID, CARGO_FK, CURSO_ID, QTD_HORAS, TITULO, PROVA) VALUES (@ID, @CARGO_FK, @CURSO_ID, @QTD_HORAS, @TITULO, @PROVA)",
    )

  return getTrainingMatrixById(input.id)
}

export async function updateTrainingMatrix(
  id: string,
  input: Omit<TrainingMatrixInput, "id">,
) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("CARGO_FK", sql.VarChar(255), input.cargoFk)
    .input("CURSO_ID", sql.UniqueIdentifier, input.cursoId)
    .input("QTD_HORAS", sql.Int, input.qtdHoras ?? null)
    .input("TITULO", sql.VarChar(255), input.titulo ?? null)
    .input("PROVA", sql.VarBinary(sql.MAX), input.prova ?? null)
    .query(
      "UPDATE dbo.TMTREINAMENTO SET CARGO_FK = @CARGO_FK, CURSO_ID = @CURSO_ID, QTD_HORAS = @QTD_HORAS, TITULO = @TITULO, PROVA = @PROVA WHERE ID = @ID",
    )

  return getTrainingMatrixById(id)
}

export async function deleteTrainingMatrix(id: string) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("DELETE FROM dbo.TMTREINAMENTO WHERE ID = @ID")
}