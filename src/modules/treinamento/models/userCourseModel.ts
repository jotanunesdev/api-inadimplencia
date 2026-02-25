import { getPool, sql } from "../config/db"

export type UserCourseRecord = {
  ID: string
  USUARIO_CPF: string
  CURSO_ID: string
  STATUS: string
  DT_INICIO: Date | null
  DT_CONCLUSAO: Date | null
}

export async function listUserCourses(cpf: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("USUARIO_CPF", sql.VarChar(100), cpf)
    .query(
      "SELECT * FROM dbo.TUSUARIO_CURSOS WHERE USUARIO_CPF = @USUARIO_CPF",
    )

  return result.recordset as UserCourseRecord[]
}

export async function createUserCourse(input: {
  id: string
  cpf: string
  cursoId: string
  status: string
  dtInicio?: Date | null
  dtConclusao?: Date | null
}) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, input.id)
    .input("USUARIO_CPF", sql.VarChar(100), input.cpf)
    .input("CURSO_ID", sql.UniqueIdentifier, input.cursoId)
    .input("STATUS", sql.VarChar(50), input.status)
    .input("DT_INICIO", sql.Date, input.dtInicio ?? null)
    .input("DT_CONCLUSAO", sql.Date, input.dtConclusao ?? null)
    .query(
      "INSERT INTO dbo.TUSUARIO_CURSOS (ID, USUARIO_CPF, CURSO_ID, STATUS, DT_INICIO, DT_CONCLUSAO) VALUES (@ID, @USUARIO_CPF, @CURSO_ID, @STATUS, @DT_INICIO, @DT_CONCLUSAO)",
    )
}

export async function updateUserCourse(
  id: string,
  input: {
    status: string
    dtInicio?: Date | null
    dtConclusao?: Date | null
  },
) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("STATUS", sql.VarChar(50), input.status)
    .input("DT_INICIO", sql.Date, input.dtInicio ?? null)
    .input("DT_CONCLUSAO", sql.Date, input.dtConclusao ?? null)
    .query(
      "UPDATE dbo.TUSUARIO_CURSOS SET STATUS = @STATUS, DT_INICIO = @DT_INICIO, DT_CONCLUSAO = @DT_CONCLUSAO WHERE ID = @ID",
    )
}

export async function deleteUserCourse(id: string) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("DELETE FROM dbo.TUSUARIO_CURSOS WHERE ID = @ID")
}