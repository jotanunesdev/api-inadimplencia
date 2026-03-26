import type { Request, Response } from "express"
import { env } from "../config/env"
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
  createOrVersionEfficacyProva,
  createOrVersionObjectiveProva,
  createProva,
  deleteProva,
  getEfficacyProvaByTrilhaId,
  getObjectiveProvaForExecutionByTrilhaId,
  getObjectiveProvaByTrilhaId,
  getProvaById,
  listProvas,
  normalizeProvaModoAplicacao,
  proofExecutionMustBeCollective,
  type ProvaObjectiveRecord,
  PROVA_MODO_APLICACAO,
  updateProva,
} from "../models/provaModel"
import {
  getTrilhaById,
  trilhaHasEficaciaConfig,
  upsertTrilhaEficaciaConfig,
  updateTrilha,
} from "../models/trilhaModel"
import { getModuleById } from "../models/moduleModel"
import {
  clearTrainingWorkflowNotifications,
  createTrainingWorkflowNotification,
} from "../models/trainingWorkflowNotificationModel"
import {
  broadcastTrainingWorkflowNotificationSnapshot,
} from "../services/trainingWorkflowNotificationRealtime"
import {
  buildTrainingNotificationAuthor,
  listNotificationUsernamesBySectorKey,
} from "../services/trainingNotificationRecipientService"
import {
  normalizeUsernameValue,
  resolveSectorDefinitionFromModuleName,
} from "../utils/sectorAccess"
import {
  assertCollectiveProofTokenActive,
  createCollectiveProofToken,
  type CollectiveProofTokenPayload,
  parseCollectiveProofToken,
} from "../utils/collectiveProofToken"
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
  const { id, trilhaId, provaPath, versao, modoAplicacao } = req.body as {
    id?: string
    trilhaId?: string
    provaPath?: string
    versao?: number
    modoAplicacao?: string
  }

  if (!id || !trilhaId || !provaPath) {
    throw new HttpError(400, "ID, trilhaId e provaPath sao obrigatorios")
  }

  const prova = await createProva({
    id,
    trilhaId,
    provaPath,
    versao,
    modoAplicacao: normalizeProvaModoAplicacao(modoAplicacao),
  })

  res.status(201).json({ prova })
})

export const createUpload = asyncHandler(async (req: Request, res: Response) => {
  const { id, trilhaId, versao, modoAplicacao } = req.body as {
    id?: string
    trilhaId?: string
    versao?: number
    modoAplicacao?: string
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
    modoAplicacao: normalizeProvaModoAplicacao(modoAplicacao),
  })

  res.status(201).json({ prova })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId, provaPath, versao, modoAplicacao } = req.body as {
    trilhaId?: string
    provaPath?: string
    versao?: number
    modoAplicacao?: string
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
    modoAplicacao:
      modoAplicacao !== undefined
        ? normalizeProvaModoAplicacao(modoAplicacao)
        : undefined,
  })

  if (!prova) {
    throw new HttpError(404, "Prova nao encontrada")
  }

  res.json({ prova })
})

export const updateUpload = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId, versao, modoAplicacao } = req.body as {
    trilhaId?: string
    versao?: number
    modoAplicacao?: string
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
    modoAplicacao:
      modoAplicacao !== undefined
        ? normalizeProvaModoAplicacao(modoAplicacao)
        : undefined,
  })

  if (!prova) {
    throw new HttpError(404, "Prova nao encontrada")
  }

  res.json({ prova })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  try {
    await deleteProva(req.params.id)
  } catch (error) {
    const requestError = error as {
      number?: number
      originalError?: { info?: { message?: string } }
      message?: string
    }
    const message =
      requestError?.originalError?.info?.message ?? requestError?.message ?? ""

    if (requestError?.number === 547) {
      throw new HttpError(
        409,
        "Nao e possivel excluir esta prova porque existem tentativas, conclusoes ou registros associados.",
      )
    }

    if (message) {
      throw new HttpError(400, message)
    }
    throw error
  }
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

type StructuredQuestionValidationOptions = {
  requireCorrectOption: boolean
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

type ObjectiveCollectiveQrPayload = {
  users?: Array<Record<string, unknown>>
  trilhaIds?: string[]
  turmaId?: string
  redirectBaseUrl?: string
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
const DEFAULT_EFFICACY_DESTINATION_SECTOR = "recursos-humanos"
const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function readDatabaseErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return ""
  }

  const requestError = error as {
    message?: string
    originalError?: { info?: { message?: string } }
  }

  return (
    requestError.originalError?.info?.message ??
    requestError.message ??
    ""
  )
}

