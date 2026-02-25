import { getPool, sql } from "../config/db"

export type CourseRecord = {
  ID: string
  TITULO: string | null
  DESCRICAO: string | null
  DURACAO: number | null
  MATERIAL_APOIO: string | null
}

export async function listCourses() {
  const pool = await getPool()
  const result = await pool.request().query("SELECT * FROM dbo.TCURSOS")
  return result.recordset as CourseRecord[]
}

export async function getCourseById(id: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("SELECT * FROM dbo.TCURSOS WHERE ID = @ID")

  return result.recordset[0] as CourseRecord | undefined
}

export type CourseInput = {
  id: string
  titulo?: string | null
  descricao?: string | null
  duracao?: number | null
  materialApoio?: string | null
}

export async function createCourse(input: CourseInput) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, input.id)
    .input("TITULO", sql.VarChar(255), input.titulo ?? null)
    .input("DESCRICAO", sql.VarChar(255), input.descricao ?? null)
    .input("DURACAO", sql.Int, input.duracao ?? null)
    .input("MATERIAL_APOIO", sql.NVarChar(sql.MAX), input.materialApoio ?? null)
    .query(
      "INSERT INTO dbo.TCURSOS (ID, TITULO, DESCRICAO, DURACAO, MATERIAL_APOIO) VALUES (@ID, @TITULO, @DESCRICAO, @DURACAO, @MATERIAL_APOIO)",
    )

  return getCourseById(input.id)
}

export async function updateCourse(id: string, input: Omit<CourseInput, "id">) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("TITULO", sql.VarChar(255), input.titulo ?? null)
    .input("DESCRICAO", sql.VarChar(255), input.descricao ?? null)
    .input("DURACAO", sql.Int, input.duracao ?? null)
    .input("MATERIAL_APOIO", sql.NVarChar(sql.MAX), input.materialApoio ?? null)
    .query(
      "UPDATE dbo.TCURSOS SET TITULO = @TITULO, DESCRICAO = @DESCRICAO, DURACAO = @DURACAO, MATERIAL_APOIO = @MATERIAL_APOIO WHERE ID = @ID",
    )

  return getCourseById(id)
}

export async function deleteCourse(id: string) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("DELETE FROM dbo.TCURSOS WHERE ID = @ID")
}