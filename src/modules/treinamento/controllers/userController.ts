import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import { mapReadViewToUser } from "../utils/userMapping"
import { normalizeCpf } from "../utils/normalizeCpf"
import { extractPFuncRows, readView } from "../services/readViewService"
import {
  clearAllInstructors,
  getUserByCpf,
  listInstructors,
  listUsers,
  setInstructorFlag,
  upsertUser,
  type UserRecord,
} from "../models/userModel"
import { listUserCourses } from "../models/userCourseModel"

type CompanyEmployee = {
  CPF: string
  NOME: string | null
  NOME_FUNCAO: string | null
  NOMEDEPARTAMENTO: string | null
  raw: Record<string, string>
}

type CompanyEmployeeWithLocation = CompanyEmployee & {
  SECAO_DESCRICAO: string | null
  SECAO_CIDADE: string | null
  SECAO_ESTADO: string | null
  OBRA_CODIGO: string | null
  OBRA_NOME: string | null
  SETOR_OBRA: string | null
}

type SectionRecord = Record<string, string>

const COMPANY_EMPLOYEES_CACHE_TTL_MS = 5 * 60 * 1000
const COMPANY_SECTIONS_CACHE_TTL_MS = 5 * 60 * 1000

let companyEmployeesCache:
  | {
      expiresAt: number
      data: CompanyEmployee[]
    }
  | null = null

let companyEmployeesPromise: Promise<CompanyEmployee[]> | null = null
let companySectionsCache:
  | {
      expiresAt: number
      data: SectionRecord[]
    }
  | null = null
let companySectionsPromise: Promise<SectionRecord[]> | null = null

export const getByCpf = asyncHandler(async (req: Request, res: Response) => {
  const user = await getUserByCpf(req.params.cpf)
  if (!user) {
    throw new HttpError(404, "Usuario nao encontrado")
  }

  const { HASH_SENHA: _hashSenha, READVIEW_JSON: _readView, ...safe } =
    user as UserRecord
  res.json({ user: safe })
})

export const listCourses = asyncHandler(async (req: Request, res: Response) => {
  const courses = await listUserCourses(req.params.cpf)
  res.json({ courses })
})

const parseBoolean = (value?: string) => {
  if (value === undefined) return undefined
  if (value === "1" || value.toLowerCase() === "true") return true
  if (value === "0" || value.toLowerCase() === "false") return false
  return undefined
}

const normalizeCode = (value: string | null | undefined) =>
  (value ?? "").replace(/\s+/g, "").trim()

const normalizeCodeCompact = (value: string | null | undefined) =>
  normalizeCode(value).replace(/[^0-9A-Za-z]/g, "")

const normalizeText = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase()

const normalizeTextCompact = (value: string | null | undefined) =>
  normalizeText(value).replace(/[^0-9a-z]/g, "")

const commonPrefixLength = (left: string, right: string) => {
  const limit = Math.min(left.length, right.length)
  let index = 0
  while (index < limit && left[index] === right[index]) {
    index += 1
  }
  return index
}

const splitCodeSegments = (value: string | null | undefined) =>
  normalizeCode(value)
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)

const isObraHierarchyCode = (value: string | null | undefined) => {
  const segments = splitCodeSegments(value)
  return segments[0] === "01" && segments[1] === "02"
}

const buildParentHierarchyCodes = (value: string | null | undefined) => {
  const segments = splitCodeSegments(value)
  const result: string[] = []
  for (let index = segments.length - 1; index > 0; index -= 1) {
    result.push(segments.slice(0, index).join("."))
  }
  return result
}

const splitObraAndSetor = (value: string | null | undefined) => {
  const text = (value ?? "").trim()
  if (!text) {
    return {
      obra: null as string | null,
      setor: null as string | null,
      left: null as string | null,
      right: null as string | null,
    }
  }

  const separatorIndex = text.indexOf(" - ")
  if (separatorIndex <= 0) {
    return { obra: text, setor: null, left: text, right: null }
  }

  const left = text.slice(0, separatorIndex).trim() || text
  const right = text.slice(separatorIndex + 3).trim() || null
  return { obra: left, setor: right, left, right }
}

const toStringRecord = (value: unknown): SectionRecord | null => {
  if (!value || typeof value !== "object") return null

  const source = value as Record<string, unknown>
  const record: SectionRecord = {}
  for (const [key, raw] of Object.entries(source)) {
    if (raw === null || raw === undefined) continue
    if (typeof raw === "object") continue
    const text = String(raw).trim()
    if (!text) continue
    record[key] = text
  }

  return Object.keys(record).length > 0 ? record : null
}

