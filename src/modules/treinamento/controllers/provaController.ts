import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import { normalizeCpf } from "../utils/normalizeCpf"
import { mapReadViewToUser } from "../utils/userMapping"
import { upsertUser } from "../models/userModel"
import {
  getUserCurrentVideoProgressByTrilha,
  recordUserTraining,
} from "../models/userTrainingModel"
import { isUserAssignedToTrilha } from "../models/userTrilhaModel"
import {
  createProvaAttempt,
  getLatestProvaAttemptByTrilha,
  listProvaAttemptsReport,
  type ProvaAttemptStatus,
} from "../models/provaAttemptModel"
import {
  createOrVersionObjectiveProva,
  createProva,
  deleteProva,
  getObjectiveProvaByTrilhaId,
  getProvaById,
  listProvas,
  updateProva,
} from "../models/provaModel"
import { getTrilhaById, updateTrilha } from "../models/trilhaModel"
import { getModuleById } from "../models/moduleModel"
import {
  buildModuleRelativePath,
  buildStoredFileName,
  buildTrilhaRelativePath,
  ensurePublicDir,
  moveFile,
  toFsPath,
} from "../utils/storage"

async function resolveTrilhaPath(trilhaId: string) {
  const trilha = await getTrilhaById(trilhaId)
  if (!trilha) {
    throw new HttpError(404, "Trilha nao encontrada")
  }

  if (trilha.PATH) {
    await ensurePublicDir(trilha.PATH)
    return { trilha, trilhaPath: trilha.PATH }
  }

  const module = await getModuleById(trilha.MODULO_FK_ID)
  if (!module) {
    throw new HttpError(404, "Modulo nao encontrado")
  }

  const modulePath = module.PATH ?? buildModuleRelativePath(module.NOME)
  await ensurePublicDir(modulePath)
  const trilhaPath = buildTrilhaRelativePath(modulePath, trilha.TITULO)
  await ensurePublicDir(trilhaPath)

  await updateTrilha(trilha.ID, { path: trilhaPath })
  return { trilha, trilhaPath }
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId, cpf } = req.query as { trilhaId?: string; cpf?: string }
  const normalizedCpf = cpf ? normalizeCpf(cpf) : undefined
  const provas = await listProvas(trilhaId, normalizedCpf)
  res.json({ provas })
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const prova = await getProvaById(req.params.id)
  if (!prova) {
    throw new HttpError(404, "Prova nao encontrada")
  }
  res.json({ prova })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { id, trilhaId, provaPath, versao } = req.body as {
    id?: string
    trilhaId?: string
    provaPath?: string
    versao?: number
  }

  if (!id || !trilhaId || !provaPath) {
    throw new HttpError(400, "ID, trilhaId e provaPath sao obrigatorios")
  }

  const prova = await createProva({
    id,
    trilhaId,
    provaPath,
    versao,
  })

  res.status(201).json({ prova })
})

export const createUpload = asyncHandler(async (req: Request, res: Response) => {
  const { id, trilhaId, versao } = req.body as {
    id?: string
    trilhaId?: string
    versao?: number
  }
  const file = req.file

  if (!id || !trilhaId) {
    throw new HttpError(400, "ID e trilhaId sao obrigatorios")
  }

  if (!file) {
    throw new HttpError(400, "Arquivo de prova e obrigatorio")
  }

  const { trilhaPath } = await resolveTrilhaPath(trilhaId)
  const fileName = buildStoredFileName(file.originalname, "prova")
  const relativePath = [trilhaPath, fileName].filter(Boolean).join("/")
  const destPath = toFsPath(relativePath)

  await moveFile(file.path, destPath)

  const prova = await createProva({
    id,
    trilhaId,
    provaPath: relativePath,
    versao,
  })

  res.status(201).json({ prova })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId, provaPath, versao } = req.body as {
    trilhaId?: string
    provaPath?: string
    versao?: number
  }

  if (
    trilhaId === undefined &&
    provaPath === undefined &&
    versao === undefined
  ) {
    throw new HttpError(400, "Informe ao menos um campo para atualizar")
  }

  const prova = await updateProva(req.params.id, {
    trilhaId,
    provaPath,
    versao,
  })

  if (!prova) {
    throw new HttpError(404, "Prova nao encontrada")
  }

  res.json({ prova })
})

