import fs from "fs/promises"
import type { Request, Response } from "express"
import { env } from "../config/env"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import { normalizeCpf } from "../utils/normalizeCpf"
import { calculateReadingTimeSeconds } from "../utils/readingTimeUtils"
import {
  createPdf,
  deletePdf,
  getPdfById,
  listPdfs,
  updatePdf,
} from "../models/pdfModel"
import { getTrilhaById, updateTrilha } from "../models/trilhaModel"
import { getModuleById } from "../models/moduleModel"
import {
  buildModuleRelativePath,
  buildStoredFileName,
  buildTrilhaRelativePath,
  ensurePublicDir,
  moveFile,
  sanitizeSegment,
  toFsPath,
} from "../utils/storage"
import {
  downloadSharePointFileContentByItemId,
  downloadSharePointFileByUrl,
  listSharePointFolderChildren,
  listSharePointFolderChildrenByItemId,
  type SharePointDriveItem,
} from "../services/sharePointService"

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function parseOptionalProcedimentoId(raw: unknown) {
  if (raw === undefined || raw === null) {
    return undefined
  }

  const value = String(raw).trim()
  if (!value) {
    return null
  }

  if (!GUID_REGEX.test(value)) {
    throw new HttpError(400, "procedimentoId invalido")
  }

  return value
}

function parseOptionalNormaId(raw: unknown) {
  if (raw === undefined || raw === null) {
    return undefined
  }

  const value = String(raw).trim()
  if (!value) {
    return null
  }

  if (!GUID_REGEX.test(value)) {
    throw new HttpError(400, "normaId invalido")
  }

  return value
}

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

function parseOptionalVersion(raw: unknown) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return undefined
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, "versao deve ser um numero")
  }

  return parsed
}

function normalizeSharePointSearchToken(value: string) {
  const normalized = String(value ?? "").trim()
  if (!normalized) {
    return ""
  }

  const repaired = (() => {
    try {
      const latin1 = Buffer.from(normalized, "latin1").toString("utf8")
      return latin1.includes("�") ? normalized : latin1
    } catch {
      return normalized
    }
  })()

  return repaired
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(\d+\)(?=\.[^.]+$)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function isSharePointItemNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "")
  return message.includes("itemNotFound") || message.includes("(404)")
}

function splitSharePointRelativeSegments(fileUrl: string) {
  const parsedUrl = new URL(fileUrl)
  const pathnameSegments = decodeURIComponent(parsedUrl.pathname)
    .split("/")
    .filter(Boolean)

  const libraryIndex = pathnameSegments.findIndex(
    (segment) =>
      normalizeSharePointSearchToken(segment) ===
      normalizeSharePointSearchToken(env.SHAREPOINT_LIBRARY_NAME),
  )

  if (libraryIndex < 0) {
    return []
  }

  const relativeSegments = pathnameSegments.slice(libraryIndex + 1)
  if (
    relativeSegments.length > 0 &&
    normalizeSharePointSearchToken(relativeSegments[0]) ===
      normalizeSharePointSearchToken(env.SHAREPOINT_ROOT_FOLDER)
  ) {
    return relativeSegments.slice(1)
  }

  return relativeSegments
}

function findMatchingSharePointFile(
  items: SharePointDriveItem[],
  targetFileName: string,
) {
  const normalizedTarget = normalizeSharePointSearchToken(targetFileName)
  return items.find(
    (item) =>
      Boolean(item.file) &&
      normalizeSharePointSearchToken(item.name) === normalizedTarget,
  )
}