const collectSectionCandidates = (node: unknown, output: SectionRecord[]) => {
  if (!node) return

  if (Array.isArray(node)) {
    for (const item of node) collectSectionCandidates(item, output)
    return
  }

  if (typeof node !== "object") return

  const record = toStringRecord(node)
  if (record) {
    const hasCode = Boolean(record.CODIGO)
    const hasSectionData = Boolean(record.DESCRICAO) || Boolean(record.CIDADE) || Boolean(record.ESTADO)
    if (hasCode && hasSectionData) {
      output.push(record)
    }
  }

  for (const value of Object.values(node as Record<string, unknown>)) {
    collectSectionCandidates(value, output)
  }
}

const normalizeSectionRows = (payload: unknown): SectionRecord[] => {
  const candidates: SectionRecord[] = []
  collectSectionCandidates(payload, candidates)

  const unique = new Map<string, SectionRecord>()
  for (const section of candidates) {
    const col = normalizeCode(section.CODCOLIGADA)
    const cod = normalizeCode(section.CODIGO)
    if (!col || !cod) continue
    unique.set(`${col}|${cod}`, section)
  }

  return Array.from(unique.values())
}

type DerivedObraInfo = {
  OBRA_CODIGO: string | null
  OBRA_NOME: string | null
  SETOR_OBRA: string | null
}

const deriveObraInfo = (params: {
  section: SectionRecord | null
  codColigadaCompact: string
  sectionByHierarchyKey: Map<string, SectionRecord>
}): DerivedObraInfo => {
  const { section, codColigadaCompact, sectionByHierarchyKey } = params
  const sectionCode = normalizeCode(section?.CODIGO)
  const sectionDescription = section?.DESCRICAO?.trim() ?? null

  if (!sectionCode || !isObraHierarchyCode(sectionCode)) {
    return {
      OBRA_CODIGO: null,
      OBRA_NOME: null,
      SETOR_OBRA: null,
    }
  }

  if (!sectionDescription) {
    return {
      OBRA_CODIGO: sectionCode,
      OBRA_NOME: null,
      SETOR_OBRA: null,
    }
  }

  const parsed = splitObraAndSetor(sectionDescription)
  if (!parsed.setor) {
    return {
      OBRA_CODIGO: sectionCode,
      OBRA_NOME: parsed.obra,
      SETOR_OBRA: null,
    }
  }

  const parentCodes = buildParentHierarchyCodes(sectionCode)
  const parentSections = parentCodes
    .map((code) => sectionByHierarchyKey.get(`${codColigadaCompact}|${code}`) ?? null)
    .filter(Boolean) as SectionRecord[]

  const normalizedLeft = normalizeText(parsed.left)
  const normalizedRight = normalizeText(parsed.right)

  const exactRightParent =
    parentSections.find((candidate) => normalizeText(candidate.DESCRICAO) === normalizedRight) ?? null
  if (exactRightParent) {
    return {
      OBRA_CODIGO: normalizeCode(exactRightParent.CODIGO) || null,
      OBRA_NOME: exactRightParent.DESCRICAO?.trim() || parsed.right,
      SETOR_OBRA: parsed.left,
    }
  }

  const exactLeftParent =
    parentSections.find((candidate) => normalizeText(candidate.DESCRICAO) === normalizedLeft) ?? null
  if (exactLeftParent) {
    return {
      OBRA_CODIGO: normalizeCode(exactLeftParent.CODIGO) || null,
      OBRA_NOME: exactLeftParent.DESCRICAO?.trim() || parsed.obra,
      SETOR_OBRA: parsed.setor,
    }
  }

  const fuzzyRightParent =
    parentSections.find((candidate) => {
      const normalized = normalizeText(candidate.DESCRICAO)
      if (!normalized || !normalizedRight) return false
      return normalized === normalizedRight || normalizedRight.startsWith(normalized)
    }) ?? null
  if (fuzzyRightParent) {
    return {
      OBRA_CODIGO: normalizeCode(fuzzyRightParent.CODIGO) || null,
      OBRA_NOME: fuzzyRightParent.DESCRICAO?.trim() || parsed.right,
      SETOR_OBRA: parsed.left,
    }
  }

  const targetObraNameNormalized = normalizeText(parsed.obra)
  const fuzzyParent =
    parentSections.find((candidate) => {
      const normalized = normalizeText(candidate.DESCRICAO)
      if (!normalized) return false
      return (
        normalized === targetObraNameNormalized ||
        targetObraNameNormalized.startsWith(normalized) ||
        normalized.startsWith(targetObraNameNormalized)
      )
    }) ?? null

  return {
    OBRA_CODIGO: normalizeCode(fuzzyParent?.CODIGO) || null,
    OBRA_NOME: fuzzyParent?.DESCRICAO?.trim() || parsed.obra,
    SETOR_OBRA: parsed.setor,
  }
}

