import { getPool, sql } from "../config/db"
import { archiveVideoCompletionsByVideoId } from "./userTrainingModel"

export type VideoRecord = {
  ID: string
  TRILHA_FK_ID: string
  PATH_VIDEO: string | null
  PROCEDIMENTO_ID: string | null
  NORMA_ID: string | null
  PROCEDIMENTO_OBSERVACOES?: string | null
  NORMA_OBSERVACOES?: string | null
  VERSAO: number
  DURACAO_SEGUNDOS: number | null
  ORDEM: number | null
}

export async function listVideos(trilhaId?: string, cpf?: string) {
  const pool = await getPool()
  const request = pool.request()
  const conditions: string[] = []
  let join = ""

  if (cpf) {
    request.input("USUARIO_CPF", sql.VarChar(100), cpf)
    join = "JOIN dbo.TUSUARIO_TRILHAS ut ON ut.TRILHA_ID = v.TRILHA_FK_ID"
    conditions.push("ut.USUARIO_CPF = @USUARIO_CPF")
  }

  if (trilhaId) {
    request.input("TRILHA_FK_ID", sql.UniqueIdentifier, trilhaId)
    conditions.push("v.TRILHA_FK_ID = @TRILHA_FK_ID")
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const result = await request.query(`
    SELECT
      v.ID,
      v.TRILHA_FK_ID,
      v.PATH_VIDEO,
      v.PROCEDIMENTO_ID,
      v.NORMA_ID,
      pObs.OBSERVACOES AS PROCEDIMENTO_OBSERVACOES,
      nObs.OBSERVACOES AS NORMA_OBSERVACOES,
      v.VERSAO,
      v.DURACAO_SEGUNDOS,
      v.ORDEM
    FROM (
      SELECT
        v.ID,
        v.TRILHA_FK_ID,
        v.PATH_VIDEO,
        v.PROCEDIMENTO_ID,
        v.NORMA_ID,
        v.VERSAO,
        v.DURACAO_SEGUNDOS,
        v.ORDEM,
        ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
      FROM dbo.TVIDEOS v
      ${join}
      ${where}
    ) v
    OUTER APPLY (
      SELECT TOP 1 p.OBSERVACOES
      FROM dbo.TPROCEDIMENTOS p
      WHERE p.ID = v.PROCEDIMENTO_ID
      ORDER BY p.VERSAO DESC
    ) pObs
    OUTER APPLY (
      SELECT TOP 1 n.OBSERVACOES
      FROM dbo.TNORMAS n
      WHERE n.ID = v.NORMA_ID
      ORDER BY n.VERSAO DESC
    ) nObs
    WHERE v.RN = 1
    ORDER BY v.TRILHA_FK_ID, ISNULL(v.ORDEM, 2147483647), v.ID
  `)

  return result.recordset as VideoRecord[]
}

export async function getVideoById(id: string, versao?: number) {
  const pool = await getPool()
  const request = pool.request().input("ID", sql.UniqueIdentifier, id)

  if (versao !== undefined) {
    request.input("VERSAO", sql.Int, versao)
    const result = await request.query(
      "SELECT * FROM dbo.TVIDEOS WHERE ID = @ID AND VERSAO = @VERSAO",
    )
    return result.recordset[0] as VideoRecord | undefined
  }

  const result = await request.query(
    "SELECT TOP 1 * FROM dbo.TVIDEOS WHERE ID = @ID ORDER BY VERSAO DESC",
  )
  return result.recordset[0] as VideoRecord | undefined
}

export type VideoCreateInput = {
  id: string
  trilhaId: string
  pathVideo: string
  procedimentoId?: string | null
  normaId?: string | null
  duracaoSegundos?: number | null
  ordem?: number | null
}

export async function createVideo(input: VideoCreateInput) {
  const pool = await getPool()
  let ordem = input.ordem ?? null

  if (ordem === null) {
    const maxOrderResult = await pool
      .request()
      .input("TRILHA_FK_ID", sql.UniqueIdentifier, input.trilhaId)
      .query(
        "SELECT ISNULL(MAX(ORDEM), 0) AS MAX_ORDEM FROM dbo.TVIDEOS WHERE TRILHA_FK_ID = @TRILHA_FK_ID",
      )
    ordem = (maxOrderResult.recordset[0]?.MAX_ORDEM ?? 0) + 1
  }

  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, input.id)
    .input("TRILHA_FK_ID", sql.UniqueIdentifier, input.trilhaId)
    .input("PATH_VIDEO", sql.NVarChar(1000), input.pathVideo)
    .input("PROCEDIMENTO_ID", sql.UniqueIdentifier, input.procedimentoId ?? null)
    .input("NORMA_ID", sql.UniqueIdentifier, input.normaId ?? null)
    .input("DURACAO_SEGUNDOS", sql.Int, input.duracaoSegundos ?? 0)
    .input("ORDEM", sql.Int, ordem)
    .input("VERSAO", sql.Int, 1)
    .query(
      "INSERT INTO dbo.TVIDEOS (ID, TRILHA_FK_ID, PATH_VIDEO, PROCEDIMENTO_ID, NORMA_ID, DURACAO_SEGUNDOS, ORDEM, VERSAO) VALUES (@ID, @TRILHA_FK_ID, @PATH_VIDEO, @PROCEDIMENTO_ID, @NORMA_ID, @DURACAO_SEGUNDOS, @ORDEM, @VERSAO)",
    )

  return getVideoById(input.id)
}

