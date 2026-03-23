import { getPool, sql } from "../config/db"
import { extractPFuncRows, readView } from "./readViewService"
import {
  normalizeSectorText,
  normalizeUsernameValue,
  resolveSectorKey,
} from "../utils/sectorAccess"

const COMPANY_EMPLOYEES_CACHE_TTL_MS = 5 * 60 * 1000
const USERNAME_CANDIDATE_KEYS = [
  "MAIL",
  "EMAIL",
  "EMAILCORPORATIVO",
  "EMAIL_CORPORATIVO",
  "USERPRINCIPALNAME",
  "LOGINUSUARIO",
  "LOGIN",
  "NOMEUSUARIOREDE",
  "USUARIOREDE",
  "USERNAME",
  "CODUSUARIOREDE",
  "CODUSUARIO",
] as const

type RawEmployeeRecord = Record<string, string>

let companyEmployeesCache:
  | {
      data: RawEmployeeRecord[]
      expiresAt: number
    }
  | null = null

let companyEmployeesPromise: Promise<RawEmployeeRecord[]> | null = null

function extractUsernameFromRecord(record: Record<string, string> | null | undefined) {
  if (!record) {
    return ""
  }

  for (const key of USERNAME_CANDIDATE_KEYS) {
    const username = normalizeUsernameValue(record[key])
    if (username && !username.includes(" ")) {
      return username
    }
  }

  return ""
}

