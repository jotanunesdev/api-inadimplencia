import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import { normalizeCpf } from "../utils/normalizeCpf"
import {
  getIndividualTrainingHoursMonthlySummaryLast12Months,
  getTrainingEficaciaSummary,
} from "../models/userTrainingModel"
import { getCollectiveTrainingHoursMonthlySummaryLast12Months } from "../models/turmaModel"
import {
  createPlatformSatisfaction,
  getLatestPlatformSatisfactionByCpf,
  getPlatformSatisfactionSummary,
} from "../models/platformSatisfactionModel"

const SATISFACAO_MIN = 1
const SATISFACAO_MAX = 5
const SATISFACAO_INTERVAL_DAYS = 15
const DAY_MS = 24 * 60 * 60 * 1000

function buildLast12MonthsTemplate(referenceDate: Date = new Date()) {
  const labels: string[] = []
  const keys: string[] = []
  const now = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const ano = date.getFullYear()
    const mes = date.getMonth() + 1
    keys.push(`${ano}-${String(mes).padStart(2, "0")}`)
    labels.push(date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }))
  }
  return { labels, keys }
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseNivel(value: unknown) {
  const nivel = Number(value)
  if (!Number.isInteger(nivel) || nivel < SATISFACAO_MIN || nivel > SATISFACAO_MAX) {
    throw new HttpError(400, "nivel de satisfacao invalido")
  }
  return nivel
}

export const getPlatformSatisfactionStatus = asyncHandler(async (req: Request, res: Response) => {
  const cpfDigits = normalizeCpf(req.params.cpf ?? req.query.cpf ?? "")
  if (cpfDigits.length !== 11) {
    throw new HttpError(400, "CPF invalido")
  }

  try {
    const latest = await getLatestPlatformSatisfactionByCpf(cpfDigits)
    if (!latest) {
      res.json({
        deveExibir: true,
        intervaloDias: SATISFACAO_INTERVAL_DAYS,
        ultimaRespostaEm: null,
        proximaDisponivelEm: null,
        diasDesdeUltima: null,
      })
      return
    }

    const now = new Date()
    const nextDue = new Date(latest.RESPONDIDO_EM.getTime() + SATISFACAO_INTERVAL_DAYS * DAY_MS)
    const diffDays = Math.floor((now.getTime() - latest.RESPONDIDO_EM.getTime()) / DAY_MS)

    res.json({
      deveExibir: now.getTime() >= nextDue.getTime(),
      intervaloDias: SATISFACAO_INTERVAL_DAYS,
      ultimaRespostaEm: latest.RESPONDIDO_EM.toISOString(),
      proximaDisponivelEm: nextDue.toISOString(),
      diasDesdeUltima: Math.max(0, diffDays),
    })
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : ""
    if (code === "PLATFORM_SATISFACTION_TABLE_MISSING") {
      throw new HttpError(
        400,
        "Banco sem suporte a pesquisa de satisfacao da plataforma. Execute a migration da TPESQUISA_SATISFACAO_PLATAFORMA.",
      )
    }
    throw error
  }
})

export const submitPlatformSatisfaction = asyncHandler(async (req: Request, res: Response) => {
  const { cpf, nivelSatisfacao, nivel, respondidoEm } = req.body as {
    cpf?: string
    nivelSatisfacao?: number
    nivel?: number
    respondidoEm?: string
  }

  const cpfDigits = normalizeCpf(cpf ?? "")
  if (cpfDigits.length !== 11) {
    throw new HttpError(400, "CPF invalido")
  }

  const parsedNivel = parseNivel(nivelSatisfacao ?? nivel)
  const respondidoDate = respondidoEm ? new Date(respondidoEm) : new Date()
  if (Number.isNaN(respondidoDate.getTime())) {
    throw new HttpError(400, "respondidoEm invalido")
  }

  try {
    const result = await createPlatformSatisfaction({
      cpf: cpfDigits,
      nivelSatisfacao: parsedNivel,
      respondidoEm: respondidoDate,
    })
    res.status(201).json({ respondidoEm: result.respondidoEm.toISOString() })
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : ""
    if (code === "PLATFORM_SATISFACTION_TABLE_MISSING") {
      throw new HttpError(
        400,
        "Banco sem suporte a pesquisa de satisfacao da plataforma. Execute a migration da TPESQUISA_SATISFACAO_PLATAFORMA.",
      )
    }
    throw error
  }
})

export const getTrainingFeedbackDashboardSummary = asyncHandler(
  async (_req: Request, res: Response) => {
    const [eficaciaRows, satisfacaoRows, horasColetivoRows, horasIndividualRows] = await Promise.all([
      getTrainingEficaciaSummary(),
      getPlatformSatisfactionSummary(),
      getCollectiveTrainingHoursMonthlySummaryLast12Months(),
      getIndividualTrainingHoursMonthlySummaryLast12Months(),
    ])

    const monthTemplate = buildLast12MonthsTemplate()
    const coletivoMap = new Map<string, number>()
    for (const row of horasColetivoRows) {
      const key = `${Number(row.ANO)}-${String(Number(row.MES)).padStart(2, "0")}`
      coletivoMap.set(key, toNumber(row.TOTAL_HORAS))
    }
    const individualMap = new Map<string, number>()
    for (const row of horasIndividualRows) {
      const key = `${Number(row.ANO)}-${String(Number(row.MES)).padStart(2, "0")}`
      individualMap.set(key, toNumber(row.TOTAL_HORAS))
    }

    const horasColetivoSerie = monthTemplate.keys.map((key) => Number((coletivoMap.get(key) ?? 0).toFixed(2)))
    const horasIndividualSerie = monthTemplate.keys.map((key) =>
      Number((individualMap.get(key) ?? 0).toFixed(2)),
    )

    res.json({
      eficacia: {
        total: eficaciaRows.reduce((sum, row) => sum + Number(row.TOTAL ?? 0), 0),
        counts: eficaciaRows.map((row) => ({
          nivel: Number(row.NIVEL),
          total: Number(row.TOTAL ?? 0),
        })),
      },
      satisfacao: {
        total: satisfacaoRows.reduce((sum, row) => sum + Number(row.TOTAL ?? 0), 0),
        counts: satisfacaoRows.map((row) => ({
          nivel: Number(row.NIVEL_SATISFACAO),
          total: Number(row.TOTAL ?? 0),
        })),
      },
      horasTreinamento12Meses: {
        labels: monthTemplate.labels,
        ministradoInstrutorHoras: horasColetivoSerie,
        assistidoIndividualHoras: horasIndividualSerie,
        totais: {
          ministradoInstrutorHoras: Number(
            horasColetivoSerie.reduce((sum, value) => sum + value, 0).toFixed(2),
          ),
          assistidoIndividualHoras: Number(
            horasIndividualSerie.reduce((sum, value) => sum + value, 0).toFixed(2),
          ),
        },
      },
    })
  },
)