function isLegacySingleProofIndexError(error: unknown) {
  const message = readDatabaseErrorMessage(error)
  return message.includes("UX_TPROVAS_TRILHA")
}

function buildBalancedWeights(questionCount: number) {
  if (!Number.isFinite(questionCount) || questionCount <= 0) {
    return [] as number[]
  }

  const normalizedCount = Math.max(1, Math.trunc(questionCount))
  const weights: number[] = []
  let accumulated = 0

  for (let index = 0; index < normalizedCount; index += 1) {
    if (index === normalizedCount - 1) {
      weights.push(round2(10 - accumulated))
      break
    }

    const weight = round2(10 / normalizedCount)
    accumulated += weight
    weights.push(weight)
  }

  return weights
}

function sanitizeStructuredQuestions(
  questoes: ObjectiveQuestionPayload[] | undefined,
  options: StructuredQuestionValidationOptions,
) {
  if (!Array.isArray(questoes) || questoes.length === 0) {
    throw new HttpError(400, "A prova deve conter ao menos uma questao")
  }

  const efficacyWeights = buildBalancedWeights(questoes.length)

  return questoes.map((question, questionIndex) => {
    const enunciado = question.enunciado?.trim()
    if (!enunciado) {
      throw new HttpError(400, `Questao ${questionIndex + 1}: enunciado obrigatorio`)
    }

    const parsedPeso = Number(question.peso)
    const peso = options.requireCorrectOption
      ? parsedPeso
      : efficacyWeights[questionIndex] ?? 1

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
        correta: options.requireCorrectOption ? Boolean(option.correta) : false,
      }
    })

    if (options.requireCorrectOption) {
      const correctCount = opcoes.filter((option) => option.correta).length
      if (correctCount !== 1) {
        throw new HttpError(
          400,
          `Questao ${questionIndex + 1}: deve existir exatamente 1 opcao correta`,
        )
      }
    }

    return {
      enunciado,
      peso: round2(peso),
      opcoes,
    }
  })
}

async function resolveTrainingWorkflowContext(trilhaId: string) {
  const trilha = await getTrilhaById(trilhaId)
  if (!trilha) {
    throw new HttpError(404, "Trilha nao encontrada")
  }

  const module = await getModuleById(trilha.MODULO_FK_ID)
  const ownerSector = resolveSectorDefinitionFromModuleName(module?.NOME)

  return {
    module,
    ownerSector,
    trilha,
  }
}

async function broadcastWorkflowRecipients(usernames: string[]) {
  await Promise.all(
    Array.from(
      new Set(usernames.map((value) => normalizeUsernameValue(value)).filter(Boolean)),
    ).map((username) => broadcastTrainingWorkflowNotificationSnapshot(username)),
  )
}

async function notifyHumanResourcesPendingEfficacy(params: {
  actorName?: string | null
  actorUsername?: string | null
  trilhaId: string
}) {
  const workflowContext = await resolveTrainingWorkflowContext(params.trilhaId)

  if (
    !workflowContext.ownerSector ||
    workflowContext.ownerSector.key === DEFAULT_EFFICACY_DESTINATION_SECTOR
  ) {
    return {
      recipientCount: 0,
      sent: false,
    }
  }

  const hasEficacia = await trilhaHasEficaciaConfig(params.trilhaId).catch(() => false)
  if (hasEficacia) {
    return {
      recipientCount: 0,
      sent: false,
    }
  }

  const recipients = await listNotificationUsernamesBySectorKey(
    DEFAULT_EFFICACY_DESTINATION_SECTOR,
  )
  if (recipients.length === 0) {
    return {
      recipientCount: 0,
      sent: false,
    }
  }

  const author = buildTrainingNotificationAuthor({
    authorName: params.actorName ?? workflowContext.trilha.CRIADO_POR ?? null,
    authorUsername: params.actorUsername ?? workflowContext.trilha.CRIADO_POR ?? null,
  })

  await Promise.all(
    recipients.map((recipientUsername) =>
      createTrainingWorkflowNotification({
        recipientUsername,
        type: "training_pending_efficacy",
        trainingId: workflowContext.trilha.ID,
        trainingTitle: workflowContext.trilha.TITULO,
        moduleId: workflowContext.trilha.MODULO_FK_ID,
        sourceSectorKey: workflowContext.ownerSector?.key ?? null,
        sourceSectorLabel: workflowContext.ownerSector?.label ?? null,
        destinationSectorKey: DEFAULT_EFFICACY_DESTINATION_SECTOR,
        authorName: author.authorName,
        authorUsername: author.authorUsername,
      }),
    ),
  )

  await broadcastWorkflowRecipients(recipients)

  return {
    recipientCount: recipients.length,
    sent: true,
  }
}