function resolveSectorCandidates(record: Record<string, string> | null | undefined) {
  if (!record) {
    return []
  }

  return [
    record.SETOR,
    record.NOMEDEPARTAMENTO,
    record.NOME_SECAO,
    record.DESCRICAOSECAO,
    record.SECAO_DESCRICAO,
    record.SETOR_OBRA,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
}

function recordBelongsToSector(
  record: Record<string, string> | null | undefined,
  sectorKey: string,
) {
  const normalizedSectorKey = resolveSectorKey(sectorKey)
  if (!normalizedSectorKey || !record) {
    return false
  }

  return resolveSectorCandidates(record).some(
    (candidate) => resolveSectorKey(candidate) === normalizedSectorKey,
  )
}

async function listStoredUsernamesBySectorKey(sectorKey: string) {
  const normalizedSectorKey = resolveSectorKey(sectorKey)
  if (!normalizedSectorKey) {
    return [] as string[]
  }

  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      CPF,
      NOME,
      SETOR,
      READVIEW_JSON,
      ATIVO,
      JSON_VALUE(READVIEW_JSON, '$.MAIL') AS MAIL,
      JSON_VALUE(READVIEW_JSON, '$.EMAIL') AS EMAIL,
      JSON_VALUE(READVIEW_JSON, '$.EMAILCORPORATIVO') AS EMAILCORPORATIVO,
      JSON_VALUE(READVIEW_JSON, '$.EMAIL_CORPORATIVO') AS EMAIL_CORPORATIVO,
      JSON_VALUE(READVIEW_JSON, '$.USERPRINCIPALNAME') AS USERPRINCIPALNAME,
      JSON_VALUE(READVIEW_JSON, '$.LOGINUSUARIO') AS LOGINUSUARIO,
      JSON_VALUE(READVIEW_JSON, '$.LOGIN') AS LOGIN,
      JSON_VALUE(READVIEW_JSON, '$.NOMEUSUARIOREDE') AS NOMEUSUARIOREDE,
      JSON_VALUE(READVIEW_JSON, '$.USUARIOREDE') AS USUARIOREDE,
      JSON_VALUE(READVIEW_JSON, '$.USERNAME') AS USERNAME,
      JSON_VALUE(READVIEW_JSON, '$.CODUSUARIOREDE') AS CODUSUARIOREDE,
      JSON_VALUE(READVIEW_JSON, '$.CODUSUARIO') AS CODUSUARIO,
      JSON_VALUE(READVIEW_JSON, '$.NOMEDEPARTAMENTO') AS NOMEDEPARTAMENTO,
      JSON_VALUE(READVIEW_JSON, '$.NOME_SECAO') AS NOME_SECAO,
      JSON_VALUE(READVIEW_JSON, '$.DESCRICAOSECAO') AS DESCRICAOSECAO,
      JSON_VALUE(READVIEW_JSON, '$.SECAO_DESCRICAO') AS SECAO_DESCRICAO,
      JSON_VALUE(READVIEW_JSON, '$.SETOR_OBRA') AS SETOR_OBRA
    FROM dbo.TUSUARIOS
    WHERE ATIVO = 1 OR ATIVO IS NULL
  `)

  const usernames = new Set<string>()

  for (const row of result.recordset as Array<Record<string, string | number | null>>) {
    const record = Object.fromEntries(
      Object.entries(row)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [key, String(value).trim()]),
    )

    if (!recordBelongsToSector(record, normalizedSectorKey)) {
      continue
    }

    const username = extractUsernameFromRecord(record)
    if (username) {
      usernames.add(username)
    }
  }

  return Array.from(usernames)
}

async function loadCompanyEmployeesFresh() {
  const readViewResult = await readView({
    dataServerName: "FopFuncData",
    filter: "PFUNC.CODCOLIGADA=1 AND PFUNC.CODSITUACAO='A'",
    context: "CODCOLIGADA=1",
  })

  return extractPFuncRows(readViewResult)
}

async function loadCompanyEmployees() {
  const now = Date.now()

  if (companyEmployeesCache && companyEmployeesCache.expiresAt > now) {
    return companyEmployeesCache.data
  }

  if (!companyEmployeesPromise) {
    companyEmployeesPromise = loadCompanyEmployeesFresh()
      .then((data) => {
        companyEmployeesCache = {
          data,
          expiresAt: Date.now() + COMPANY_EMPLOYEES_CACHE_TTL_MS,
        }
        return data
      })
      .finally(() => {
        companyEmployeesPromise = null
      })
  }

  return companyEmployeesPromise
}

async function listCompanyUsernamesBySectorKey(sectorKey: string) {
  const normalizedSectorKey = resolveSectorKey(sectorKey)
  if (!normalizedSectorKey) {
    return [] as string[]
  }

  const employees = await loadCompanyEmployees()
  const usernames = new Set<string>()

  for (const employee of employees) {
    if (!recordBelongsToSector(employee, normalizedSectorKey)) {
      continue
    }

    const username = extractUsernameFromRecord(employee)
    if (username) {
      usernames.add(username)
    }
  }

  return Array.from(usernames)
}

export async function listNotificationUsernamesBySectorKey(sectorKey: string) {
  const normalizedSectorKey = resolveSectorKey(sectorKey)
  if (!normalizedSectorKey) {
    return [] as string[]
  }

  const [storedUsernames, companyUsernames] = await Promise.all([
    listStoredUsernamesBySectorKey(normalizedSectorKey).catch(() => []),
    listCompanyUsernamesBySectorKey(normalizedSectorKey).catch(() => []),
  ])

  return Array.from(
    new Set(
      [...storedUsernames, ...companyUsernames]
        .map((value) => normalizeUsernameValue(value))
        .filter((value) => value && !value.includes(" ")),
    ),
  ).sort((left, right) => left.localeCompare(right, "pt-BR"))
}

export function buildTrainingNotificationAuthor(input: {
  authorName?: string | null
  authorUsername?: string | null
}) {
  const authorUsername = normalizeUsernameValue(input.authorUsername)
  const authorName =
    String(input.authorName ?? "").trim() ||
    String(input.authorUsername ?? "").trim() ||
    null

  return {
    authorName,
    authorUsername,
  }
}

export function normalizeTrainingNotificationSectorKey(value: string | null | undefined) {
  return resolveSectorKey(normalizeSectorText(value))
}
