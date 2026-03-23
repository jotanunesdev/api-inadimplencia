import { randomUUID } from "crypto"
import { getPool, sql } from "../config/db"

export type ProfileMessageReactionType = "like" | "dislike"

export type ProfileMessageRecord = {
  ID: string
  PERFIL_USERNAME: string
  PARENT_ID: string | null
  AUTOR_USERNAME: string
  AUTOR_NOME: string | null
  AUTOR_CARGO: string | null
  CONTEUDO: string
  CRIADO_EM: Date
  ATUALIZADO_EM: Date
  CURTIDAS: number
  DESCURTIDAS: number
  REACAO_ATUAL: ProfileMessageReactionType | null
}

export type ProfileMessageItem = {
  id: string
  profileUsername: string
  parentId: string | null
  authorUsername: string
  authorName: string | null
  authorJobTitle: string | null
  content: string
  createdAt: string
  updatedAt: string
}

const normalizeUsernameValue = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    ?.trim() ?? ""

let ensureProfileMessageSchemaPromise: Promise<void> | null = null

function mapProfileMessageRecord(record: ProfileMessageRecord): ProfileMessageItem {
  return {
    id: record.ID,
    profileUsername: record.PERFIL_USERNAME,
    parentId: record.PARENT_ID,
    authorUsername: record.AUTOR_USERNAME,
    authorName: record.AUTOR_NOME,
    authorJobTitle: record.AUTOR_CARGO,
    content: record.CONTEUDO,
    createdAt: new Date(record.CRIADO_EM).toISOString(),
    updatedAt: new Date(record.ATUALIZADO_EM).toISOString(),
  }
}

async function ensureProfileMessageSchema() {
  if (!ensureProfileMessageSchemaPromise) {
    ensureProfileMessageSchemaPromise = (async () => {
      const pool = await getPool()
      await pool.request().query(`
        IF OBJECT_ID('dbo.TPERFIL_MENSAGENS', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TPERFIL_MENSAGENS (
            ID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
            PERFIL_USERNAME VARCHAR(255) NOT NULL,
            PARENT_ID UNIQUEIDENTIFIER NULL,
            AUTOR_USERNAME VARCHAR(255) NOT NULL,
            AUTOR_NOME NVARCHAR(255) NULL,
            AUTOR_CARGO NVARCHAR(255) NULL,
            CONTEUDO NVARCHAR(MAX) NOT NULL,
            CRIADO_EM DATETIME2 NOT NULL,
            ATUALIZADO_EM DATETIME2 NOT NULL
          )

          CREATE INDEX IX_TPERFIL_MENSAGENS_PERFIL_CRIADO
            ON dbo.TPERFIL_MENSAGENS (PERFIL_USERNAME, CRIADO_EM)

          CREATE INDEX IX_TPERFIL_MENSAGENS_PARENT
            ON dbo.TPERFIL_MENSAGENS (PARENT_ID, CRIADO_EM)
        END

        IF OBJECT_ID('dbo.TPERFIL_MENSAGENS_REACOES', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.TPERFIL_MENSAGENS_REACOES (
            MENSAGEM_ID UNIQUEIDENTIFIER NOT NULL,
            USUARIO_USERNAME VARCHAR(255) NOT NULL,
            TIPO VARCHAR(10) NOT NULL,
            REAGIDO_EM DATETIME2 NOT NULL,
            CONSTRAINT PK_TPERFIL_MENSAGENS_REACOES PRIMARY KEY (MENSAGEM_ID, USUARIO_USERNAME),
            CONSTRAINT FK_TPERFIL_MENSAGENS_REACOES_MENSAGEM
              FOREIGN KEY (MENSAGEM_ID)
              REFERENCES dbo.TPERFIL_MENSAGENS(ID)
              ON DELETE CASCADE
          )

          CREATE INDEX IX_TPERFIL_MENSAGENS_REACOES_TIPO
            ON dbo.TPERFIL_MENSAGENS_REACOES (MENSAGEM_ID, TIPO)
        END
      `)
    })().finally(() => {
      ensureProfileMessageSchemaPromise = null
    })
  }

  await ensureProfileMessageSchemaPromise
}