async function notifyTrainingReadyForAssignment(params: {
  actorName?: string | null
  actorUsername?: string | null
  trilhaId: string
}) {
  const workflowContext = await resolveTrainingWorkflowContext(params.trilhaId)
  const clearedRecipients = await clearTrainingWorkflowNotifications({
    trainingId: workflowContext.trilha.ID,
    type: "training_pending_efficacy",
  })

  if (
    !workflowContext.ownerSector ||
    workflowContext.ownerSector.key === DEFAULT_EFFICACY_DESTINATION_SECTOR
  ) {
    await broadcastWorkflowRecipients(clearedRecipients)
    return {
      recipientCount: 0,
      sent: false,
    }
  }

  const recipients = await listNotificationUsernamesBySectorKey(
    workflowContext.ownerSector.key,
  )
  const author = buildTrainingNotificationAuthor({
    authorName: params.actorName ?? "Recursos Humanos",
    authorUsername: params.actorUsername ?? null,
  })

  await Promise.all(
    recipients.map((recipientUsername) =>
      createTrainingWorkflowNotification({
        recipientUsername,
        type: "training_ready_assignment",
        trainingId: workflowContext.trilha.ID,
        trainingTitle: workflowContext.trilha.TITULO,
        moduleId: workflowContext.trilha.MODULO_FK_ID,
        sourceSectorKey: workflowContext.ownerSector?.key ?? null,
        sourceSectorLabel: workflowContext.ownerSector?.label ?? null,
        destinationSectorKey: workflowContext.ownerSector?.key ?? null,
        authorName: author.authorName,
        authorUsername: author.authorUsername,
      }),
    ),
  )

  await broadcastWorkflowRecipients([...clearedRecipients, ...recipients])

  return {
    recipientCount: recipients.length,
    sent: recipients.length > 0,
  }
}