export const updateUpload = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId, versao } = req.body as {
    trilhaId?: string
    versao?: number
  }
  const file = req.file

  if (!file) {
    throw new HttpError(400, "Arquivo de prova e obrigatorio")
  }

  const resolvedTrilhaId =
    trilhaId ?? (await getProvaById(req.params.id))?.TRILHA_FK_ID
  if (!resolvedTrilhaId) {
    throw new HttpError(400, "trilhaId e obrigatorio")
  }

  const { trilhaPath } = await resolveTrilhaPath(resolvedTrilhaId)
  const fileName = buildStoredFileName(file.originalname, "prova")
  const relativePath = [trilhaPath, fileName].filter(Boolean).join("/")
  const destPath = toFsPath(relativePath)

  await moveFile(file.path, destPath)

  const prova = await updateProva(req.params.id, {
    trilhaId: resolvedTrilhaId,
    provaPath: relativePath,
    versao,
  })

  if (!prova) {
    throw new HttpError(404, "Prova nao encontrada")
  }

  res.json({ prova })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteProva(req.params.id)
  res.status(204).send()
})

const round2 = (value: number) => Math.round(value * 100) / 100

type ObjectiveQuestionPayload = {
  enunciado?: string
  peso?: number
  opcoes?: Array<{
    texto?: string
    correta?: boolean
  }>
}

type ObjectiveSubmitPayload = {
  cpf?: string
  respostas?: Array<{
    questaoId?: string
    opcaoId?: string
  }>
  user?: Record<string, unknown>
}

type ObjectiveCollectiveSubmitPayload = {
  users?: Array<Record<string, unknown>>
  respostas?: Array<{
    questaoId?: string
    opcaoId?: string
  }>
  turmaId?: string
  concluidoEm?: string
  origem?: string
}

type GabaritoItem = {
  questaoId: string
  enunciado: string
  peso: number
  opcaoMarcadaId: string | null
  opcaoMarcadaTexto: string | null
  opcaoCorretaId: string
  opcaoCorretaTexto: string
  acertou: boolean
}

const MEDIA_APROVACAO = 6
const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function sanitizeObjectiveProvaForPlayer(prova: {
  ID: string
  TRILHA_FK_ID: string
  VERSAO: number
  TITULO: string | null
  NOTA_TOTAL: number | null
  ATUALIZADO_EM: Date | null
  QUESTOES: Array<{
    ID: string
    ORDEM: number
    ENUNCIADO: string
    PESO: number
    OPCOES: Array<{
      ID: string
      ORDEM: number
      TEXTO: string
      CORRETA: boolean
    }>
  }>
}) {
  return {
    ID: prova.ID,
    TRILHA_FK_ID: prova.TRILHA_FK_ID,
    VERSAO: prova.VERSAO,
    TITULO: prova.TITULO,
    NOTA_TOTAL: prova.NOTA_TOTAL,
    ATUALIZADO_EM: prova.ATUALIZADO_EM,
    QUESTOES: prova.QUESTOES.map((question) => ({
      ID: question.ID,
      ORDEM: question.ORDEM,
      ENUNCIADO: question.ENUNCIADO,
      PESO: question.PESO,
      OPCOES: question.OPCOES.map((option) => ({
        ID: option.ID,
        ORDEM: option.ORDEM,
        TEXTO: option.TEXTO,
      })),
    })),
  }
}

function parseUserRecord(user: Record<string, unknown> | undefined) {
  if (!user || typeof user !== "object") return null

  const record: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(user)) {
    if (rawValue === null || rawValue === undefined) continue
    if (typeof rawValue === "object") continue
    const value = String(rawValue).trim()
    if (!value) continue
    record[key] = value
  }

  return Object.keys(record).length > 0 ? record : null
}

function evaluateObjectiveAnswers(
  prova: NonNullable<Awaited<ReturnType<typeof getObjectiveProvaByTrilhaId>>>,
  respostas: Array<{ questaoId?: string; opcaoId?: string }>,
) {
  const answerMap = new Map<string, string>()
  for (const resposta of respostas) {
    const questaoId = resposta.questaoId?.trim()
    const opcaoId = resposta.opcaoId?.trim()
    if (!questaoId || !opcaoId) continue
    answerMap.set(questaoId, opcaoId)
  }

  let score = 0
  let hits = 0
  const gabarito: GabaritoItem[] = []

  for (const question of prova.QUESTOES) {
    const selectedOptionId = answerMap.get(question.ID) ?? null
    const selectedOption = question.OPCOES.find((option) => option.ID === selectedOptionId) ?? null
    const correctOption = question.OPCOES.find((option) => option.CORRETA)
    if (!correctOption) {
      throw new HttpError(500, "Questao sem alternativa correta cadastrada")
    }

    const isCorrect = selectedOption?.ID === correctOption.ID
    if (isCorrect) {
      hits += 1
      score += Number(question.PESO ?? 0)
    }

    gabarito.push({
      questaoId: question.ID,
      enunciado: question.ENUNCIADO,
      peso: Number(question.PESO ?? 0),
      opcaoMarcadaId: selectedOption?.ID ?? null,
      opcaoMarcadaTexto: selectedOption?.TEXTO ?? null,
      opcaoCorretaId: correctOption.ID,
      opcaoCorretaTexto: correctOption.TEXTO,
      acertou: isCorrect,
    })
  }

  const finalScore = round2(score)
  const status: ProvaAttemptStatus =
    finalScore >= MEDIA_APROVACAO ? "aprovado" : "reprovado"

  return {
    finalScore,
    status,
    hits,
    gabarito,
  }
}