function buildCompanyEmployeesWithLocation(
  employees: CompanyEmployee[],
  sections: SectionRecord[],
): CompanyEmployeeWithLocation[] {
  const sectionByKey = new Map<string, SectionRecord>()
  const sectionByHierarchyKey = new Map<string, SectionRecord>()
  const sectionByDescription = new Map<string, SectionRecord>()
  const sectionByDescriptionCompact = new Map<string, SectionRecord>()
  const sectionsByColigada = new Map<string, SectionRecord[]>()

  for (const section of sections) {
    const codColigada = normalizeCode(section.CODCOLIGADA)
    const codigo = normalizeCode(section.CODIGO)
    const codColigadaCompact = normalizeCodeCompact(section.CODCOLIGADA)
    const codigoCompact = normalizeCodeCompact(section.CODIGO)
    if (codColigada && codigo) sectionByKey.set(`${codColigada}|${codigo}`, section)
    if (codColigadaCompact && codigoCompact) {
      sectionByKey.set(`${codColigadaCompact}|${codigoCompact}`, section)
    }
    if (codColigadaCompact && codigo) {
      sectionByHierarchyKey.set(`${codColigadaCompact}|${codigo}`, section)
    }

    const descricao = normalizeText(section.DESCRICAO)
    if (descricao) sectionByDescription.set(descricao, section)

    const descricaoCompact = normalizeTextCompact(section.DESCRICAO)
    if (descricaoCompact) sectionByDescriptionCompact.set(descricaoCompact, section)

    const list = sectionsByColigada.get(codColigadaCompact) ?? []
    list.push(section)
    sectionsByColigada.set(codColigadaCompact, list)
  }

  return employees.map((employee) => {
    const raw = employee.raw ?? {}
    const codColigada = normalizeCode(raw.CODCOLIGADA)
    const codSecao = normalizeCode(raw.CODSECAO)
    const codColigadaCompact = normalizeCodeCompact(raw.CODCOLIGADA)
    const codSecaoCompact = normalizeCodeCompact(raw.CODSECAO)

    let section =
      sectionByKey.get(`${codColigada}|${codSecao}`) ??
      sectionByKey.get(`${codColigadaCompact}|${codSecaoCompact}`) ??
      null

    if (!section && codColigadaCompact && codSecaoCompact) {
      const candidates = sectionsByColigada.get(codColigadaCompact) ?? []
      let bestMatch: SectionRecord | null = null
      let bestScore = 0

      for (const candidate of candidates) {
        const candidateCode = normalizeCodeCompact(candidate.CODIGO)
        if (!candidateCode) continue

        const exact = candidateCode === codSecaoCompact
        const prefixLen = commonPrefixLength(candidateCode, codSecaoCompact)
        const isPrefixRelation =
          candidateCode.startsWith(codSecaoCompact) || codSecaoCompact.startsWith(candidateCode)

        if (!exact && !isPrefixRelation) continue
        const score = exact ? Number.MAX_SAFE_INTEGER : prefixLen
        if (score > bestScore) {
          bestScore = score
          bestMatch = candidate
        }
      }

      section = bestMatch
    }

    if (!section) {
      const descricaoFuncionario = normalizeText(
        raw.DESCRICAOSECAO ?? raw.NOME_SECAO ?? raw.NOMEDEPARTAMENTO,
      )
      if (descricaoFuncionario) {
        section = sectionByDescription.get(descricaoFuncionario) ?? null
      }
    }

    if (!section) {
      const descricaoFuncionarioCompact = normalizeTextCompact(
        raw.DESCRICAOSECAO ?? raw.NOME_SECAO ?? raw.NOMEDEPARTAMENTO,
      )
      if (descricaoFuncionarioCompact) {
        section = sectionByDescriptionCompact.get(descricaoFuncionarioCompact) ?? null
      }
    }

    const obraInfo = deriveObraInfo({ section, codColigadaCompact, sectionByHierarchyKey })

    return {
      ...employee,
      SECAO_DESCRICAO:
        section?.DESCRICAO ?? raw.DESCRICAOSECAO ?? raw.NOME_SECAO ?? employee.NOMEDEPARTAMENTO ?? null,
      SECAO_CIDADE: section?.CIDADE ?? raw.CIDADESECAO ?? raw.CIDADE_SECAO ?? raw.CIDADE ?? null,
      SECAO_ESTADO:
        section?.ESTADO ??
        raw.ESTADOSECAO ??
        raw.ESTADO_SECAO ??
        raw.UFSECAO ??
        raw.ESTADO ??
        raw.UF ??
        null,
      ...obraInfo,
    }
  })
}

