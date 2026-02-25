import fs from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  createProcedimento,
  deleteProcedimento,
  getProcedimentoById,
  listProcedimentoVersionsById,
  listProcedimentos,
  updateProcedimento,
} from "../models/procedimentoModel"
import { archiveTrainingsByProcedimentoId } from "../models/userTrainingModel"
import {
  buildProcedureRelativePath,
  ensurePublicDir,
  moveFile,
  sanitizeSegment,
  toFsPath,
} from "../utils/storage"
import {
  deleteSharePointFileByUrl,
  ensureSharePointFolder,
  isSharePointEnabled,
  uploadFileToSharePoint,
} from "../services/sharePointService"

function parseOptionalVersion(raw: unknown) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return undefined
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new HttpError(400, "versao invalida")
  }

  return Math.trunc(parsed)
}

function parseOptionalObservacoes(raw: unknown) {
  if (raw === undefined || raw === null) {
    return undefined
  }

  const normalized = String(raw).trim()
  return normalized ? normalized : null
}

function validatePdfFile(file: Express.Multer.File | undefined) {
  if (!file) {
    throw new HttpError(400, "Arquivo PDF e obrigatorio")
  }

  const extension = path.extname(file.originalname || "").toLowerCase()
  if (extension !== ".pdf") {
    throw new HttpError(400, "Apenas arquivos .pdf sao permitidos")
  }

  return file
}

async function resolveProcedureFolder() {
  const folder = buildProcedureRelativePath()
  if (isSharePointEnabled()) {
    await ensureSharePointFolder(folder)
  } else {
    await ensurePublicDir(folder)
  }
  return folder
}

function buildProcedureFileName(nome: string, originalName: string, versao: number) {
  const ext = path.extname(originalName || "").toLowerCase() || ".pdf"
  const base = sanitizeSegment(nome).replace(/\s+/g, "-").toLowerCase() || "procedimento"
  return `${base}-v${versao}${ext}`
}

async function removeLocalFileIfExists(storedPath: string | null) {
  if (!storedPath || storedPath.startsWith("http")) {
    return
  }

  const fsPath = toFsPath(storedPath)
  await fs.unlink(fsPath).catch((error) => {
    const err = error as NodeJS.ErrnoException
    if (err.code !== "ENOENT") {
      throw err
    }
  })
}

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const procedimentos = await listProcedimentos()
  res.json({ procedimentos })
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const versao = parseOptionalVersion((req.query as { versao?: string }).versao)
  const procedimento = await getProcedimentoById(req.params.id, versao)
  if (!procedimento) {
    throw new HttpError(404, "Procedimento nao encontrado")
  }
  res.json({ procedimento })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { id, nome, pathPdf, versao, observacoes } = req.body as {
    id?: string
    nome?: string
    pathPdf?: string
    versao?: number
    observacoes?: string
  }

  const trimmedName = nome?.trim()
  const trimmedPath = pathPdf?.trim()
  if (!trimmedName || !trimmedPath) {
    throw new HttpError(400, "nome e pathPdf sao obrigatorios")
  }

  const created = await createProcedimento({
    id: id?.trim() || randomUUID(),
    nome: trimmedName,
    pathPdf: trimmedPath,
    observacoes: parseOptionalObservacoes(observacoes),
    versao: parseOptionalVersion(versao),
    alteradoEm: new Date(),
  })

  res.status(201).json({ procedimento: created })
})