export const getObjectiveByTrilha = asyncHandler(async (req: Request, res: Response) => {
  const { versao } = req.query as { versao?: string }
  const parsedVersion =
    versao !== undefined && versao !== "" ? Number(versao) : undefined

  if (parsedVersion !== undefined && (!Number.isFinite(parsedVersion) || parsedVersion <= 0)) {
    throw new HttpError(400, "versao invalida")
  }

  const prova = await getObjectiveProvaByTrilhaId(req.params.trilhaId, parsedVersion)
  if (!prova) {
    res.json({ prova: null })
    return
  }

  res.json({ prova })
})

export const createOrVersionObjective = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId } = req.params
  const { titulo, questoes } = req.body as {
    titulo?: string
    questoes?: ObjectiveQuestionPayload[]
  }

  if (!titulo?.trim()) {
    throw new HttpError(400, "titulo da prova e obrigatorio")
  }

  if (!Array.isArray(questoes) || questoes.length === 0) {
    throw new HttpError(400, "A prova deve conter ao menos uma questao")
  }

  const normalizedQuestions = questoes.map((question, questionIndex) => {
    const enunciado = question.enunciado?.trim()
    if (!enunciado) {
      throw new HttpError(400, `Questao ${questionIndex + 1}: enunciado obrigatorio`)
    }

    const peso = Number(question.peso)
    if (!Number.isFinite(peso) || peso <= 0) {
      throw new HttpError(400, `Questao ${questionIndex + 1}: peso invalido`)
    }

    if (!Array.isArray(question.opcoes) || question.opcoes.length < 2) {
      throw new HttpError(400, `Questao ${questionIndex + 1}: inclua ao menos 2 opcoes`)
    }

    const opcoes = question.opcoes.map((option, optionIndex) => {
      const texto = option.texto?.trim()
      if (!texto) {
        throw new HttpError(
          400,
          `Questao ${questionIndex + 1}, opcao ${optionIndex + 1}: texto obrigatorio`,
        )
      }

      return {
        texto,
        correta: Boolean(option.correta),
      }
    })

    const correctCount = opcoes.filter((option) => option.correta).length
    if (correctCount !== 1) {
      throw new HttpError(
        400,
        `Questao ${questionIndex + 1}: deve existir exatamente 1 opcao correta`,
      )
    }

    return {
      enunciado,
      peso: round2(peso),
      opcoes,
    }
  })

  const totalScore = round2(
    normalizedQuestions.reduce((total, question) => total + question.peso, 0),
  )
  if (totalScore !== 10) {
    throw new HttpError(400, "A soma dos pesos das questoes deve ser exatamente 10")
  }

  const prova = await createOrVersionObjectiveProva({
    trilhaId,
    titulo: titulo.trim(),
    notaTotal: totalScore,
    questoes: normalizedQuestions,
  })

  res.status(201).json({ prova })
})

export const getObjectiveForPlayer = asyncHandler(async (req: Request, res: Response) => {
  const { cpf } = req.query as { cpf?: string }

  if (cpf) {
    const cpfDigits = normalizeCpf(cpf)
    if (cpfDigits.length !== 11) {
      throw new HttpError(400, "CPF invalido")
    }

    const assigned = await isUserAssignedToTrilha(cpfDigits, req.params.trilhaId)
    if (!assigned) {
      throw new HttpError(403, "Trilha nao atribuida para este usuario")
    }
  }

  const prova = await getObjectiveProvaByTrilhaId(req.params.trilhaId)
  if (!prova) {
    res.json({ prova: null })
    return
  }

  res.json({ prova: sanitizeObjectiveProvaForPlayer(prova) })
})