export const listAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const { cpf, nome, ativo, instrutor } = req.query as {
    cpf?: string
    nome?: string
    ativo?: string
    instrutor?: string
  }

  const users = await listUsers({
    cpf: cpf?.trim() || undefined,
    nome: nome?.trim() || undefined,
    ativo: parseBoolean(ativo),
    instrutor: parseBoolean(instrutor),
  })

  res.json({ users })
})

function mapCompanyEmployees(rows: Record<string, string>[]) {
  const candidates = rows
    .map((row): CompanyEmployee | null => {
      const isActive = (row.CODSITUACAO ?? "").trim().toUpperCase() === "A"
      if (!isActive) {
        return null
      }

      const cpfDigits = normalizeCpf(row.CPF ?? "")
      if (cpfDigits.length !== 11) {
        return null
      }

      return {
        CPF: cpfDigits,
        NOME: row.NOME ?? null,
        NOME_FUNCAO: row.NOME_FUNCAO ?? row.CARGO ?? null,
        NOMEDEPARTAMENTO: row.NOMEDEPARTAMENTO ?? row.NOME_SECAO ?? null,
        raw: row,
      }
    })

  const byCpf = new Map<string, NonNullable<(typeof candidates)[number]>>()
  for (const item of candidates) {
    if (!item) continue
    const current = byCpf.get(item.CPF)
    if (!current) {
      byCpf.set(item.CPF, item)
      continue
    }

    const currentActive = (current.raw.CODSITUACAO ?? "").toUpperCase() === "A"
    const incomingActive = (item.raw.CODSITUACAO ?? "").toUpperCase() === "A"
    if (!currentActive && incomingActive) {
      byCpf.set(item.CPF, item)
      continue
    }

    const currentUpdated = current.raw.RECMODIFIEDON ?? ""
    const incomingUpdated = item.raw.RECMODIFIEDON ?? ""
    if (incomingUpdated > currentUpdated) {
      byCpf.set(item.CPF, item)
    }
  }

  return Array.from(byCpf.values()).sort((a, b) =>
    (a.NOME ?? "").localeCompare(b.NOME ?? "", "pt-BR"),
  )
}

async function loadCompanyEmployeesFresh() {
  const readViewResult = await readView({
    dataServerName: "FopFuncData",
    filter: "PFUNC.CODCOLIGADA=1 AND PFUNC.CODSITUACAO='A'",
    context: "CODCOLIGADA=1",
  })

  const rows = extractPFuncRows(readViewResult)
  return mapCompanyEmployees(rows)
}