export const createUpload = asyncHandler(async (req: Request, res: Response) => {
  const { id, nome, versao, observacoes } = req.body as {
    id?: string
    nome?: string
    versao?: number
    observacoes?: string
  }

  const trimmedName = nome?.trim()
  if (!trimmedName) {
    throw new HttpError(400, "nome e obrigatorio")
  }

  const parsedVersion = parseOptionalVersion(versao) ?? 1
  const file = validatePdfFile(req.file)
  const folder = await resolveProcedureFolder()
  const fileName = buildProcedureFileName(trimmedName, file.originalname, parsedVersion)
  let storedPath = ""

  if (isSharePointEnabled()) {
    const uploaded = await uploadFileToSharePoint({
      tempFilePath: file.path,
      relativeFolderPath: folder,
      fileName,
      contentType: file.mimetype,
    })
    storedPath = uploaded.webUrl
  } else {
    const relativePath = [folder, fileName].filter(Boolean).join("/")
    const destPath = toFsPath(relativePath)
    await moveFile(file.path, destPath)
    storedPath = relativePath
  }

  const created = await createProcedimento({
    id: id?.trim() || randomUUID(),
    nome: trimmedName,
    pathPdf: storedPath,
    observacoes: parseOptionalObservacoes(observacoes),
    versao: parsedVersion,
    alteradoEm: new Date(),
  })

  res.status(201).json({ procedimento: created })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { nome, pathPdf, versao, observacoes } = req.body as {
    nome?: string
    pathPdf?: string
    versao?: number
    observacoes?: string
  }

  if (
    nome === undefined &&
    pathPdf === undefined &&
    versao === undefined &&
    observacoes === undefined
  ) {
    throw new HttpError(400, "Informe ao menos um campo para atualizar")
  }

  const procedimento = await updateProcedimento(req.params.id, {
    nome: nome?.trim() || undefined,
    pathPdf: pathPdf?.trim() || undefined,
    observacoes: parseOptionalObservacoes(observacoes),
    versao: parseOptionalVersion(versao),
    alteradoEm: new Date(),
  })

  if (!procedimento) {
    throw new HttpError(404, "Procedimento nao encontrado")
  }

  await archiveTrainingsByProcedimentoId(req.params.id)
  res.json({ procedimento })
})

export const updateUpload = asyncHandler(async (req: Request, res: Response) => {
  const latest = await getProcedimentoById(req.params.id)
  if (!latest) {
    throw new HttpError(404, "Procedimento nao encontrado")
  }

  const { nome, versao } = req.body as {
    nome?: string
    versao?: number
    observacoes?: string
  }
  const file = validatePdfFile(req.file)
  const parsedVersion = parseOptionalVersion(versao)
  const nextVersion =
    parsedVersion !== undefined
      ? Math.max(parsedVersion, (latest.VERSAO ?? 0) + 1)
      : (latest.VERSAO ?? 0) + 1
  const nextName = nome?.trim() || latest.NOME
  const folder = await resolveProcedureFolder()
  const fileName = buildProcedureFileName(nextName, file.originalname, nextVersion)
  let storedPath = ""

  if (isSharePointEnabled()) {
    const uploaded = await uploadFileToSharePoint({
      tempFilePath: file.path,
      relativeFolderPath: folder,
      fileName,
      contentType: file.mimetype,
    })
    storedPath = uploaded.webUrl
  } else {
    const relativePath = [folder, fileName].filter(Boolean).join("/")
    const destPath = toFsPath(relativePath)
    await moveFile(file.path, destPath)
    storedPath = relativePath
  }

  const procedimento = await updateProcedimento(req.params.id, {
    nome: nextName,
    pathPdf: storedPath,
    observacoes: parseOptionalObservacoes(req.body?.observacoes),
    versao: nextVersion,
    alteradoEm: new Date(),
  })

  if (!procedimento) {
    throw new HttpError(404, "Procedimento nao encontrado")
  }

  await archiveTrainingsByProcedimentoId(req.params.id)
  res.json({ procedimento })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const versions = await listProcedimentoVersionsById(req.params.id)
  await deleteProcedimento(req.params.id)

  for (const version of versions) {
    if (!version.PATH_PDF) continue
    if (isSharePointEnabled()) {
      // eslint-disable-next-line no-await-in-loop
      await deleteSharePointFileByUrl(version.PATH_PDF).catch(() => undefined)
    } else {
      // eslint-disable-next-line no-await-in-loop
      await removeLocalFileIfExists(version.PATH_PDF).catch(() => undefined)
    }
  }

  res.status(204).send()
})
