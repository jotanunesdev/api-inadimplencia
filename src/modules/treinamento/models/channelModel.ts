import { getPool, sql } from "../config/db"

export type ChannelRecord = {
  ID: string
  NOME: string
  CRIADO_POR: string | null
  PATH: string | null
  CRIADO_EM?: Date | null
}

export async function listChannels() {
  const pool = await getPool()
  const result = await pool.request().query("SELECT * FROM dbo.TCANAIS ORDER BY NOME")
  return result.recordset as ChannelRecord[]
}

export async function getChannelById(id: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("SELECT * FROM dbo.TCANAIS WHERE ID = @ID")

  return result.recordset[0] as ChannelRecord | undefined
}

export type ChannelCreateInput = {
  id: string
  nome: string
  criadoPor?: string | null
  path?: string | null
}

export async function createChannel(input: ChannelCreateInput) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, input.id)
    .input("NOME", sql.NVarChar(255), input.nome)
    .input("CRIADO_POR", sql.NVarChar(255), input.criadoPor ?? null)
    .input("PATH", sql.NVarChar(500), input.path ?? null)
    .query(
      "INSERT INTO dbo.TCANAIS (ID, NOME, CRIADO_POR, PATH) VALUES (@ID, @NOME, @CRIADO_POR, @PATH)",
    )

  return getChannelById(input.id)
}

export type ChannelUpdateInput = {
  nome?: string | null
  criadoPor?: string | null
  path?: string | null
}

export async function updateChannel(id: string, input: ChannelUpdateInput) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("NOME", sql.NVarChar(255), input.nome ?? null)
    .input("CRIADO_POR", sql.NVarChar(255), input.criadoPor ?? null)
    .input("PATH", sql.NVarChar(500), input.path ?? null)
    .query(
      "UPDATE dbo.TCANAIS SET NOME = COALESCE(@NOME, NOME), CRIADO_POR = COALESCE(@CRIADO_POR, CRIADO_POR), PATH = COALESCE(@PATH, PATH) WHERE ID = @ID",
    )

  return getChannelById(id)
}

export async function deleteChannel(id: string) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("DELETE FROM dbo.TCANAIS WHERE ID = @ID")
}
