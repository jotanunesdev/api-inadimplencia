import { getPool, sql } from "../config/db"

export type ChannelVideoRecord = {
  ID: string
  CANAL_FK_ID: string
  PATH_VIDEO: string | null
  TIPO_CONTEUDO: "video" | "pdf"
  PROCEDIMENTO_ID: string | null
  NORMA_ID: string | null
  VERSAO: number
  DURACAO_SEGUNDOS: number | null
}

export async function listChannelVideoVersionsById(id: string) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query(`
      SELECT ID, CANAL_FK_ID, PATH_VIDEO, TIPO_CONTEUDO, PROCEDIMENTO_ID, NORMA_ID, VERSAO, DURACAO_SEGUNDOS
      FROM dbo.TCANAL_VIDEOS
      WHERE ID = @ID
      ORDER BY VERSAO DESC
    `)

  return result.recordset as ChannelVideoRecord[]
}

export async function listChannelVideos(canalId?: string) {
  const pool = await getPool()
  const request = pool.request()
  const conditions: string[] = []

  if (canalId) {
    request.input("CANAL_FK_ID", sql.UniqueIdentifier, canalId)
    conditions.push("v.CANAL_FK_ID = @CANAL_FK_ID")
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const result = await request.query(`
    SELECT ID, CANAL_FK_ID, PATH_VIDEO, TIPO_CONTEUDO, PROCEDIMENTO_ID, NORMA_ID, VERSAO, DURACAO_SEGUNDOS
    FROM (
      SELECT
        v.ID,
        v.CANAL_FK_ID,
        v.PATH_VIDEO,
        v.TIPO_CONTEUDO,
        v.PROCEDIMENTO_ID,
        v.NORMA_ID,
        v.VERSAO,
        v.DURACAO_SEGUNDOS,
        ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
      FROM dbo.TCANAL_VIDEOS v
      ${where}
    ) v
    WHERE v.RN = 1
  `)

  return result.recordset as ChannelVideoRecord[]
}

export async function getChannelVideoById(id: string, versao?: number) {
  const pool = await getPool()
  const request = pool.request().input("ID", sql.UniqueIdentifier, id)

  if (versao !== undefined) {
    request.input("VERSAO", sql.Int, versao)
    const result = await request.query(
      "SELECT * FROM dbo.TCANAL_VIDEOS WHERE ID = @ID AND VERSAO = @VERSAO",
    )
    return result.recordset[0] as ChannelVideoRecord | undefined
  }

  const result = await request.query(
    "SELECT TOP 1 * FROM dbo.TCANAL_VIDEOS WHERE ID = @ID ORDER BY VERSAO DESC",
  )
  return result.recordset[0] as ChannelVideoRecord | undefined
}

export type ChannelVideoCreateInput = {
  id: string
  canalId: string
  pathVideo: string
  tipoConteudo?: "video" | "pdf" | null
  procedimentoId?: string | null
  normaId?: string | null
  duracaoSegundos?: number | null
}

export async function createChannelVideo(input: ChannelVideoCreateInput) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, input.id)
    .input("CANAL_FK_ID", sql.UniqueIdentifier, input.canalId)
    .input("PATH_VIDEO", sql.NVarChar(1000), input.pathVideo)
    .input("TIPO_CONTEUDO", sql.VarChar(20), input.tipoConteudo ?? "video")
    .input("PROCEDIMENTO_ID", sql.UniqueIdentifier, input.procedimentoId ?? null)
    .input("NORMA_ID", sql.UniqueIdentifier, input.normaId ?? null)
    .input("DURACAO_SEGUNDOS", sql.Int, input.duracaoSegundos ?? 0)
    .input("VERSAO", sql.Int, 1)
    .query(
      "INSERT INTO dbo.TCANAL_VIDEOS (ID, CANAL_FK_ID, PATH_VIDEO, TIPO_CONTEUDO, PROCEDIMENTO_ID, NORMA_ID, DURACAO_SEGUNDOS, VERSAO) VALUES (@ID, @CANAL_FK_ID, @PATH_VIDEO, @TIPO_CONTEUDO, @PROCEDIMENTO_ID, @NORMA_ID, @DURACAO_SEGUNDOS, @VERSAO)",
    )

  return getChannelVideoById(input.id)
}

export type ChannelVideoUpdateInput = {
  canalId?: string | null
  pathVideo?: string | null
  tipoConteudo?: "video" | "pdf" | null
  procedimentoId?: string | null
  normaId?: string | null
  duracaoSegundos?: number | null
}

export async function updateChannelVideo(id: string, input: ChannelVideoUpdateInput) {
  const pool = await getPool()
  const latestResult = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query(
      "SELECT TOP 1 * FROM dbo.TCANAL_VIDEOS WHERE ID = @ID ORDER BY VERSAO DESC",
    )

  const latest = latestResult.recordset[0] as ChannelVideoRecord | undefined
  if (!latest) {
    return undefined
  }

  const nextVersion = (latest.VERSAO ?? 0) + 1
  const canalId = input.canalId ?? latest.CANAL_FK_ID
  const pathVideo = input.pathVideo ?? latest.PATH_VIDEO ?? ""
  const tipoConteudo = input.tipoConteudo ?? latest.TIPO_CONTEUDO ?? "video"
  const procedimentoId =
    input.procedimentoId !== undefined ? input.procedimentoId : latest.PROCEDIMENTO_ID
  const normaId = input.normaId !== undefined ? input.normaId : latest.NORMA_ID
  const duracaoSegundos =
    input.duracaoSegundos ?? latest.DURACAO_SEGUNDOS ?? 0

  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("CANAL_FK_ID", sql.UniqueIdentifier, canalId)
    .input("PATH_VIDEO", sql.NVarChar(1000), pathVideo)
    .input("TIPO_CONTEUDO", sql.VarChar(20), tipoConteudo)
    .input("PROCEDIMENTO_ID", sql.UniqueIdentifier, procedimentoId ?? null)
    .input("NORMA_ID", sql.UniqueIdentifier, normaId ?? null)
    .input("DURACAO_SEGUNDOS", sql.Int, duracaoSegundos)
    .input("VERSAO", sql.Int, nextVersion)
    .query(
      "INSERT INTO dbo.TCANAL_VIDEOS (ID, CANAL_FK_ID, PATH_VIDEO, TIPO_CONTEUDO, PROCEDIMENTO_ID, NORMA_ID, DURACAO_SEGUNDOS, VERSAO) VALUES (@ID, @CANAL_FK_ID, @PATH_VIDEO, @TIPO_CONTEUDO, @PROCEDIMENTO_ID, @NORMA_ID, @DURACAO_SEGUNDOS, @VERSAO)",
    )

  return getChannelVideoById(id)
}

export async function deleteChannelVideo(id: string) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("DELETE FROM dbo.TCANAL_VIDEOS WHERE ID = @ID")
}