export type VideoUpdateInput = {
  trilhaId?: string | null
  pathVideo?: string | null
  procedimentoId?: string | null
  normaId?: string | null
  duracaoSegundos?: number | null
  ordem?: number | null
}

export async function updateVideo(id: string, input: VideoUpdateInput) {
  const pool = await getPool()
  const latestResult = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("SELECT TOP 1 * FROM dbo.TVIDEOS WHERE ID = @ID ORDER BY VERSAO DESC")

  const latest = latestResult.recordset[0] as VideoRecord | undefined
  if (!latest) {
    return undefined
  }

  const nextVersion = (latest.VERSAO ?? 0) + 1
  const trilhaId = input.trilhaId ?? latest.TRILHA_FK_ID
  const pathVideo = input.pathVideo ?? latest.PATH_VIDEO ?? ""
  const procedimentoId =
    input.procedimentoId !== undefined
      ? input.procedimentoId
      : latest.PROCEDIMENTO_ID
  const normaId =
    input.normaId !== undefined
      ? input.normaId
      : latest.NORMA_ID
  const duracaoSegundos =
    input.duracaoSegundos ?? latest.DURACAO_SEGUNDOS ?? 0
  const ordem = input.ordem ?? latest.ORDEM ?? 0

  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("TRILHA_FK_ID", sql.UniqueIdentifier, trilhaId)
    .input("PATH_VIDEO", sql.NVarChar(1000), pathVideo)
    .input("PROCEDIMENTO_ID", sql.UniqueIdentifier, procedimentoId ?? null)
    .input("NORMA_ID", sql.UniqueIdentifier, normaId ?? null)
    .input("DURACAO_SEGUNDOS", sql.Int, duracaoSegundos)
    .input("ORDEM", sql.Int, ordem)
    .input("VERSAO", sql.Int, nextVersion)
    .query(
      "INSERT INTO dbo.TVIDEOS (ID, TRILHA_FK_ID, PATH_VIDEO, PROCEDIMENTO_ID, NORMA_ID, DURACAO_SEGUNDOS, ORDEM, VERSAO) VALUES (@ID, @TRILHA_FK_ID, @PATH_VIDEO, @PROCEDIMENTO_ID, @NORMA_ID, @DURACAO_SEGUNDOS, @ORDEM, @VERSAO)",
    )

  // Ao criar nova versao, conclusoes antigas ficam arquivadas
  // e os usuarios precisam refazer este video.
  await archiveVideoCompletionsByVideoId(id)

  return getVideoById(id)
}

export async function deleteVideo(id: string) {
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query("DELETE FROM dbo.TVIDEOS WHERE ID = @ID")
}

export async function setVideoOrder(id: string, ordem: number) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("ORDEM", sql.Int, ordem)
    .query("UPDATE dbo.TVIDEOS SET ORDEM = @ORDEM WHERE ID = @ID")

  if ((result.rowsAffected[0] ?? 0) === 0) {
    return undefined
  }

  return getVideoById(id)
}

export async function syncTrilhaVideosFromChannelVersion(
  previousPath: string,
  nextPath: string,
  duracaoSegundos?: number | null,
  procedimentoId?: string | null,
  normaId?: string | null,
) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("PATH_VIDEO", sql.NVarChar(1000), previousPath)
    .query(`
      SELECT l.ID
      FROM (
        SELECT
          v.ID,
          v.PATH_VIDEO,
          ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
        FROM dbo.TVIDEOS v
      ) l
      WHERE l.RN = 1
        AND l.PATH_VIDEO = @PATH_VIDEO
    `)

  const ids = result.recordset.map((row: { ID: string }) => String(row.ID))
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    await updateVideo(id, {
      pathVideo: nextPath,
      duracaoSegundos: duracaoSegundos ?? undefined,
      procedimentoId,
      normaId,
    })
  }

  return ids.length
}