function sanitizeObjectiveProvaForPlayer(prova: {
  ID: string
  TRILHA_FK_ID: string
  VERSAO: number
  MODO_APLICACAO: string
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
  const modoAplicacao = normalizeProvaModoAplicacao(prova.MODO_APLICACAO)
  return {
    ID: prova.ID,
    TRILHA_FK_ID: prova.TRILHA_FK_ID,
    VERSAO: prova.VERSAO,
    MODO_APLICACAO: modoAplicacao,
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

async function getObjectiveProvaForExecutionWithFallback(trilhaId: string) {
  try {
    return await getObjectiveProvaForExecutionByTrilhaId(trilhaId)
  } catch (error) {
    const fallback = await getObjectiveProvaByTrilhaId(trilhaId)
    if (fallback) {
      console.warn(
        `[treinamento] fallback da prova objetiva base aplicado para a trilha ${trilhaId}`,
        error,
      )
      return fallback
    }
    throw error
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

function resolveCollectiveProofRedirectBaseUrl(
  req: Request,
  redirectBaseUrl: unknown,
) {
  const requestValue =
    typeof redirectBaseUrl === "string" ? redirectBaseUrl.trim() : ""
  const configuredValue = String(
    env.COLLECTIVE_PROVA_REDIRECT_BASE_URL ?? "",
  ).trim()
  const forwardedProto = String(
    req.get("x-forwarded-proto") ?? req.protocol ?? "https",
  )
    .split(",")[0]
    ?.trim()
  const forwardedHost = String(
    req.get("x-forwarded-host") ?? req.get("host") ?? "",
  )
    .split(",")[0]
    ?.trim()
  const requestOrigin = forwardedHost
    ? `${forwardedProto || "https"}://${forwardedHost}`
    : ""

  const resolved = requestValue || configuredValue || requestOrigin
  if (!resolved) {
    throw new HttpError(400, "Nao foi possivel determinar a URL base do QR Code.")
  }

  try {
    const normalized = new URL(resolved)
    normalized.hash = ""
    normalized.search = ""
    normalized.pathname = normalized.pathname.replace(/\/+$/, "")
    return normalized.toString().replace(/\/+$/, "")
  } catch {
    throw new HttpError(400, "redirectBaseUrl invalido")
  }
}

function assertTokenCanAccessTrilha(
  token: string | undefined,
  cpfDigits: string,
  trilhaId: string,
) {
  if (!token?.trim()) {
    return null
  }

  let payload: CollectiveProofTokenPayload
  try {
    payload = parseCollectiveProofToken(token.trim())
    assertCollectiveProofTokenActive(payload)
  } catch (error) {
    throw new HttpError(
      401,
      error instanceof Error ? error.message : "Token coletivo invalido",
    )
  }

  if (!payload.cpfs.includes(cpfDigits)) {
    throw new HttpError(403, "CPF nao autorizado para este token coletivo")
  }
  if (!payload.trilhaIds.includes(trilhaId)) {
    throw new HttpError(403, "Trilha nao autorizada para este token coletivo")
  }

  return payload
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

export const getEfficacyByTrilha = asyncHandler(async (req: Request, res: Response) => {
  const { versao } = req.query as { versao?: string }
  const parsedVersion =
    versao !== undefined && versao !== "" ? Number(versao) : undefined

  if (parsedVersion !== undefined && (!Number.isFinite(parsedVersion) || parsedVersion <= 0)) {
    throw new HttpError(400, "versao invalida")
  }

  const prova = await getEfficacyProvaByTrilhaId(req.params.trilhaId, parsedVersion)
  if (!prova) {
    res.json({ prova: null })
    return
  }

  res.json({ prova })
})

export const createOrVersionObjective = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId } = req.params
  const { actorName, actorUsername, titulo, questoes, modoAplicacao } = req.body as {
    actorName?: string
    actorUsername?: string
    titulo?: string
    questoes?: ObjectiveQuestionPayload[]
    modoAplicacao?: string
  }

  if (!titulo?.trim()) {
    throw new HttpError(400, "titulo da prova e obrigatorio")
  }

  const normalizedQuestions = sanitizeStructuredQuestions(questoes, {
    requireCorrectOption: true,
  })

  const totalScore = round2(
    normalizedQuestions.reduce((total, question) => total + question.peso, 0),
  )
  if (totalScore !== 10) {
    throw new HttpError(400, "A soma dos pesos das questoes deve ser exatamente 10")
  }

  const requestedModoAplicacao = normalizeProvaModoAplicacao(modoAplicacao)
  const mustBeCollective = await proofExecutionMustBeCollective(trilhaId)
  const finalModoAplicacao = mustBeCollective
    ? PROVA_MODO_APLICACAO.COLETIVA
    : requestedModoAplicacao

  let prova
  try {
    prova = await createOrVersionObjectiveProva({
      trilhaId,
      titulo: titulo.trim(),
      notaTotal: totalScore,
      modoAplicacao: finalModoAplicacao,
      questoes: normalizedQuestions,
    })
  } catch (error) {
    if (isLegacySingleProofIndexError(error)) {
      throw new HttpError(
        400,
        "Banco sem suporte a prova objetiva e avaliacao de eficacia na mesma trilha. Atualize os indices de dbo.TPROVAS.",
      )
    }
    throw error
  }

  const hrPendingNotification = await notifyHumanResourcesPendingEfficacy({
    actorName,
    actorUsername,
    trilhaId,
  })

  res.status(201).json({
    prova,
    rhPendingNotificationRecipientCount: hrPendingNotification.recipientCount,
    rhPendingNotificationSent: hrPendingNotification.sent,
  })
})

export const createOrVersionEfficacy = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId } = req.params
  const { actorName, actorUsername, questoes, titulo } = req.body as {
    actorName?: string
    actorUsername?: string
    questoes?: ObjectiveQuestionPayload[]
    titulo?: string
  }

  if (!titulo?.trim()) {
    throw new HttpError(400, "titulo da avaliacao de eficacia e obrigatorio")
  }

  const normalizedQuestions = sanitizeStructuredQuestions(questoes, {
    requireCorrectOption: false,
  })
  const totalScore = round2(
    normalizedQuestions.reduce((total, question) => total + question.peso, 0),
  )

  let prova
  try {
    prova = await createOrVersionEfficacyProva({
      trilhaId,
      titulo: titulo.trim(),
      notaTotal: totalScore,
      modoAplicacao: PROVA_MODO_APLICACAO.INDIVIDUAL,
      questoes: normalizedQuestions,
    })
  } catch (error) {
    if (isLegacySingleProofIndexError(error)) {
      throw new HttpError(
        400,
        "Banco sem suporte a prova objetiva e avaliacao de eficacia na mesma trilha. Atualize os indices de dbo.TPROVAS.",
      )
    }
    throw error
  }

  const firstQuestion = normalizedQuestions[0]?.enunciado ?? titulo.trim()
  try {
    await upsertTrilhaEficaciaConfig(trilhaId, {
      pergunta: firstQuestion,
      obrigatoria: true,
      atualizadoEm: new Date(),
    })
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : ""
    if (code === "TRILHA_EFICACIA_CONFIG_COLUMNS_MISSING") {
      throw new HttpError(
        400,
        "Banco sem suporte a configuracao de avaliacao de eficacia por trilha. Execute a migration de TTRILHAS.",
      )
    }
    throw error
  }

  const readyNotification = await notifyTrainingReadyForAssignment({
    actorName,
    actorUsername,
    trilhaId,
  })

  res.status(201).json({
    prova,
    readyAssignmentNotificationRecipientCount: readyNotification.recipientCount,
    readyAssignmentNotificationSent: readyNotification.sent,
    resumoPergunta: firstQuestion,
  })
})