export const submitObjectiveForPlayer = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId } = req.params
  const { cpf, respostas, user } = req.body as ObjectiveSubmitPayload

  if (!cpf) {
    throw new HttpError(400, "cpf e obrigatorio")
  }

  const cpfDigits = normalizeCpf(cpf)
  if (cpfDigits.length !== 11) {
    throw new HttpError(400, "CPF invalido")
  }

  if (!Array.isArray(respostas)) {
    throw new HttpError(400, "respostas invalida")
  }

  const assigned = await isUserAssignedToTrilha(cpfDigits, trilhaId)
  if (!assigned) {
    throw new HttpError(403, "Trilha nao atribuida para este usuario")
  }

  const prova = await getObjectiveProvaByTrilhaId(trilhaId)
  if (!prova) {
    throw new HttpError(404, "Prova objetiva nao encontrada para esta trilha")
  }

  const { finalScore, status, hits, gabarito } = evaluateObjectiveAnswers(prova, respostas)

  const normalizedUser = parseUserRecord(user)
  if (normalizedUser) {
    const mapped = mapReadViewToUser({ ...normalizedUser, CPF: cpfDigits })
    await upsertUser(mapped)
  } else {
    await upsertUser({ cpf: cpfDigits, ativo: true })
  }

  await createProvaAttempt({
    cpf: cpfDigits,
    provaId: prova.ID,
    provaVersao: prova.VERSAO,
    trilhaId,
    nota: finalScore,
    status,
    acertos: hits,
    totalQuestoes: prova.QUESTOES.length,
    respostasJson: JSON.stringify({
      respostas: respostas.map((resposta) => ({
        questaoId: resposta.questaoId ?? null,
        opcaoId: resposta.opcaoId ?? null,
      })),
      gabarito,
    }),
  })

  if (status === "aprovado") {
    await recordUserTraining({
      cpf: cpfDigits,
      tipo: "prova",
      materialId: prova.ID,
      materialVersao: prova.VERSAO,
      concluidoEm: new Date(),
      origem: "prova-objectiva",
    })
  }

  res.status(201).json({
    nota: finalScore,
    media: MEDIA_APROVACAO,
    status,
    acertos: hits,
    totalQuestoes: prova.QUESTOES.length,
    aprovado: status === "aprovado",
    gabarito,
    prova: {
      id: prova.ID,
      versao: prova.VERSAO,
      titulo: prova.TITULO,
    },
  })
})

export const submitObjectiveForCollective = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId } = req.params
  const { users, respostas, turmaId, concluidoEm, origem } = req.body as ObjectiveCollectiveSubmitPayload

  if (!Array.isArray(users) || users.length === 0) {
    throw new HttpError(400, "users e obrigatorio")
  }

  if (!Array.isArray(respostas)) {
    throw new HttpError(400, "respostas invalida")
  }

  const prova = await getObjectiveProvaByTrilhaId(trilhaId)
  if (!prova) {
    throw new HttpError(404, "Prova objetiva nao encontrada para esta trilha")
  }

  const concluidoDate = concluidoEm ? new Date(concluidoEm) : new Date()
  if (Number.isNaN(concluidoDate.getTime())) {
    throw new HttpError(400, "concluidoEm invalido")
  }
  if (turmaId && !GUID_REGEX.test(turmaId)) {
    throw new HttpError(400, "turmaId invalido")
  }

  const { finalScore, status, hits, gabarito } = evaluateObjectiveAnswers(prova, respostas)

  const uniqueUsers = new Map<string, Record<string, string>>()
  for (const user of users) {
    const raw = parseUserRecord(user)
    if (!raw) continue

    const cpfDigits = normalizeCpf(raw.CPF ?? raw.cpf ?? "")
    if (cpfDigits.length !== 11) continue

    raw.CPF = cpfDigits
    uniqueUsers.set(cpfDigits, raw)
  }

  if (uniqueUsers.size === 0) {
    throw new HttpError(400, "Nenhum usuario valido informado")
  }

  const serializedAnswers = JSON.stringify({
    respostas: respostas.map((resposta) => ({
      questaoId: resposta.questaoId ?? null,
      opcaoId: resposta.opcaoId ?? null,
    })),
    gabarito,
  })

  let attemptsCreated = 0
  let approvalsCreated = 0

  for (const [cpfDigits, raw] of uniqueUsers.entries()) {
    const mapped = mapReadViewToUser(raw)
    // eslint-disable-next-line no-await-in-loop
    await upsertUser(mapped)

    // eslint-disable-next-line no-await-in-loop
    await createProvaAttempt({
      cpf: cpfDigits,
      provaId: prova.ID,
      provaVersao: prova.VERSAO,
      trilhaId,
      nota: finalScore,
      status,
      acertos: hits,
      totalQuestoes: prova.QUESTOES.length,
      respostasJson: serializedAnswers,
      realizadoEm: concluidoDate,
    })
    attemptsCreated += 1

    if (status === "aprovado") {
      // eslint-disable-next-line no-await-in-loop
      const inserted = await recordUserTraining({
        cpf: cpfDigits,
        tipo: "prova",
        materialId: prova.ID,
        materialVersao: prova.VERSAO,
        turmaId: turmaId ?? null,
        concluidoEm: concluidoDate,
        origem: origem?.trim() || "prova-objectiva-coletiva",
      })
      if (inserted) approvalsCreated += 1
    }
  }

  res.status(201).json({
    nota: finalScore,
    media: MEDIA_APROVACAO,
    status,
    acertos: hits,
    totalQuestoes: prova.QUESTOES.length,
    aprovado: status === "aprovado",
    gabarito,
    prova: {
      id: prova.ID,
      versao: prova.VERSAO,
      titulo: prova.TITULO,
    },
    usuariosAvaliados: uniqueUsers.size,
    tentativasRegistradas: attemptsCreated,
    aprovacoesRegistradas: approvalsCreated,
  })
})