async function findSharePointFileByNameFallback(
  fileUrl: string,
) {
  const relativeSegments = splitSharePointRelativeSegments(fileUrl)
  const targetFileName = relativeSegments.at(-1)
  const sectorFolder = relativeSegments[0]
  if (!targetFileName || !sectorFolder) {
    return null
  }

  const sectorChildren = await listSharePointFolderChildren(sectorFolder)
  const directFile = findMatchingSharePointFile(sectorChildren, targetFileName)
  if (directFile?.id) {
    return directFile
  }

  const folderQueue = sectorChildren
    .filter((item) => item.folder?.childCount && item.id)
    .map((item) => item.id)

  while (folderQueue.length > 0) {
    const folderId = folderQueue.shift()
    if (!folderId) {
      continue
    }

    // eslint-disable-next-line no-await-in-loop
    const folderChildren = await listSharePointFolderChildrenByItemId(folderId)
    const matchedFile = findMatchingSharePointFile(folderChildren, targetFileName)
    if (matchedFile?.id) {
      return matchedFile
    }

    folderChildren
      .filter((item) => item.folder?.childCount && item.id)
      .forEach((item) => {
        folderQueue.push(item.id)
      })
  }

  return null
}

async function downloadSharePointPdfWithFallback(fileUrl: string) {
  try {
    return await downloadSharePointFileByUrl(fileUrl)
  } catch (error) {
    if (!isSharePointItemNotFoundError(error)) {
      throw error
    }

    const matchedFile = await findSharePointFileByNameFallback(fileUrl)
    if (!matchedFile?.id) {
      throw new HttpError(404, "Arquivo PDF nao encontrado")
    }

    return downloadSharePointFileContentByItemId({ itemId: matchedFile.id })
  }
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId, cpf } = req.query as { trilhaId?: string; cpf?: string }
  const normalizedCpf = cpf ? normalizeCpf(cpf) : undefined
  const pdfs = await listPdfs(trilhaId, normalizedCpf)
  res.json({ pdfs })
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const parsedVersion = parseOptionalVersion((req.query as { versao?: string }).versao)
  const pdf = await getPdfById(req.params.id, parsedVersion)
  if (!pdf) {
    throw new HttpError(404, "PDF nao encontrado")
  }
  res.json({ pdf })
})

