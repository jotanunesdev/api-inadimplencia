import { getPool, sql } from "../config/db"
import { archiveExpiredNormaTrainings } from "./userTrainingModel"
import { getLatestUserFaceByCpf } from "./userFaceModel"
import { getUserByCpf } from "./userModel"

export type DossieIdentificacao = {
  cpf: string
  nomeCompleto: string
  funcao: string
  fotoBase64: string | null
  fotoUrl: string | null
}

export type DossieTreinamentoItem = {
  itemId: string
  itemNome: string
  dataHora: Date
  treinamento: string
  notaProva: number
  trilhaId: string
  fotoConfirmacaoBase64: string | null
  fotoConfirmacaoUrl: string | null
}

export type DossieData = {
  identificacao: DossieIdentificacao
  normasTreinadas: DossieTreinamentoItem[]
  procedimentosTreinados: DossieTreinamentoItem[]
}

export type DossieCandidate = {
  USUARIO_CPF: string
  USUARIO_NOME: string | null
  USUARIO_FUNCAO: string | null
  ULTIMA_CONCLUSAO: Date | null
  TOTAL_TREINAMENTOS: number
}

type DossieSectionRow = {
  ITEM_ID: string
  ITEM_NOME: string
  DATA_HORA: Date
  TREINAMENTO: string
  NOTA_PROVA: number
  TRILHA_ID: string
  FACE_CONFIRMACAO_FOTO_BASE64: string | null
  FACE_CONFIRMACAO_FOTO_URL: string | null
}