export async function listProfileMessages(params: {
  profileUsername: string
  viewerUsername?: string | null
}) {
  await ensureProfileMessageSchema()

  const profileUsername = normalizeUsernameValue(params.profileUsername)
  const viewerUsername = normalizeUsernameValue(params.viewerUsername)

  const pool = await getPool()
  const result = await pool
    .request()
    .input("PERFIL_USERNAME", sql.VarChar(255), profileUsername)
    .input("VIEWER_USERNAME", sql.VarChar(255), viewerUsername || null)
    .query(`
      SELECT
        m.ID,
        m.PERFIL_USERNAME,
        m.PARENT_ID,
        m.AUTOR_USERNAME,
        m.AUTOR_NOME,
        m.AUTOR_CARGO,
        m.CONTEUDO,
        m.CRIADO_EM,
        m.ATUALIZADO_EM,
        SUM(CASE WHEN r.TIPO = 'like' THEN 1 ELSE 0 END) AS CURTIDAS,
        SUM(CASE WHEN r.TIPO = 'dislike' THEN 1 ELSE 0 END) AS DESCURTIDAS,
        CAST(MAX(CASE WHEN @VIEWER_USERNAME IS NOT NULL AND r.USUARIO_USERNAME = @VIEWER_USERNAME THEN r.TIPO ELSE NULL END) AS VARCHAR(10)) AS REACAO_ATUAL
      FROM dbo.TPERFIL_MENSAGENS m
      LEFT JOIN dbo.TPERFIL_MENSAGENS_REACOES r
        ON r.MENSAGEM_ID = m.ID
      WHERE m.PERFIL_USERNAME = @PERFIL_USERNAME
      GROUP BY
        m.ID,
        m.PERFIL_USERNAME,
        m.PARENT_ID,
        m.AUTOR_USERNAME,
        m.AUTOR_NOME,
        m.AUTOR_CARGO,
        m.CONTEUDO,
        m.CRIADO_EM,
        m.ATUALIZADO_EM
      ORDER BY m.CRIADO_EM ASC, m.ID ASC
    `)

  return result.recordset as ProfileMessageRecord[]
}

export async function createProfileMessage(input: {
  profileUsername: string
  parentId?: string | null
  authorUsername: string
  authorName?: string | null
  authorJobTitle?: string | null
  content: string
}) {
  await ensureProfileMessageSchema()

  const profileUsername = normalizeUsernameValue(input.profileUsername)
  const authorUsername = normalizeUsernameValue(input.authorUsername)
  const content = String(input.content ?? "").trim()
  const parentId = String(input.parentId ?? "").trim() || null

  if (parentId) {
    const pool = await getPool()
    const parentResult = await pool
      .request()
      .input("ID", sql.UniqueIdentifier, parentId)
      .input("PERFIL_USERNAME", sql.VarChar(255), profileUsername)
      .query(`
        SELECT TOP 1 ID
        FROM dbo.TPERFIL_MENSAGENS
        WHERE ID = @ID
          AND PERFIL_USERNAME = @PERFIL_USERNAME
      `)

    if (!parentResult.recordset[0]?.ID) {
      throw new Error("PROFILE_MESSAGE_PARENT_NOT_FOUND")
    }
  }

  const id = randomUUID()
  const createdAt = new Date()
  const pool = await getPool()
  await pool
    .request()
    .input("ID", sql.UniqueIdentifier, id)
    .input("PERFIL_USERNAME", sql.VarChar(255), profileUsername)
    .input("PARENT_ID", sql.UniqueIdentifier, parentId)
    .input("AUTOR_USERNAME", sql.VarChar(255), authorUsername)
    .input("AUTOR_NOME", sql.NVarChar(255), String(input.authorName ?? "").trim() || null)
    .input("AUTOR_CARGO", sql.NVarChar(255), String(input.authorJobTitle ?? "").trim() || null)
    .input("CONTEUDO", sql.NVarChar(sql.MAX), content)
    .input("CRIADO_EM", sql.DateTime2, createdAt)
    .query(`
      INSERT INTO dbo.TPERFIL_MENSAGENS (
        ID,
        PERFIL_USERNAME,
        PARENT_ID,
        AUTOR_USERNAME,
        AUTOR_NOME,
        AUTOR_CARGO,
        CONTEUDO,
        CRIADO_EM,
        ATUALIZADO_EM
      )
      VALUES (
        @ID,
        @PERFIL_USERNAME,
        @PARENT_ID,
        @AUTOR_USERNAME,
        @AUTOR_NOME,
        @AUTOR_CARGO,
        @CONTEUDO,
        @CRIADO_EM,
        @CRIADO_EM
      )
    `)

  return id
}