export const downloadContent = asyncHandler(async (req: Request, res: Response) => {
  const parsedVersion = parseOptionalVersion((req.query as { versao?: string }).versao)
  const pdf = await getPdfById(req.params.id, parsedVersion)
  if (!pdf) {
    throw new HttpError(404, "PDF nao encontrado")
  }

  const rawPath = pdf.PDF_PATH?.trim()
  if (!rawPath) {
    throw new HttpError(404, "Arquivo PDF nao encontrado")
  }

  let buffer: Buffer
  if (rawPath.startsWith("http")) {
    buffer = await downloadSharePointPdfWithFallback(rawPath)
  } else {
    const localPath = toFsPath(rawPath)
    try {
      buffer = await fs.readFile(localPath)
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code === "ENOENT") {
        throw new HttpError(404, "Arquivo PDF nao encontrado")
      }
      throw error
    }
  }

  const safeName = sanitizeSegment(
    pdf.PDF_PATH.split("/").pop() || `pdf-${pdf.ID}`,
  ).replace(/\s+/g, "-")
  const fileName = `${safeName || "pdf"}-v${pdf.VERSAO ?? 1}.pdf`
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`)
  res.send(buffer)
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { id, trilhaId, pdfPath, procedimentoId, normaId, ordem } = req.body as {
    id?: string
    trilhaId?: string
    pdfPath?: string
    procedimentoId?: string
    normaId?: string
    ordem?: number
  }

  if (!id || !trilhaId || !pdfPath) {
    throw new HttpError(400, "ID, trilhaId e pdfPath sao obrigatorios")
  }

  const procedimento = parseOptionalProcedimentoId(procedimentoId)
  const norma = parseOptionalNormaId(normaId)
  const order = ordem !== undefined ? Number(ordem) : undefined
  if (order !== undefined && (!Number.isFinite(order) || order <= 0)) {
    throw new HttpError(400, "ordem invalida")
  }

  const pdf = await createPdf({
    id,
    trilhaId,
    pdfPath,
    procedimentoId: procedimento,
    normaId: norma,
    ordem: order,
  })

  res.status(201).json({ pdf })
})

export const createUpload = asyncHandler(async (req: Request, res: Response) => {
  const { id, trilhaId, procedimentoId, normaId } = req.body as {
    id?: string
    trilhaId?: string
    procedimentoId?: string
    normaId?: string
  }
  const file = req.file

  if (!id || !trilhaId) {
    throw new HttpError(400, "ID e trilhaId sao obrigatorios")
  }

  if (!file) {
    throw new HttpError(400, "Arquivo de PDF e obrigatorio")
  }

  // Calcula o tempo de leitura antes de mover o arquivo (temp path ainda válido)
  const tempoLeituraSegundos = await calculateReadingTimeSeconds(
    file.path,
    file.originalname,
  ).catch(() => null)

  const { trilhaPath } = await resolveTrilhaPath(trilhaId)
  const fileName = buildStoredFileName(file.originalname, "pdf")
  const relativePath = [trilhaPath, fileName].filter(Boolean).join("/")
  const destPath = toFsPath(relativePath)

  await moveFile(file.path, destPath)

  const procedimento = parseOptionalProcedimentoId(procedimentoId)
  const norma = parseOptionalNormaId(normaId)

  const pdf = await createPdf({
    id,
    trilhaId,
    pdfPath: relativePath,
    procedimentoId: procedimento,
    normaId: norma,
    tempoLeituraSegundos,
  })

  res.status(201).json({ pdf })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId, pdfPath, procedimentoId, normaId, ordem } = req.body as {
    trilhaId?: string
    pdfPath?: string
    procedimentoId?: string
    normaId?: string
    ordem?: number
  }

  if (
    !pdfPath &&
    procedimentoId === undefined &&
    normaId === undefined &&
    trilhaId === undefined
  ) {
    throw new HttpError(400, "pdfPath, trilhaId, procedimentoId ou normaId e obrigatorio")
  }
  const procedimento = parseOptionalProcedimentoId(procedimentoId)
  const norma = parseOptionalNormaId(normaId)
  const order = ordem !== undefined ? Number(ordem) : undefined
  if (order !== undefined && (!Number.isFinite(order) || order <= 0)) {
    throw new HttpError(400, "ordem invalida")
  }

  const pdf = await updatePdf(req.params.id, {
    trilhaId,
    pdfPath,
    procedimentoId: procedimento,
    normaId: norma,
    ordem: order,
  })

  if (!pdf) {
    throw new HttpError(404, "PDF nao encontrado")
  }

  res.json({ pdf })
})

export const updateUpload = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId, procedimentoId, normaId } = req.body as {
    trilhaId?: string
    procedimentoId?: string
    normaId?: string
  }
  const file = req.file

  if (!file) {
    throw new HttpError(400, "Arquivo de PDF e obrigatorio")
  }

  // Calcula o tempo de leitura antes de mover o arquivo (temp path ainda válido)
  const tempoLeituraSegundos = await calculateReadingTimeSeconds(
    file.path,
    file.originalname,
  ).catch(() => null)

  const resolvedTrilhaId =
    trilhaId ?? (await getPdfById(req.params.id))?.TRILHA_FK_ID
  if (!resolvedTrilhaId) {
    throw new HttpError(400, "trilhaId e obrigatorio")
  }

  const { trilhaPath } = await resolveTrilhaPath(resolvedTrilhaId)
  const fileName = buildStoredFileName(file.originalname, "pdf")
  const relativePath = [trilhaPath, fileName].filter(Boolean).join("/")
  const destPath = toFsPath(relativePath)

  await moveFile(file.path, destPath)

  const procedimento = parseOptionalProcedimentoId(procedimentoId)
  const norma = parseOptionalNormaId(normaId)

  const pdf = await updatePdf(req.params.id, {
    trilhaId: resolvedTrilhaId,
    pdfPath: relativePath,
    procedimentoId: procedimento,
    normaId: norma,
    tempoLeituraSegundos,
  })

  if (!pdf) {
    throw new HttpError(404, "PDF nao encontrado")
  }

  res.json({ pdf })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  try {
    await deletePdf(req.params.id)
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
        "Nao e possivel excluir este PDF porque existem conclusoes, vinculos ou registros associados.",
      )
    }

    if (message) {
      throw new HttpError(400, message)
    }
    throw error
  }
  res.status(204).send()
})
