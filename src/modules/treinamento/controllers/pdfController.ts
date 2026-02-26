import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import { normalizeCpf } from "../utils/normalizeCpf"
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
  toFsPath,
} from "../utils/storage"

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

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId, cpf } = req.query as { trilhaId?: string; cpf?: string }
  const normalizedCpf = cpf ? normalizeCpf(cpf) : undefined
  const pdfs = await listPdfs(trilhaId, normalizedCpf)
  res.json({ pdfs })
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const { versao } = req.query as { versao?: string }
  const parsedVersion =
    versao !== undefined && versao !== "" ? Number(versao) : undefined
  if (parsedVersion !== undefined && Number.isNaN(parsedVersion)) {
    throw new HttpError(400, "versao deve ser um numero")
  }

  const pdf = await getPdfById(req.params.id, parsedVersion)
  if (!pdf) {
    throw new HttpError(404, "PDF nao encontrado")
  }
  res.json({ pdf })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { id, trilhaId, pdfPath, procedimentoId, normaId } = req.body as {
    id?: string
    trilhaId?: string
    pdfPath?: string
    procedimentoId?: string
    normaId?: string
  }

  if (!id || !trilhaId || !pdfPath) {
    throw new HttpError(400, "ID, trilhaId e pdfPath sao obrigatorios")
  }

  const procedimento = parseOptionalProcedimentoId(procedimentoId)
  const norma = parseOptionalNormaId(normaId)

  const pdf = await createPdf({
    id,
    trilhaId,
    pdfPath,
    procedimentoId: procedimento,
    normaId: norma,
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
  })

  res.status(201).json({ pdf })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId, pdfPath, procedimentoId, normaId } = req.body as {
    trilhaId?: string
    pdfPath?: string
    procedimentoId?: string
    normaId?: string
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

  const pdf = await updatePdf(req.params.id, {
    trilhaId,
    pdfPath,
    procedimentoId: procedimento,
    normaId: norma,
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
