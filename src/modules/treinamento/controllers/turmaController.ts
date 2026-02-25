import fs from "fs/promises"
import path from "path"
import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import { normalizeCpf } from "../utils/normalizeCpf"
import { mapReadViewToUser } from "../utils/userMapping"
import { upsertUser } from "../models/userModel"
import { buildStoredFileName, ensurePublicDir, moveFile, toFsPath } from "../utils/storage"
import {
  ensureSharePointFolder,
  isSharePointEnabled,
  uploadFileToSharePoint,
} from "../services/sharePointService"
import { buildCollectiveTrainingSharePointFolder } from "../utils/collectiveTrainingStorage"
import {
  createTurma,
  getTurmaById,
  listTurmaParticipants,
  listTurmas,
  saveTurmaEncerramentoEvidencias,
} from "../models/turmaModel"

type RawUserInput = Record<string, unknown>
const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function toRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const record: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as RawUserInput)) {
    if (raw === null || raw === undefined) continue
    const str = String(raw).trim()
    if (!str) continue
    record[key] = str
  }

  return record
}

function buildPfunc(user: RawUserInput) {
  const raw = toRecord(user.readView ?? user.raw ?? user.pfunc)
  if (raw) {
    return raw
  }

  const record: Record<string, string> = {}
  const set = (key: string, value: unknown) => {
    if (value === null || value === undefined) return
    const str = String(value).trim()
    if (!str) return
    record[key] = str
  }

  set("CPF", user.cpf ?? user.CPF)
  set("NOME", user.nome ?? user.NOME)
  set("NOME_FUNCAO", user.cargo ?? user.NOME_FUNCAO)
  set("NOME_SECAO", user.setor ?? user.NOME_SECAO ?? user.NOMEDEPARTAMENTO)
  set("NOMEDEPARTAMENTO", user.NOMEDEPARTAMENTO)
  set("NOMEFILIAL", user.nomeFilial ?? user.NOMEFILIAL)

  return record
}

export const createCollectiveTurma = asyncHandler(async (req: Request, res: Response) => {
  const { nome, users, criadoPor, iniciadoEm } = req.body as {
    nome?: string
    users?: RawUserInput[]
    criadoPor?: string
    iniciadoEm?: string
  }

  if (!Array.isArray(users) || users.length === 0) {
    throw new HttpError(400, "users e obrigatorio")
  }

  const uniqueUsers = new Map<string, Record<string, string>>()
  for (const user of users) {
    const raw = buildPfunc(user)
    const cpfDigits = normalizeCpf(raw.CPF ?? "")
    if (cpfDigits.length !== 11) {
      continue
    }

    raw.CPF = cpfDigits
    uniqueUsers.set(cpfDigits, raw)
  }

  if (uniqueUsers.size === 0) {
    throw new HttpError(400, "Nenhum colaborador valido informado")
  }

  for (const raw of uniqueUsers.values()) {
    const mapped = mapReadViewToUser(raw)
    // eslint-disable-next-line no-await-in-loop
    await upsertUser(mapped)
  }

  const startedAt = iniciadoEm ? new Date(iniciadoEm) : new Date()
  if (Number.isNaN(startedAt.getTime())) {
    throw new HttpError(400, "iniciadoEm invalido")
  }

  const fallbackName = `Turma coletiva ${startedAt.toLocaleString("pt-BR")}`
  const turma = await createTurma({
    nome: nome?.trim() || fallbackName,
    criadoPor: criadoPor?.trim() || null,
    iniciadoEm: startedAt,
    participantesCpf: Array.from(uniqueUsers.keys()),
  })

  res.status(201).json({ turma })
})

export const listCollectiveTurmas = asyncHandler(async (req: Request, res: Response) => {
  const { search } = req.query as { search?: string }
  const turmas = await listTurmas(search?.trim() || undefined)
  res.json({ turmas })
})

export const getCollectiveTurmaById = asyncHandler(async (req: Request, res: Response) => {
  const { turmaId } = req.params
  if (!GUID_REGEX.test(turmaId)) {
    throw new HttpError(400, "turmaId invalido")
  }

  const turma = await getTurmaById(turmaId)
  if (!turma) {
    throw new HttpError(404, "Turma nao encontrada")
  }

  const participantes = await listTurmaParticipants(turmaId)
  res.json({ turma, participantes })
})

