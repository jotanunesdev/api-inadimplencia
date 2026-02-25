import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import { normalizeCpf } from "../utils/normalizeCpf"
import {
  createVideo,
  deleteVideo,
  getVideoById,
  listVideos,
  setVideoOrder,
  updateVideo,
} from "../models/videoModel"
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
import { getVideoDurationSeconds } from "../utils/videoDuration"

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
  const videos = await listVideos(trilhaId, normalizedCpf)
  res.json({ videos })
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const { versao } = req.query as { versao?: string }
  const parsedVersion =
    versao !== undefined && versao !== "" ? Number(versao) : undefined
  if (parsedVersion !== undefined && Number.isNaN(parsedVersion)) {
    throw new HttpError(400, "versao deve ser um numero")
  }

  const video = await getVideoById(req.params.id, parsedVersion)
  if (!video) {
    throw new HttpError(404, "Video nao encontrado")
  }
  res.json({ video })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { id, trilhaId, pathVideo, duracaoSegundos, ordem, procedimentoId, normaId } = req.body as {
    id?: string
    trilhaId?: string
    pathVideo?: string
    duracaoSegundos?: number
    ordem?: number
    procedimentoId?: string
    normaId?: string
  }

  if (!id || !trilhaId || !pathVideo) {
    throw new HttpError(400, "ID, trilhaId e pathVideo sao obrigatorios")
  }

  const duration =
    duracaoSegundos !== undefined ? Number(duracaoSegundos) : undefined
  if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
    throw new HttpError(400, "duracaoSegundos invalida")
  }
  const order = ordem !== undefined ? Number(ordem) : undefined
  if (order !== undefined && (!Number.isFinite(order) || order <= 0)) {
    throw new HttpError(400, "ordem invalida")
  }
  const procedimento = parseOptionalProcedimentoId(procedimentoId)
  const norma = parseOptionalNormaId(normaId)

  const video = await createVideo({
    id,
    trilhaId,
    pathVideo,
    procedimentoId: procedimento,
    normaId: norma,
    duracaoSegundos: duration,
    ordem: order,
  })

  res.status(201).json({ video })
})

export const createUpload = asyncHandler(async (req: Request, res: Response) => {
  const { id, trilhaId, duracaoSegundos, ordem, procedimentoId, normaId } = req.body as {
    id?: string
    trilhaId?: string
    duracaoSegundos?: number
    ordem?: number
    procedimentoId?: string
    normaId?: string
  }
  const file = req.file

  if (!id || !trilhaId) {
    throw new HttpError(400, "ID e trilhaId sao obrigatorios")
  }

  if (!file) {
    throw new HttpError(400, "Arquivo de video e obrigatorio")
  }

  const { trilhaPath } = await resolveTrilhaPath(trilhaId)
  const fileName = buildStoredFileName(file.originalname, "video")
  const relativePath = [trilhaPath, fileName].filter(Boolean).join("/")
  const destPath = toFsPath(relativePath)

  await moveFile(file.path, destPath)

  let duration =
    duracaoSegundos !== undefined ? Number(duracaoSegundos) : undefined
  if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
    throw new HttpError(400, "duracaoSegundos invalida")
  }

  const order = ordem !== undefined ? Number(ordem) : undefined
  if (order !== undefined && (!Number.isFinite(order) || order <= 0)) {
    throw new HttpError(400, "ordem invalida")
  }
  const procedimento = parseOptionalProcedimentoId(procedimentoId)
  const norma = parseOptionalNormaId(normaId)

  if (duration === undefined) {
    const probed = await getVideoDurationSeconds(destPath)
    if (probed === null) {
      throw new HttpError(
        422,
        "Nao foi possivel identificar a duracao do video",
      )
    }
    duration = probed
  }

  const video = await createVideo({
    id,
    trilhaId,
    pathVideo: relativePath,
    procedimentoId: procedimento,
    normaId: norma,
    duracaoSegundos: duration,
    ordem: order,
  })

  res.status(201).json({ video })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId, pathVideo, duracaoSegundos, ordem, procedimentoId, normaId } = req.body as {
    trilhaId?: string
    pathVideo?: string
    duracaoSegundos?: number
    ordem?: number
    procedimentoId?: string
    normaId?: string
  }

  if (
    !pathVideo &&
    duracaoSegundos === undefined &&
    ordem === undefined &&
    procedimentoId === undefined &&
    normaId === undefined
  ) {
    throw new HttpError(
      400,
      "pathVideo, duracaoSegundos, ordem, procedimentoId ou normaId e obrigatorio",
    )
  }

  const duration =
    duracaoSegundos !== undefined ? Number(duracaoSegundos) : undefined
  if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
    throw new HttpError(400, "duracaoSegundos invalida")
  }
  const order = ordem !== undefined ? Number(ordem) : undefined
  if (order !== undefined && (!Number.isFinite(order) || order <= 0)) {
    throw new HttpError(400, "ordem invalida")
  }
  const procedimento = parseOptionalProcedimentoId(procedimentoId)
  const norma = parseOptionalNormaId(normaId)

  const video = await updateVideo(req.params.id, {
    trilhaId,
    pathVideo,
    procedimentoId: procedimento,
    normaId: norma,
    duracaoSegundos: duration,
    ordem: order,
  })

  if (!video) {
    throw new HttpError(404, "Video nao encontrado")
  }

  res.json({ video })
})