export const getLatestObjectiveResult = asyncHandler(async (req: Request, res: Response) => {
  const { cpf } = req.query as { cpf?: string }
  if (!cpf) {
    throw new HttpError(400, "cpf e obrigatorio")
  }

  const cpfDigits = normalizeCpf(cpf)
  if (cpfDigits.length !== 11) {
    throw new HttpError(400, "CPF invalido")
  }

  const trilhaId = req.params.trilhaId
  const [attempt, latestProva] = await Promise.all([
    getLatestProvaAttemptByTrilha(cpfDigits, trilhaId),
    getObjectiveProvaByTrilhaId(trilhaId),
  ])

  if (!attempt) {
    res.json({ result: null })
    return
  }
  if (!latestProva) {
    res.json({ result: null })
    return
  }

  if (attempt.PROVA_ID !== latestProva.ID || attempt.PROVA_VERSAO !== latestProva.VERSAO) {
    res.json({ result: null })
    return
  }

  const progress = await getUserCurrentVideoProgressByTrilha(cpfDigits, trilhaId)
  if (
    progress.TOTAL_VIDEOS_ATUAIS > 0 &&
    progress.TOTAL_CONCLUIDOS_ATUAIS < progress.TOTAL_VIDEOS_ATUAIS
  ) {
    res.json({ result: null })
    return
  }

  if (progress.ULTIMA_CONCLUSAO_ATUAL) {
    const attemptDate = new Date(attempt.DT_REALIZACAO)
    const latestVideoConclusion = new Date(progress.ULTIMA_CONCLUSAO_ATUAL)
    if (attemptDate < latestVideoConclusion) {
      res.json({ result: null })
      return
    }
  }

  let respostas = null as unknown
  if (attempt.RESPOSTAS_JSON) {
    try {
      respostas = JSON.parse(attempt.RESPOSTAS_JSON)
    } catch {
      respostas = null
    }
  }

  res.json({
    result: {
      ...attempt,
      RESPOSTAS: respostas,
    },
  })
})

function parseDateRangeBoundary(raw: string | undefined, endOfDay = false) {
  if (!raw) {
    return undefined
  }

  const value = raw.trim()
  if (!value) {
    return undefined
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const date = endOfDay
    ? new Date(`${value}T23:59:59.999`)
    : new Date(`${value}T00:00:00.000`)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

export const listAttemptsReport = asyncHandler(async (req: Request, res: Response) => {
  const { status, dateFrom, dateTo } = req.query as {
    status?: string
    dateFrom?: string
    dateTo?: string
  }

  let normalizedStatus: ProvaAttemptStatus | undefined
  if (status) {
    const value = status.trim().toLowerCase()
    if (value !== "aprovado" && value !== "reprovado") {
      throw new HttpError(400, "status invalido")
    }
    normalizedStatus = value
  }

  const parsedDateFrom = parseDateRangeBoundary(dateFrom, false)
  if (parsedDateFrom === null) {
    throw new HttpError(400, "dateFrom invalida. Use o formato YYYY-MM-DD")
  }

  const parsedDateTo = parseDateRangeBoundary(dateTo, true)
  if (parsedDateTo === null) {
    throw new HttpError(400, "dateTo invalida. Use o formato YYYY-MM-DD")
  }

  if (parsedDateFrom && parsedDateTo && parsedDateFrom > parsedDateTo) {
    throw new HttpError(400, "dateFrom nao pode ser maior que dateTo")
  }

  const report = await listProvaAttemptsReport({
    status: normalizedStatus,
    dateFrom: parsedDateFrom ?? undefined,
    dateTo: parsedDateTo ?? undefined,
  })

  res.json({ report })
})