export const saveCollectiveTurmaEvidencias = asyncHandler(async (req: Request, res: Response) => {
  const { turmaId } = req.params
  if (!GUID_REGEX.test(turmaId)) {
    throw new HttpError(400, "turmaId invalido")
  }

  const turma = await getTurmaById(turmaId)
  if (!turma) {
    throw new HttpError(404, "Turma nao encontrada")
  }

  const { duracaoHoras, duracaoMinutos, finalizadoEm, criadoPor } = req.body as {
    duracaoHoras?: string | number
    duracaoMinutos?: string | number
    finalizadoEm?: string
    criadoPor?: string
    obraLocal?: string
  }

  const horas = Number(duracaoHoras)
  const minutos = Number(duracaoMinutos)
  if (!Number.isInteger(horas) || horas < 0 || horas > 24) {
    throw new HttpError(400, "duracaoHoras invalido")
  }
  if (![0, 15, 30, 45].includes(minutos)) {
    throw new HttpError(400, "duracaoMinutos invalido")
  }

  const duracaoTotalMinutos = horas * 60 + minutos
  if (duracaoTotalMinutos <= 0) {
    throw new HttpError(400, "Informe a duracao do treinamento")
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  if (!files.length) {
    throw new HttpError(400, "Envie ao menos uma foto de evidencia do treinamento")
  }

  const finalizedAt = finalizadoEm ? new Date(finalizadoEm) : new Date()
  if (Number.isNaN(finalizedAt.getTime())) {
    throw new HttpError(400, "finalizadoEm invalido")
  }

  const obraLocalRaw =
    typeof req.body?.obraLocal === "string" && req.body.obraLocal.trim()
      ? req.body.obraLocal.trim()
      : "Matriz"
  const collectiveSpFolder = buildCollectiveTrainingSharePointFolder({
    obraLocal: obraLocalRaw,
    turma,
  })

  const movedPaths: string[] = []
  try {
    const evidencias = []
    const useSharePoint = isSharePointEnabled()

    if (!useSharePoint) {
      const relativeFolder = `turmas/${turmaId}/evidencias`
      await ensurePublicDir(relativeFolder)
    } else {
      await ensureSharePointFolder(collectiveSpFolder)
    }

    for (const file of files) {
      if (!file.mimetype?.startsWith("image/")) {
        throw new HttpError(400, "Todas as evidencias devem ser imagens")
      }
      const storedName = buildStoredFileName(file.originalname || "evidencia.jpg", "evidencia")

      if (useSharePoint) {
        // eslint-disable-next-line no-await-in-loop
        const uploaded = await uploadFileToSharePoint({
          tempFilePath: file.path,
          relativeFolderPath: collectiveSpFolder,
          fileName: storedName,
          contentType: file.mimetype,
        })
        const arquivoPath = uploaded.webUrl ?? uploaded.fullPath
        movedPaths.push(arquivoPath)
        evidencias.push({ arquivoPath })
      } else {
        const relativeFolder = `turmas/${turmaId}/evidencias`
        const relativePath = `${relativeFolder}/${storedName}`.replace(/\\/g, "/")
        const destPath = toFsPath(relativePath)
        // eslint-disable-next-line no-await-in-loop
        await moveFile(file.path, destPath)
        movedPaths.push(relativePath)
        evidencias.push({ arquivoPath: relativePath })
      }
    }

    const updatedTurma = await saveTurmaEncerramentoEvidencias({
      turmaId,
      duracaoTreinamentoMinutos: duracaoTotalMinutos,
      finalizadoEm: finalizedAt,
      criadoPor: criadoPor?.trim() || null,
      evidencias,
    })

    res.status(200).json({
      turma: updatedTurma,
      evidencias: movedPaths.map((arquivoPath, index) => ({
        arquivoPath,
        ordem: index + 1,
      })),
    })
  } catch (error) {
    if (!isSharePointEnabled()) {
      await Promise.allSettled(
        movedPaths.map((relativePath) => fs.unlink(path.normalize(toFsPath(relativePath)))),
      )
    }

    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : ""
    if (code === "TURMA_EVIDENCIA_SCHEMA_MISSING") {
      throw new HttpError(
        400,
        "Banco sem suporte a evidencias de treinamento coletivo. Execute a migration de turma/evidencias.",
      )
    }
    if (error instanceof HttpError) throw error
    throw error
  } finally {
    await Promise.allSettled(
      files.map((file) => fs.unlink(file.path).catch(() => undefined)),
    )
  }
})