export async function getProfileMessageById(messageId: string) {
  await ensureProfileMessageSchema()

  const normalizedMessageId = String(messageId ?? "").trim()
  if (!normalizedMessageId) {
    return null
  }

  const pool = await getPool()
  const result = await pool
    .request()
    .input("ID", sql.UniqueIdentifier, normalizedMessageId)
    .query(`
      SELECT TOP 1
        ID,
        PERFIL_USERNAME,
        PARENT_ID,
        AUTOR_USERNAME,
        AUTOR_NOME,
        AUTOR_CARGO,
        CONTEUDO,
        CRIADO_EM,
        ATUALIZADO_EM,
        CAST(0 AS INT) AS CURTIDAS,
        CAST(0 AS INT) AS DESCURTIDAS,
        CAST(NULL AS VARCHAR(10)) AS REACAO_ATUAL
      FROM dbo.TPERFIL_MENSAGENS
      WHERE ID = @ID
    `)

  const record = result.recordset[0] as ProfileMessageRecord | undefined
  return record ? mapProfileMessageRecord(record) : null
}

export async function setProfileMessageReaction(input: {
  messageId: string
  username: string
  reaction: ProfileMessageReactionType | null
}) {
  await ensureProfileMessageSchema()

  const messageId = String(input.messageId ?? "").trim()
  const username = normalizeUsernameValue(input.username)
  const reaction = input.reaction
  const reactedAt = new Date()

  const pool = await getPool()
  if (!reaction) {
    await pool
      .request()
      .input("MENSAGEM_ID", sql.UniqueIdentifier, messageId)
      .input("USUARIO_USERNAME", sql.VarChar(255), username)
      .query(`
        DELETE FROM dbo.TPERFIL_MENSAGENS_REACOES
        WHERE MENSAGEM_ID = @MENSAGEM_ID
          AND USUARIO_USERNAME = @USUARIO_USERNAME
      `)

    return
  }

  await pool
    .request()
    .input("MENSAGEM_ID", sql.UniqueIdentifier, messageId)
    .input("USUARIO_USERNAME", sql.VarChar(255), username)
    .input("TIPO", sql.VarChar(10), reaction)
    .input("REAGIDO_EM", sql.DateTime2, reactedAt)
    .query(`
      MERGE dbo.TPERFIL_MENSAGENS_REACOES AS target
      USING (
        SELECT
          @MENSAGEM_ID AS MENSAGEM_ID,
          @USUARIO_USERNAME AS USUARIO_USERNAME
      ) AS source
      ON target.MENSAGEM_ID = source.MENSAGEM_ID
         AND target.USUARIO_USERNAME = source.USUARIO_USERNAME
      WHEN MATCHED THEN
        UPDATE SET
          TIPO = @TIPO,
          REAGIDO_EM = @REAGIDO_EM
      WHEN NOT MATCHED THEN
        INSERT (
          MENSAGEM_ID,
          USUARIO_USERNAME,
          TIPO,
          REAGIDO_EM
        )
        VALUES (
          @MENSAGEM_ID,
          @USUARIO_USERNAME,
          @TIPO,
          @REAGIDO_EM
        );
    `)
}
