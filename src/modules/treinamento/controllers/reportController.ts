import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import { normalizeCpf } from "../utils/normalizeCpf"
import {
  listObraTrainingOverviewReport,
  listObraTrainingStatusReport,
  listProcedimentoVersionChangesReport,
  listUserTrainingStatusReport,
} from "../models/reportModel"
import { getTrilhaTrainingStatusReport } from "../models/provaAttemptModel"

const GUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseOptionalDate(value: unknown, fieldName: string) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null
  }

  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `${fieldName} invalida`)
  }
  return parsed
}

export const listUserTrainingsReport = asyncHandler(async (req: Request, res: Response) => {
  const cpf = normalizeCpf(String(req.query.cpf ?? ""))
  if (cpf.length !== 11) {
    throw new HttpError(400, "CPF invalido")
  }

  const report = await listUserTrainingStatusReport(cpf)
  res.json({ report })
})

export const listObraPendingTrainingsReport = asyncHandler(async (req: Request, res: Response) => {
  const obra = String(req.query.obra ?? "").trim() || null
  if (!obra) {
    throw new HttpError(400, "obra e obrigatoria")
  }

  const report = await listObraTrainingStatusReport({
    obraNome: obra,
    apenasPendentes: true,
  })

  res.json({ report })
})

export const listObraTrainedReport = asyncHandler(async (req: Request, res: Response) => {
  const obra = String(req.query.obra ?? "").trim() || null
  if (!obra) {
    throw new HttpError(400, "obra e obrigatoria")
  }

  const report = await listObraTrainingStatusReport({
    obraNome: obra,
    apenasConcluidos: true,
  })

  res.json({ report })
})

export const listObraTrainingOverview = asyncHandler(async (_req: Request, res: Response) => {
  const report = await listObraTrainingOverviewReport()
  res.json({ report })
})

export const listProcedimentoVersionReport = asyncHandler(async (req: Request, res: Response) => {
  const inicio = parseOptionalDate(req.query.inicio, "data inicio")
  const fim = parseOptionalDate(req.query.fim, "data fim")

  if (inicio && fim && inicio.getTime() > fim.getTime()) {
    throw new HttpError(400, "data inicio deve ser menor ou igual a data fim")
  }

  const report = await listProcedimentoVersionChangesReport({ inicio, fim })
  res.json(report)
})

export const listTrilhaTrainingReport = asyncHandler(async (req: Request, res: Response) => {
  const trilhaId = String(req.params.trilhaId ?? "").trim()
  if (!GUID_REGEX.test(trilhaId)) {
    throw new HttpError(400, "trilhaId invalido")
  }

  const report = await getTrilhaTrainingStatusReport(trilhaId)
  if (!report) {
    throw new HttpError(404, "Trilha nao encontrada")
  }

  res.json({ report })
})