function escapeReadViewFilterValue(value: string) {
  return value.replace(/'/g, "''")
}

function chunkArray<T>(items: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function loadCompanyEmployeesByObraCodes(obraCodes: string[]) {
  const normalizedCodes = Array.from(
    new Set(obraCodes.map((code) => normalizeCode(code)).filter(Boolean)),
  )

  if (normalizedCodes.length === 0) {
    return [] as CompanyEmployee[]
  }

  const codeChunks = chunkArray(normalizedCodes, 20)
  const allRows: Record<string, string>[] = []

  for (const chunk of codeChunks) {
    const conditions = chunk
      .map((code) => `PFUNC.CODSECAO LIKE '${escapeReadViewFilterValue(code)}%'`)
      .join(" OR ")
    const filter = `PFUNC.CODCOLIGADA=1 AND PFUNC.CODSITUACAO='A' AND (${conditions})`

    // eslint-disable-next-line no-await-in-loop
    const readViewResult = await readView({
      dataServerName: "FopFuncData",
      filter,
      context: "CODCOLIGADA=1",
    })

    const rows = extractPFuncRows(readViewResult)
    allRows.push(...rows)
  }

  return mapCompanyEmployees(allRows)
}

function getObraCodesForFilter(
  sections: SectionRecord[],
  params: {
    obra?: string
    obraCodigo?: string
  },
) {
  const sectionByHierarchyKey = new Map<string, SectionRecord>()

  for (const section of sections) {
    const codColigadaCompact = normalizeCodeCompact(section.CODCOLIGADA)
    const codigo = normalizeCode(section.CODIGO)
    if (!codColigadaCompact || !codigo) continue
    sectionByHierarchyKey.set(`${codColigadaCompact}|${codigo}`, section)
  }

  const targetObraCodigo = params.obraCodigo ? normalizeCode(params.obraCodigo) : ""
  const targetObraNome = params.obra ? normalizeText(params.obra) : ""
  const codes = new Set<string>()

  for (const section of sections) {
    const codColigadaCompact = normalizeCodeCompact(section.CODCOLIGADA)
    const obraInfo = deriveObraInfo({
      section,
      codColigadaCompact,
      sectionByHierarchyKey,
    })

    const matchesByCode =
      Boolean(targetObraCodigo) && normalizeCode(obraInfo.OBRA_CODIGO) === targetObraCodigo
    const matchesByName =
      !targetObraCodigo &&
      Boolean(targetObraNome) &&
      normalizeText(obraInfo.OBRA_NOME) === targetObraNome

    if (!matchesByCode && !matchesByName) continue

    const obraCode = normalizeCode(obraInfo.OBRA_CODIGO)
    if (obraCode) codes.add(obraCode)
  }

  return Array.from(codes)
}

async function getCompanyEmployees(forceRefresh = false) {
  const now = Date.now()
  if (
    !forceRefresh &&
    companyEmployeesCache &&
    companyEmployeesCache.expiresAt > now
  ) {
    return companyEmployeesCache.data
  }

  if (!companyEmployeesPromise) {
    companyEmployeesPromise = loadCompanyEmployeesFresh()
      .then((employees) => {
        companyEmployeesCache = {
          data: employees,
          expiresAt: Date.now() + COMPANY_EMPLOYEES_CACHE_TTL_MS,
        }
        return employees
      })
      .finally(() => {
        companyEmployeesPromise = null
      })
  }

  try {
    return await companyEmployeesPromise
  } catch (error) {
    if (companyEmployeesCache?.data.length) {
      return companyEmployeesCache.data
    }
    throw error
  }
}

export const listCompanyEmployees = asyncHandler(async (req: Request, res: Response) => {
  const forceRefresh = parseBoolean((req.query.refresh as string | undefined)?.trim()) === true
  const obraFilterRaw = (req.query.obra as string | undefined)?.trim()
  const obraCodigoFilterRaw = (req.query.obraCodigo as string | undefined)?.trim()
  const includeLocation = parseBoolean((req.query.includeLocation as string | undefined)?.trim()) === true

  const sections = await getCompanySectionsNormalized(forceRefresh)

  let employees: CompanyEmployee[]
  if (obraCodigoFilterRaw || obraFilterRaw) {
    const obraCodes = getObraCodesForFilter(sections, {
      obra: obraFilterRaw,
      obraCodigo: obraCodigoFilterRaw,
    })
    employees = await loadCompanyEmployeesByObraCodes(obraCodes)
  } else {
    employees = await getCompanyEmployees(forceRefresh)
  }

  let enrichedEmployees = buildCompanyEmployeesWithLocation(employees, sections)

  if (obraCodigoFilterRaw) {
    const obraCodigoFilter = normalizeCode(obraCodigoFilterRaw)
    enrichedEmployees = enrichedEmployees.filter(
      (item) => normalizeCode(item.OBRA_CODIGO) === obraCodigoFilter,
    )
  } else if (obraFilterRaw) {
    const obraFilter = normalizeText(obraFilterRaw)
    enrichedEmployees = enrichedEmployees.filter((item) => normalizeText(item.OBRA_NOME) === obraFilter)
  }

  if (!includeLocation) {
    res.json({
      employees: enrichedEmployees.map((item) => ({
        CPF: item.CPF,
        NOME: item.NOME,
        NOME_FUNCAO: item.NOME_FUNCAO,
        NOMEDEPARTAMENTO: item.NOMEDEPARTAMENTO,
        raw: item.raw,
      })),
    })
    return
  }

  res.json({ employees: enrichedEmployees })
})

export const listCompanyEmployeeObras = asyncHandler(async (req: Request, res: Response) => {
  const forceRefresh = parseBoolean((req.query.refresh as string | undefined)?.trim()) === true
  const sections = await getCompanySectionsNormalized(forceRefresh)
  const sectionByHierarchyKey = new Map<string, SectionRecord>()

  for (const section of sections) {
    const codColigadaCompact = normalizeCodeCompact(section.CODCOLIGADA)
    const codigo = normalizeCode(section.CODIGO)
    if (!codColigadaCompact || !codigo) continue
    sectionByHierarchyKey.set(`${codColigadaCompact}|${codigo}`, section)
  }

  const byKey = new Map<string, { codigo: string | null; nome: string }>()

  for (const section of sections) {
    const sectionCode = normalizeCode(section.CODIGO)
    if (!isObraHierarchyCode(sectionCode)) continue

    const codColigadaCompact = normalizeCodeCompact(section.CODCOLIGADA)
    const obraInfo = deriveObraInfo({
      section,
      codColigadaCompact,
      sectionByHierarchyKey,
    })

    const nome = obraInfo.OBRA_NOME?.trim()
    if (!nome) continue
    const codigo = obraInfo.OBRA_CODIGO ? normalizeCode(obraInfo.OBRA_CODIGO) : null
    const key = codigo ? `codigo:${codigo}` : `nome:${normalizeText(nome)}`
    if (!key) continue
    if (!byKey.has(key)) {
      byKey.set(key, {
        codigo,
        nome,
      })
    }
  }

  const obras = Array.from(byKey.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  res.json({ obras })
})

async function readCompanySections() {
  const attempts: Array<{
    dataServerName: string
    filter?: string
    context?: string
  }> = [
    {
      dataServerName: "FopSecaoDataBR",
      filter: "1=1",
      context: "CODCOLIGADA=1",
    },
    {
      dataServerName: "FopSecaoDataBR",
      context: "CODCOLIGADA=1",
    },
    {
      dataServerName: "FopSecaoDataBR",
    },
  ]

  let lastError: unknown
  for (const attempt of attempts) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await readView(attempt)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

async function loadCompanySectionsFresh() {
  const sectionsPayload = await readCompanySections()
  return normalizeSectionRows(sectionsPayload)
}

async function getCompanySectionsNormalized(forceRefresh = false) {
  const now = Date.now()
  if (
    !forceRefresh &&
    companySectionsCache &&
    companySectionsCache.expiresAt > now
  ) {
    return companySectionsCache.data
  }

  if (!companySectionsPromise) {
    companySectionsPromise = loadCompanySectionsFresh()
      .then((sections) => {
        companySectionsCache = {
          data: sections,
          expiresAt: Date.now() + COMPANY_SECTIONS_CACHE_TTL_MS,
        }
        return sections
      })
      .finally(() => {
        companySectionsPromise = null
      })
  }

  try {
    return await companySectionsPromise
  } catch (error) {
    if (companySectionsCache?.data.length) {
      return companySectionsCache.data
    }
    throw error
  }
}

export const listCompanySections = asyncHandler(async (_req: Request, res: Response) => {
  const sections = await readCompanySections()
  res.json({ sections })
})

export const listInstructorUsers = asyncHandler(async (_req: Request, res: Response) => {
  const instructors = await listInstructors()
  res.json({ instructors })
})

export const updateInstructors = asyncHandler(async (req: Request, res: Response) => {
  const { users } = req.body as {
    users?: Array<{
      cpf?: string
      user?: Record<string, unknown>
    }>
  }

  if (!Array.isArray(users)) {
    throw new HttpError(400, "Lista de usuarios e obrigatoria")
  }

  const selectedCpfs: string[] = []

  for (const item of users) {
    const cpfDigits = normalizeCpf(item.cpf ?? "")
    if (cpfDigits.length !== 11) {
      continue
    }

    const rawRecord: Record<string, string> = {}
    const rawUser = item.user

    if (rawUser && typeof rawUser === "object") {
      for (const [key, rawValue] of Object.entries(rawUser)) {
        if (rawValue === null || rawValue === undefined) continue
        const str = String(rawValue).trim()
        if (!str) continue
        rawRecord[key] = str
      }
    }

    rawRecord.CPF = cpfDigits
    const mapped = mapReadViewToUser(rawRecord)
    // eslint-disable-next-line no-await-in-loop
    await upsertUser({ ...mapped, instrutor: true })
    selectedCpfs.push(cpfDigits)
  }

  await clearAllInstructors()
  for (const cpf of selectedCpfs) {
    // eslint-disable-next-line no-await-in-loop
    await setInstructorFlag(cpf, true)
  }

  const instructors = await listInstructors()
  res.json({ updated: instructors.length, instructors })
})
