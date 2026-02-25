import fs from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  createNorma,
  deleteNorma,
  getNormaById,
  listNormaVersionsById,
  listNormas,
  updateNorma,
} from "../models/normaModel"
import { archiveTrainingsByNormaId } from "../models/userTrainingModel"
import {
  buildNormaRelativePath,
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

type NormaValidity = {
  validadeMeses: number
  validadeAnos: number
}

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

function parseOptionalValidityPart(raw: unknown, min: number, max: number, field: string) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return undefined
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || !Number.isInteger(parsed)) {
    throw new HttpError(400, `${field} invalido`)
  }

  return parsed
}

function parseNormaValidity(
  rawMeses: unknown,
  rawAnos: unknown,
  fallback?: NormaValidity,
) {
  const parsedMeses = parseOptionalValidityPart(
    rawMeses,
    0,
    11,
    "validadeMeses",
  )
  const parsedAnos = parseOptionalValidityPart(rawAnos, 0, 5, "validadeAnos")

  const validadeMeses = parsedMeses ?? fallback?.validadeMeses ?? 0
  const validadeAnos = parsedAnos ?? fallback?.validadeAnos ?? 0

  if (validadeMeses <= 0 && validadeAnos <= 0) {
    throw new HttpError(
      400,
      "Informe a validade da norma: meses (1-11), anos (1-5) ou ambos",
    )
  }

  return { validadeMeses, validadeAnos }
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

async function resolveNormaFolder() {
  const folder = buildNormaRelativePath()
  if (isSharePointEnabled()) {
    await ensureSharePointFolder(folder)
  } else {
    await ensurePublicDir(folder)
  }
  return folder
}

function buildNormaFileName(nome: string, originalName: string, versao: number) {
  const ext = path.extname(originalName || "").toLowerCase() || ".pdf"
  const base = sanitizeSegment(nome).replace(/\s+/g, "-").toLowerCase() || "norma"
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
  const normas = await listNormas()
  res.json({ normas })
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const versao = parseOptionalVersion((req.query as { versao?: string }).versao)
  const norma = await getNormaById(req.params.id, versao)
  if (!norma) {
    throw new HttpError(404, "Norma nao encontrada")
  }
  res.json({ norma })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { id, nome, pathPdf, versao, validadeMeses, validadeAnos, observacoes } = req.body as {
    id?: string
    nome?: string
    pathPdf?: string
    versao?: number
    validadeMeses?: number
    validadeAnos?: number
    observacoes?: string
  }

  const trimmedName = nome?.trim()
  const trimmedPath = pathPdf?.trim()
  if (!trimmedName || !trimmedPath) {
    throw new HttpError(400, "nome e pathPdf sao obrigatorios")
  }
  const validade = parseNormaValidity(validadeMeses, validadeAnos)

  const created = await createNorma({
    id: id?.trim() || randomUUID(),
    nome: trimmedName,
    pathPdf: trimmedPath,
    observacoes: parseOptionalObservacoes(observacoes),
    versao: parseOptionalVersion(versao),
    validadeMeses: validade.validadeMeses,
    validadeAnos: validade.validadeAnos,
    alteradoEm: new Date(),
  })

  res.status(201).json({ norma: created })
})

export const createUpload = asyncHandler(async (req: Request, res: Response) => {
  const { id, nome, versao, validadeMeses, validadeAnos, observacoes } = req.body as {
    id?: string
    nome?: string
    versao?: number
    validadeMeses?: number
    validadeAnos?: number
    observacoes?: string
  }

  const trimmedName = nome?.trim()
  if (!trimmedName) {
    throw new HttpError(400, "nome e obrigatorio")
  }

  const parsedVersion = parseOptionalVersion(versao) ?? 1
  const validade = parseNormaValidity(validadeMeses, validadeAnos)
  const file = validatePdfFile(req.file)
  const folder = await resolveNormaFolder()
  const fileName = buildNormaFileName(trimmedName, file.originalname, parsedVersion)
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

  const created = await createNorma({
    id: id?.trim() || randomUUID(),
    nome: trimmedName,
    pathPdf: storedPath,
    observacoes: parseOptionalObservacoes(observacoes),
    versao: parsedVersion,
    validadeMeses: validade.validadeMeses,
    validadeAnos: validade.validadeAnos,
    alteradoEm: new Date(),
  })

  res.status(201).json({ norma: created })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { nome, pathPdf, versao, validadeMeses, validadeAnos, observacoes } = req.body as {
    nome?: string
    pathPdf?: string
    versao?: number
    validadeMeses?: number
    validadeAnos?: number
    observacoes?: string
  }

  if (
    nome === undefined &&
    pathPdf === undefined &&
    versao === undefined &&
    observacoes === undefined &&
    validadeMeses === undefined &&
    validadeAnos === undefined
  ) {
    throw new HttpError(400, "Informe ao menos um campo para atualizar")
  }

  const latest = await getNormaById(req.params.id)
  if (!latest) {
    throw new HttpError(404, "Norma nao encontrada")
  }

  const validade = parseNormaValidity(validadeMeses, validadeAnos, {
    validadeMeses: latest.VALIDADE_MESES ?? 0,
    validadeAnos: latest.VALIDADE_ANOS ?? 0,
  })

  const norma = await updateNorma(req.params.id, {
    nome: nome?.trim() || undefined,
    pathPdf: pathPdf?.trim() || undefined,
    observacoes: parseOptionalObservacoes(observacoes),
    versao: parseOptionalVersion(versao),
    validadeMeses: validade.validadeMeses,
    validadeAnos: validade.validadeAnos,
    alteradoEm: new Date(),
  })

  if (!norma) {
    throw new HttpError(404, "Norma nao encontrada")
  }

  await archiveTrainingsByNormaId(req.params.id)
  res.json({ norma })
})

export const updateUpload = asyncHandler(async (req: Request, res: Response) => {
  const latest = await getNormaById(req.params.id)
  if (!latest) {
    throw new HttpError(404, "Norma nao encontrada")
  }

  const { nome, versao, validadeMeses, validadeAnos, observacoes } = req.body as {
    nome?: string
    versao?: number
    validadeMeses?: number
    validadeAnos?: number
    observacoes?: string
  }
  const file = validatePdfFile(req.file)
  const parsedVersion = parseOptionalVersion(versao)
  const nextVersion =
    parsedVersion !== undefined
      ? Math.max(parsedVersion, (latest.VERSAO ?? 0) + 1)
      : (latest.VERSAO ?? 0) + 1
  const nextName = nome?.trim() || latest.NOME
  const validade = parseNormaValidity(validadeMeses, validadeAnos, {
    validadeMeses: latest.VALIDADE_MESES ?? 0,
    validadeAnos: latest.VALIDADE_ANOS ?? 0,
  })
  const folder = await resolveNormaFolder()
  const fileName = buildNormaFileName(nextName, file.originalname, nextVersion)
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

  const norma = await updateNorma(req.params.id, {
    nome: nextName,
    pathPdf: storedPath,
    observacoes: parseOptionalObservacoes(observacoes),
    versao: nextVersion,
    validadeMeses: validade.validadeMeses,
    validadeAnos: validade.validadeAnos,
    alteradoEm: new Date(),
  })

  if (!norma) {
    throw new HttpError(404, "Norma nao encontrada")
  }

  await archiveTrainingsByNormaId(req.params.id)
  res.json({ norma })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const versions = await listNormaVersionsById(req.params.id)
  await deleteNorma(req.params.id)

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