export const getObjectiveForPlayer = asyncHandler(async (req: Request, res: Response) => {
  const { cpf, token } = req.query as { cpf?: string; token?: string }

  if (cpf) {
    const cpfDigits = normalizeCpf(cpf)
    if (cpfDigits.length !== 11) {
      throw new HttpError(400, "CPF invalido")
    }

    const tokenPayload = assertTokenCanAccessTrilha(token, cpfDigits, req.params.trilhaId)
    if (!tokenPayload) {
      const assigned = await isUserAssignedToTrilha(cpfDigits, req.params.trilhaId)
      if (!assigned) {
        throw new HttpError(403, "Trilha nao atribuida para este usuario")
      }
    }
  }

  const prova = await getObjectiveProvaForExecutionWithFallback(req.params.trilhaId)
  if (!prova) {
    res.json({ prova: null })
    return
  }

  res.json({ prova: sanitizeObjectiveProvaForPlayer(prova) })
})

export const submitObjectiveForPlayer = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId } = req.params
  const { cpf, respostas, user, token } = req.body as ObjectiveSubmitPayload & {
    token?: string
  }

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

  const tokenPayload = assertTokenCanAccessTrilha(token, cpfDigits, trilhaId)
  if (!tokenPayload) {
    const assigned = await isUserAssignedToTrilha(cpfDigits, trilhaId)
    if (!assigned) {
      throw new HttpError(403, "Trilha nao atribuida para este usuario")
    }
  }

  const prova = await getObjectiveProvaForExecutionWithFallback(trilhaId)
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
      turmaId: tokenPayload?.turmaId ?? null,
      concluidoEm: new Date(),
      origem: tokenPayload
        ? "prova-objectiva-coletiva-individual"
        : "prova-objectiva",
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

  const prova = await getObjectiveProvaForExecutionWithFallback(trilhaId)
  if (!prova) {
    throw new HttpError(404, "Prova objetiva nao encontrada para esta trilha")
  }
  if (normalizeProvaModoAplicacao(prova.MODO_APLICACAO) === PROVA_MODO_APLICACAO.INDIVIDUAL) {
    throw new HttpError(
      409,
      "Esta prova esta configurada para realizacao individual e nao pode ser aplicada em modo coletivo.",
    )
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

function sanitizeObjectiveProvaListItem(prova: ProvaObjectiveRecord) {
  const modoAplicacao = normalizeProvaModoAplicacao(prova.MODO_APLICACAO)
  return {
    ID: prova.ID,
    TRILHA_FK_ID: prova.TRILHA_FK_ID,
    VERSAO: prova.VERSAO,
    TITULO: prova.TITULO,
    NOTA_TOTAL: prova.NOTA_TOTAL,
    MODO_APLICACAO: modoAplicacao,
  }
}

export const generateCollectiveIndividualProofQr = asyncHandler(
  async (req: Request, res: Response) => {
    const { users, trilhaIds, turmaId, redirectBaseUrl } =
      req.body as ObjectiveCollectiveQrPayload

    if (!Array.isArray(users) || users.length === 0) {
      throw new HttpError(400, "users e obrigatorio")
    }
    if (!Array.isArray(trilhaIds) || trilhaIds.length === 0) {
      throw new HttpError(400, "trilhaIds e obrigatorio")
    }
    if (turmaId && !GUID_REGEX.test(turmaId)) {
      throw new HttpError(400, "turmaId invalido")
    }

    const cpfs = new Set<string>()
    for (const user of users) {
      const parsed = parseUserRecord(user)
      if (!parsed) continue
      const cpfDigits = normalizeCpf(parsed.CPF ?? parsed.cpf ?? "")
      if (cpfDigits.length === 11) {
        cpfs.add(cpfDigits)
      }
    }
    if (!cpfs.size) {
      throw new HttpError(400, "Nenhum CPF valido informado")
    }

    const validTrilhaIds = Array.from(
      new Set(
        trilhaIds
          .map((id) => String(id ?? "").trim())
          .filter((id) => GUID_REGEX.test(id)),
      ),
    )
    if (!validTrilhaIds.length) {
      throw new HttpError(400, "Nenhuma trilha valida informada")
    }

    const provasIndividuais: ProvaObjectiveRecord[] = []
    for (const trilhaId of validTrilhaIds) {
      // eslint-disable-next-line no-await-in-loop
      const prova = await getObjectiveProvaForExecutionWithFallback(trilhaId)
      if (!prova) continue
      if (normalizeProvaModoAplicacao(prova.MODO_APLICACAO) !== PROVA_MODO_APLICACAO.INDIVIDUAL) continue
      provasIndividuais.push(prova)
    }

    if (!provasIndividuais.length) {
      throw new HttpError(
        400,
        "Nenhuma das trilhas selecionadas possui prova configurada para aplicacao individual.",
      )
    }

    const { token, payload } = createCollectiveProofToken({
      cpfs: Array.from(cpfs),
      trilhaIds: provasIndividuais.map((item) => item.TRILHA_FK_ID),
      turmaId: turmaId ?? null,
    })

    const normalizedBaseUrl = resolveCollectiveProofRedirectBaseUrl(
      req,
      redirectBaseUrl,
    )
    const redirectUrl = `${normalizedBaseUrl}/?coletivoProvaToken=${encodeURIComponent(token)}`
    const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
      redirectUrl,
    )}`

    res.status(201).json({
      token,
      redirectUrl,
      qrCodeImageUrl,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      trilhas: provasIndividuais.map(sanitizeObjectiveProvaListItem),
      totalUsuarios: cpfs.size,
    })
  },
)

export const resolveCollectiveIndividualProofToken = asyncHandler(
  async (req: Request, res: Response) => {
    const token = String(req.params.token ?? "").trim()
    if (!token) {
      throw new HttpError(400, "token e obrigatorio")
    }

    let payload
    try {
      payload = parseCollectiveProofToken(token)
      assertCollectiveProofTokenActive(payload)
    } catch (error) {
      throw new HttpError(
        401,
        error instanceof Error ? error.message : "Token coletivo invalido",
      )
    }

    const cpfQuery = String(req.query.cpf ?? "").trim()
    if (cpfQuery) {
      const cpfDigits = normalizeCpf(cpfQuery)
      if (cpfDigits.length !== 11) {
        throw new HttpError(400, "CPF invalido")
      }
      if (!payload.cpfs.includes(cpfDigits)) {
        throw new HttpError(403, "CPF nao autorizado para este token coletivo")
      }
    }

    const provas: ReturnType<typeof sanitizeObjectiveProvaListItem>[] = []
    for (const trilhaId of payload.trilhaIds) {
      // eslint-disable-next-line no-await-in-loop
      const prova = await getObjectiveProvaByTrilhaId(trilhaId)
      if (!prova) continue
      provas.push(sanitizeObjectiveProvaListItem(prova))
    }

    res.json({
      token,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      turmaId: payload.turmaId,
      trilhas: payload.trilhaIds,
      cpfs: payload.cpfs,
      provas,
    })
  },
)

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
  const { status, dateFrom, dateTo, trilhaId } = req.query as {
    status?: string
    dateFrom?: string
    dateTo?: string
    trilhaId?: string
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
    trilhaId: trilhaId?.trim() || undefined,
  })

  res.json({ report })
})
