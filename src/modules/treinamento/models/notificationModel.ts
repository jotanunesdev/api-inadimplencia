import { getPool, sql } from "../config/db"
import { archiveExpiredNormaTrainings } from "./userTrainingModel"

export type NotificationStatusFilter = "pendente" | "lida" | "todas"

export type NormaExpiryNotificationRecord = {
  ID: string
  USUARIO_CPF: string
  USUARIO_NOME: string | null
  USUARIO_FUNCAO: string | null
  TIPO_MATERIAL: "video" | "pdf"
  MATERIAL_ID: string
  MATERIAL_VERSAO: number | null
  NORMA_ID: string
  NORMA_NOME: string | null
  TRILHA_ID: string | null
  TRILHA_TITULO: string | null
  MODULO_ID: string | null
  MODULO_NOME: string | null
  DT_CONCLUSAO: Date
  VENCE_EM: Date
  DIAS_RESTANTES: number
  CRIADO_EM: Date
  LIDA_EM: Date | null
}

async function hasNormaValidityColumns() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      COL_LENGTH('dbo.TNORMAS', 'VALIDADE_MESES') AS HAS_VALIDADE_MESES,
      COL_LENGTH('dbo.TNORMAS', 'VALIDADE_ANOS') AS HAS_VALIDADE_ANOS
  `)

  const row = result.recordset[0] as
    | { HAS_VALIDADE_MESES: number | null; HAS_VALIDADE_ANOS: number | null }
    | undefined
  return Boolean(row?.HAS_VALIDADE_MESES) && Boolean(row?.HAS_VALIDADE_ANOS)
}

export async function generateNormaExpiryNotifications(lookaheadDays = 7) {
  const normalizedLookahead = Math.max(1, Math.trunc(lookaheadDays))

  if (!(await hasNormaValidityColumns())) {
    return 0
  }

  await archiveExpiredNormaTrainings()

  const pool = await getPool()
  const result = await pool
    .request()
    .input("LOOKAHEAD_DAYS", sql.Int, normalizedLookahead)
    .query(`
      ;WITH NORMA_LATEST AS (
        SELECT
          n.ID,
          n.NOME,
          (ISNULL(n.VALIDADE_ANOS, 0) * 12) + ISNULL(n.VALIDADE_MESES, 0) AS VALIDADE_TOTAL_MESES
        FROM (
          SELECT
            ID,
            NOME,
            VALIDADE_MESES,
            VALIDADE_ANOS,
            ROW_NUMBER() OVER (PARTITION BY ID ORDER BY VERSAO DESC) AS RN
          FROM dbo.TNORMAS
        ) n
        WHERE n.RN = 1
      ),
      BASE AS (
        SELECT
          ut.USUARIO_CPF,
          CAST(ut.TIPO AS VARCHAR(20)) AS TIPO_MATERIAL,
          ut.MATERIAL_ID,
          ut.MATERIAL_VERSAO,
          ut.DT_CONCLUSAO,
          COALESCE(vref.NORMA_ID, pref.NORMA_ID) AS NORMA_ID,
          COALESCE(vref.TRILHA_ID, pref.TRILHA_ID) AS TRILHA_ID
        FROM dbo.TUSUARIO_TREINAMENTOS ut
        OUTER APPLY (
          SELECT TOP 1
            vv.NORMA_ID,
            vv.TRILHA_FK_ID AS TRILHA_ID
          FROM dbo.TVIDEOS vv
          WHERE ut.TIPO = 'video'
            AND vv.ID = ut.MATERIAL_ID
            AND (
              (ut.MATERIAL_VERSAO IS NOT NULL AND vv.VERSAO = ut.MATERIAL_VERSAO)
              OR ut.MATERIAL_VERSAO IS NULL
            )
          ORDER BY
            CASE
              WHEN ut.MATERIAL_VERSAO IS NOT NULL AND vv.VERSAO = ut.MATERIAL_VERSAO THEN 0
              ELSE 1
            END,
            vv.VERSAO DESC
        ) vref
        OUTER APPLY (
          SELECT TOP 1
            pp.NORMA_ID,
            pp.TRILHA_FK_ID AS TRILHA_ID
          FROM dbo.TPDFS pp
          WHERE ut.TIPO = 'pdf'
            AND pp.ID = ut.MATERIAL_ID
            AND (
              (ut.MATERIAL_VERSAO IS NOT NULL AND pp.VERSAO = ut.MATERIAL_VERSAO)
              OR ut.MATERIAL_VERSAO IS NULL
            )
          ORDER BY
            CASE
              WHEN ut.MATERIAL_VERSAO IS NOT NULL AND pp.VERSAO = ut.MATERIAL_VERSAO THEN 0
              ELSE 1
            END,
            pp.VERSAO DESC
        ) pref
        WHERE ut.ARQUIVADO_EM IS NULL
          AND ut.TIPO IN ('video', 'pdf')
      ),
      BASE_NORMA AS (
        SELECT
          b.USUARIO_CPF,
          b.TIPO_MATERIAL,
          b.MATERIAL_ID,
          b.MATERIAL_VERSAO,
          b.DT_CONCLUSAO,
          b.NORMA_ID,
          n.NOME AS NORMA_NOME,
          b.TRILHA_ID,
          DATEADD(MONTH, n.VALIDADE_TOTAL_MESES, b.DT_CONCLUSAO) AS VENCE_EM
        FROM BASE b
        JOIN NORMA_LATEST n ON n.ID = b.NORMA_ID
        WHERE n.VALIDADE_TOTAL_MESES > 0
      ),
      UPCOMING AS (
        SELECT *
        FROM BASE_NORMA
        WHERE VENCE_EM >= SYSUTCDATETIME()
          AND VENCE_EM <= DATEADD(DAY, @LOOKAHEAD_DAYS, SYSUTCDATETIME())
      )
      INSERT INTO dbo.TNOTIFICACOES_GESTAO (
        ID,
        USUARIO_CPF,
        TIPO_MATERIAL,
        MATERIAL_ID,
        MATERIAL_VERSAO,
        NORMA_ID,
        TRILHA_ID,
        DT_CONCLUSAO,
        VENCE_EM,
        CRIADO_EM
      )
      SELECT
        NEWID(),
        up.USUARIO_CPF,
        up.TIPO_MATERIAL,
        up.MATERIAL_ID,
        up.MATERIAL_VERSAO,
        up.NORMA_ID,
        up.TRILHA_ID,
        up.DT_CONCLUSAO,
        up.VENCE_EM,
        SYSUTCDATETIME()
      FROM UPCOMING up
      WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.TNOTIFICACOES_GESTAO n
        WHERE n.USUARIO_CPF = up.USUARIO_CPF
          AND n.TIPO_MATERIAL = up.TIPO_MATERIAL
          AND n.MATERIAL_ID = up.MATERIAL_ID
          AND (
            (n.MATERIAL_VERSAO IS NULL AND up.MATERIAL_VERSAO IS NULL)
            OR n.MATERIAL_VERSAO = up.MATERIAL_VERSAO
          )
          AND n.VENCE_EM = up.VENCE_EM
      )
    `)

  return result.rowsAffected[0] ?? 0
}

export async function listNormaExpiryNotifications(
  status: NotificationStatusFilter = "pendente",
) {
  const pool = await getPool()
  const request = pool.request()

  let statusClause = ""
  if (status === "pendente") {
    statusClause = "AND n.LIDA_EM IS NULL"
  } else if (status === "lida") {
    statusClause = "AND n.LIDA_EM IS NOT NULL"
  }

  const result = await request.query(`
      SELECT
        n.ID,
        n.USUARIO_CPF,
        u.NOME AS USUARIO_NOME,
        u.CARGO AS USUARIO_FUNCAO,
        n.TIPO_MATERIAL,
        n.MATERIAL_ID,
        n.MATERIAL_VERSAO,
        n.NORMA_ID,
        norma_latest.NOME AS NORMA_NOME,
        n.TRILHA_ID,
        tr.TITULO AS TRILHA_TITULO,
        tr.MODULO_FK_ID AS MODULO_ID,
        m.NOME AS MODULO_NOME,
        n.DT_CONCLUSAO,
        n.VENCE_EM,
        DATEDIFF(DAY, SYSUTCDATETIME(), n.VENCE_EM) AS DIAS_RESTANTES,
        n.CRIADO_EM,
        n.LIDA_EM
      FROM dbo.TNOTIFICACOES_GESTAO n
      LEFT JOIN dbo.TUSUARIOS u ON u.CPF = n.USUARIO_CPF
      LEFT JOIN dbo.TTRILHAS tr ON tr.ID = n.TRILHA_ID
      LEFT JOIN dbo.TMODULOS m ON m.ID = tr.MODULO_FK_ID
      LEFT JOIN (
        SELECT ID, NOME
        FROM (
          SELECT
            nn.ID,
            nn.NOME,
            ROW_NUMBER() OVER (PARTITION BY nn.ID ORDER BY nn.VERSAO DESC) AS RN
          FROM dbo.TNORMAS nn
        ) l
        WHERE l.RN = 1
      ) norma_latest ON norma_latest.ID = n.NORMA_ID
      WHERE 1 = 1
      ${statusClause}
      ORDER BY
        CASE WHEN n.LIDA_EM IS NULL THEN 0 ELSE 1 END,
        n.VENCE_EM ASC,
        n.CRIADO_EM DESC
    `)

  return result.recordset as NormaExpiryNotificationRecord[]
}

export async function markNormaExpiryNotificationAsRead(
  id: string,
  read: boolean,
) {
  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .query(
      read
        ? `
            UPDATE dbo.TNOTIFICACOES_GESTAO
            SET LIDA_EM = SYSUTCDATETIME()
            WHERE ID = @ID
          `
        : `
            UPDATE dbo.TNOTIFICACOES_GESTAO
            SET LIDA_EM = NULL
            WHERE ID = @ID
          `,
    )

  return (result.rowsAffected[0] ?? 0) > 0
}