async function listDossieRowsByType(params: {
  cpf: string
  relationType: "norma" | "procedimento"
}) {
  const pool = await getPool()
  const trainingFaceColumns = await pool.request().query(`
    SELECT
      COL_LENGTH('dbo.TUSUARIO_TREINAMENTOS', 'FACE_CONFIRMACAO_FOTO_BASE64') AS HAS_FACE_BASE64,
      COL_LENGTH('dbo.TUSUARIO_TREINAMENTOS', 'FACE_CONFIRMACAO_FOTO_URL') AS HAS_FACE_URL,
      COL_LENGTH('dbo.TUSUARIO_TREINAMENTOS', 'FACE_CONFIRMACAO_EM') AS HAS_FACE_AT
  `)
  const hasFaceEvidenceColumns =
    Boolean(trainingFaceColumns.recordset[0]?.HAS_FACE_BASE64) &&
    Boolean(trainingFaceColumns.recordset[0]?.HAS_FACE_URL) &&
    Boolean(trainingFaceColumns.recordset[0]?.HAS_FACE_AT)

  const treinoFaceColumns = hasFaceEvidenceColumns
    ? `,
        ut.FACE_CONFIRMACAO_FOTO_BASE64,
        ut.FACE_CONFIRMACAO_FOTO_URL,
        ut.FACE_CONFIRMACAO_EM`
    : `,
        CAST(NULL AS NVARCHAR(MAX)) AS FACE_CONFIRMACAO_FOTO_BASE64,
        CAST(NULL AS NVARCHAR(2000)) AS FACE_CONFIRMACAO_FOTO_URL,
        CAST(NULL AS DATETIME2) AS FACE_CONFIRMACAO_EM`

  const request = pool
    .request()
    .input("USUARIO_CPF", sql.VarChar(100), params.cpf)
    .input("RELATION_TYPE", sql.VarChar(20), params.relationType)

  const result = await request.query(`
    ;WITH VIDEO_LATEST AS (
      SELECT
        v.ID,
        v.TRILHA_FK_ID,
        v.PROCEDIMENTO_ID,
        v.NORMA_ID,
        v.VERSAO,
        ROW_NUMBER() OVER (PARTITION BY v.ID ORDER BY v.VERSAO DESC) AS RN
      FROM dbo.TVIDEOS v
    ),
    PDF_LATEST AS (
      SELECT
        p.ID,
        p.TRILHA_FK_ID,
        p.PROCEDIMENTO_ID,
        p.NORMA_ID,
        p.VERSAO,
        ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
      FROM dbo.TPDFS p
    ),
    PROCEDIMENTO_LATEST AS (
      SELECT x.ID, x.NOME
      FROM (
        SELECT
          p.ID,
          p.NOME,
          ROW_NUMBER() OVER (PARTITION BY p.ID ORDER BY p.VERSAO DESC) AS RN
        FROM dbo.TPROCEDIMENTOS p
      ) x
      WHERE x.RN = 1
    ),
    NORMA_LATEST AS (
      SELECT x.ID, x.NOME
      FROM (
        SELECT
          n.ID,
          n.NOME,
          ROW_NUMBER() OVER (PARTITION BY n.ID ORDER BY n.VERSAO DESC) AS RN
        FROM dbo.TNORMAS n
      ) x
      WHERE x.RN = 1
    ),
    ULTIMA_TENTATIVA_TRILHA AS (
      SELECT
        a.TRILHA_ID,
        a.NOTA,
        a.STATUS,
        a.DT_REALIZACAO,
        ROW_NUMBER() OVER (
          PARTITION BY a.TRILHA_ID
          ORDER BY a.DT_REALIZACAO DESC, a.ID DESC
        ) AS RN
      FROM dbo.TUSUARIO_PROVA_TENTATIVAS a
      WHERE a.USUARIO_CPF = @USUARIO_CPF
    ),
    TREINOS_ATIVOS AS (
      SELECT
        ut.USUARIO_CPF,
        ut.TIPO,
        ut.MATERIAL_ID,
        ut.MATERIAL_VERSAO,
        ut.DT_CONCLUSAO
        ${treinoFaceColumns}
      FROM dbo.TUSUARIO_TREINAMENTOS ut
      WHERE ut.USUARIO_CPF = @USUARIO_CPF
        AND ut.ARQUIVADO_EM IS NULL
        AND ut.TIPO IN ('video', 'pdf')
    ),
    MATERIAIS_ATUAIS AS (
      SELECT
        ut.DT_CONCLUSAO,
        vl.TRILHA_FK_ID AS TRILHA_ID,
        vl.PROCEDIMENTO_ID,
        vl.NORMA_ID,
        ut.FACE_CONFIRMACAO_FOTO_BASE64,
        ut.FACE_CONFIRMACAO_FOTO_URL,
        ut.FACE_CONFIRMACAO_EM
      FROM TREINOS_ATIVOS ut
      JOIN VIDEO_LATEST vl
        ON ut.TIPO = 'video'
       AND vl.RN = 1
       AND vl.ID = ut.MATERIAL_ID
       AND (
         (ut.MATERIAL_VERSAO IS NOT NULL AND vl.VERSAO = ut.MATERIAL_VERSAO)
         OR ut.MATERIAL_VERSAO IS NULL
       )

      UNION ALL

      SELECT
        ut.DT_CONCLUSAO,
        pl.TRILHA_FK_ID AS TRILHA_ID,
        pl.PROCEDIMENTO_ID,
        pl.NORMA_ID,
        ut.FACE_CONFIRMACAO_FOTO_BASE64,
        ut.FACE_CONFIRMACAO_FOTO_URL,
        ut.FACE_CONFIRMACAO_EM
      FROM TREINOS_ATIVOS ut
      JOIN PDF_LATEST pl
        ON ut.TIPO = 'pdf'
       AND pl.RN = 1
       AND pl.ID = ut.MATERIAL_ID
       AND (
         (ut.MATERIAL_VERSAO IS NOT NULL AND pl.VERSAO = ut.MATERIAL_VERSAO)
         OR ut.MATERIAL_VERSAO IS NULL
       )
    )
    ,
    MATERIAIS_RELACIONADOS AS (
      SELECT
        CAST(
          CASE WHEN @RELATION_TYPE = 'norma' THEN ma.NORMA_ID ELSE ma.PROCEDIMENTO_ID END
          AS UNIQUEIDENTIFIER
        ) AS ITEM_ID,
        CASE
          WHEN @RELATION_TYPE = 'norma' THEN nl.NOME
          ELSE pl2.NOME
        END AS ITEM_NOME,
        ma.DT_CONCLUSAO AS DATA_HORA,
        t.TITULO AS TREINAMENTO,
        CAST(lt.NOTA AS DECIMAL(10,2)) AS NOTA_PROVA,
        t.ID AS TRILHA_ID,
        ma.FACE_CONFIRMACAO_FOTO_BASE64,
        ma.FACE_CONFIRMACAO_FOTO_URL,
        ma.FACE_CONFIRMACAO_EM
      FROM MATERIAIS_ATUAIS ma
      JOIN dbo.TTRILHAS t ON t.ID = ma.TRILHA_ID
      JOIN ULTIMA_TENTATIVA_TRILHA lt
        ON lt.TRILHA_ID = ma.TRILHA_ID
       AND lt.RN = 1
       AND lt.STATUS = 'aprovado'
      LEFT JOIN NORMA_LATEST nl ON nl.ID = ma.NORMA_ID
      LEFT JOIN PROCEDIMENTO_LATEST pl2 ON pl2.ID = ma.PROCEDIMENTO_ID
      WHERE (
        (@RELATION_TYPE = 'norma' AND ma.NORMA_ID IS NOT NULL)
        OR (@RELATION_TYPE = 'procedimento' AND ma.PROCEDIMENTO_ID IS NOT NULL)
      )
    ),
    RANKEADO AS (
      SELECT
        mr.*,
        ROW_NUMBER() OVER (
          PARTITION BY mr.ITEM_ID, mr.TRILHA_ID
          ORDER BY mr.DATA_HORA DESC, mr.FACE_CONFIRMACAO_EM DESC
        ) AS RN
      FROM MATERIAIS_RELACIONADOS mr
    )
    SELECT
      ITEM_ID,
      ITEM_NOME,
      DATA_HORA,
      TREINAMENTO,
      NOTA_PROVA,
      TRILHA_ID,
      FACE_CONFIRMACAO_FOTO_BASE64,
      FACE_CONFIRMACAO_FOTO_URL
    FROM RANKEADO
    WHERE RN = 1
    ORDER BY DATA_HORA DESC, TREINAMENTO
  `)

  return result.recordset as DossieSectionRow[]
}