export const updateUpload = asyncHandler(async (req: Request, res: Response) => {
  const { trilhaId, duracaoSegundos, procedimentoId, normaId } = req.body as {
    trilhaId?: string
    duracaoSegundos?: number
    procedimentoId?: string
    normaId?: string
  }
  const file = req.file

  if (!file) {
    throw new HttpError(400, "Arquivo de video e obrigatorio")
  }

  const resolvedTrilhaId =
    trilhaId ?? (await getVideoById(req.params.id))?.TRILHA_FK_ID
  if (!resolvedTrilhaId) {
    throw new HttpError(400, "trilhaId e obrigatorio")
  }

  const { trilhaPath } = await resolveTrilhaPath(resolvedTrilhaId)
  const fileName = buildStoredFileName(file.originalname, "video")
  const relativePath = [trilhaPath, fileName].filter(Boolean).join("/")
  const destPath = toFsPath(relativePath)

  await moveFile(file.path, destPath)

  let duration =
    duracaoSegundos !== undefined ? Number(duracaoSegundos) : undefined
  if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
    throw new HttpError(400, "duracaoSegundos invalida")
  }

  if (duration === undefined) {
    const probed = await getVideoDurationSeconds(destPath)
    if (probed === null) {
      throw new HttpError(
        422,
        "Nao foi possivel identificar a duracao do video",
      )
    }
    duration = probed
  }
  const procedimento = parseOptionalProcedimentoId(procedimentoId)
  const norma = parseOptionalNormaId(normaId)

  const video = await updateVideo(req.params.id, {
    trilhaId: resolvedTrilhaId,
    pathVideo: relativePath,
    procedimentoId: procedimento,
    normaId: norma,
    duracaoSegundos: duration,
  })

  if (!video) {
    throw new HttpError(404, "Video nao encontrado")
  }

  res.json({ video })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteVideo(req.params.id)
  res.status(204).send()
})

export const updateOrder = asyncHandler(async (req: Request, res: Response) => {
  const { ordem } = req.body as { ordem?: number }
  const order = Number(ordem)

  if (!Number.isFinite(order) || order <= 0) {
    throw new HttpError(400, "ordem invalida")
  }

  const video = await setVideoOrder(req.params.id, order)
  if (!video) {
    throw new HttpError(404, "Video nao encontrado")
  }

  res.json({ video })
})