export async function getDossieDataByCpf(cpf: string): Promise<DossieData | null> {
  await archiveExpiredNormaTrainings()

  const [user, latestFace, normasRows, procedimentosRows] = await Promise.all([
    getUserByCpf(cpf),
    getLatestUserFaceByCpf(cpf),
    listDossieRowsByType({ cpf, relationType: "norma" }),
    listDossieRowsByType({ cpf, relationType: "procedimento" }),
  ])

  if (!user) {
    return null
  }

  const nomeCompleto = String(user.NOME ?? "").trim()
  const funcao = String(user.CARGO ?? "").trim()
  if (!nomeCompleto) {
    return null
  }

  const mapRows = (rows: DossieSectionRow[]): DossieTreinamentoItem[] =>
    rows
      .filter((row) => row.ITEM_ID && row.ITEM_NOME && row.TREINAMENTO)
      .map((row) => ({
        itemId: row.ITEM_ID,
        itemNome: row.ITEM_NOME,
        dataHora: new Date(row.DATA_HORA),
        treinamento: row.TREINAMENTO,
        notaProva: Number(row.NOTA_PROVA ?? 0),
        trilhaId: row.TRILHA_ID,
        fotoConfirmacaoBase64: row.FACE_CONFIRMACAO_FOTO_BASE64 ?? null,
        fotoConfirmacaoUrl: row.FACE_CONFIRMACAO_FOTO_URL ?? null,
      }))

  return {
    identificacao: {
      cpf,
      nomeCompleto,
      funcao: funcao || "-",
      fotoBase64: latestFace?.FOTO_BASE64 ?? null,
      fotoUrl: latestFace?.FOTO_URL ?? null,
    },
    normasTreinadas: mapRows(normasRows),
    procedimentosTreinados: mapRows(procedimentosRows),
  }
}

export async function listDossieCandidates(): Promise<DossieCandidate[]> {
  await archiveExpiredNormaTrainings()

  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      ut.USUARIO_CPF,
      MAX(u.NOME) AS USUARIO_NOME,
      MAX(u.CARGO) AS USUARIO_FUNCAO,
      MAX(ut.DT_CONCLUSAO) AS ULTIMA_CONCLUSAO,
      COUNT(1) AS TOTAL_TREINAMENTOS
    FROM dbo.TUSUARIO_TREINAMENTOS ut
    LEFT JOIN dbo.TUSUARIOS u
      ON u.CPF = ut.USUARIO_CPF
    WHERE ut.DT_CONCLUSAO IS NOT NULL
    GROUP BY ut.USUARIO_CPF
    ORDER BY MAX(ut.DT_CONCLUSAO) DESC, MAX(u.NOME)
  `)

  return result.recordset as DossieCandidate[]
}
