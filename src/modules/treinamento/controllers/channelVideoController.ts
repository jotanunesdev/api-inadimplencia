import type { Request, Response } from "express"
import fs from "fs/promises"
import path from "path"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  createChannelVideo,
  deleteChannelVideo,
  getChannelVideoById,
  listChannelVideoVersionsById,
  listChannelVideos,
  updateChannelVideo,
} from "../models/channelVideoModel"
import { syncTrilhaVideosFromChannelVersion } from "../models/videoModel"
import { getChannelById, updateChannel } from "../models/channelModel"
import {
  buildChannelRelativePath,
  ensurePublicDir,
  moveFile,
  sanitizeSegment,
  toFsPath,
} from "../utils/storage"
import { getVideoDurationSeconds } from "../utils/videoDuration"
import {
  createSharePointUploadSession,
  deleteSharePointFileByUrl,
  ensureSharePointFolder,
  getSharePointFileByPath,
  isSharePointEnabled,
  uploadFileToSharePoint,
} from "../services/sharePointService"

type PendingSharePointUpload = {
  mode: "create" | "update"
  videoId: string
  canalId: string
  tipoConteudo: "video" | "pdf"
  procedimentoId: string | null
  normaId: string | null
  fullPath: string
  previousPath: string | null
  duracaoSegundos: number | null
  createdAt: number
}

const pendingSharePointUploads = new Map<string, PendingSharePointUpload>()
const PENDING_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1)
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`
}

function parseOptionalDuration(raw: unknown) {
  if (raw === undefined || raw === null || raw === "") {
    return undefined
  }

  const duration = Number(raw)
  if (!Number.isFinite(duration) || duration < 0) {
    throw new HttpError(400, "duracaoSegundos invalida")
  }

  return duration
}

function parseTipoConteudo(raw: unknown) {
  const normalized = String(raw ?? "video").trim().toLowerCase()
  if (normalized === "video" || normalized === "pdf") {
    return normalized as "video" | "pdf"
  }
  throw new HttpError(400, "tipoConteudo invalido")
}

function parseOptionalUuid(raw: unknown) {
  if (raw === undefined || raw === null) {
    return undefined
  }
  const normalized = String(raw).trim()
  return normalized ? normalized : null
}

function parseRequiredUploadedContent(params: {
  file: Express.Multer.File | undefined
  tipoConteudo: "video" | "pdf"
}) {
  const { file, tipoConteudo } = params
  if (!file) {
    throw new HttpError(400, tipoConteudo === "pdf" ? "Arquivo PDF e obrigatorio" : "Arquivo de video e obrigatorio")
  }

  const extension = path.extname(file.originalname || "").toLowerCase()
  if (tipoConteudo === "pdf") {
    if (extension !== ".pdf") {
      throw new HttpError(400, "Apenas arquivos .pdf sao permitidos")
    }
    return
  }

  if (extension === ".pdf") {
    throw new HttpError(400, "Para PDF, selecione o tipoConteudo='pdf'")
  }
}

function cleanupPendingSharePointUploads() {
  const now = Date.now()
  for (const [key, pending] of pendingSharePointUploads.entries()) {
    if (now - pending.createdAt > PENDING_UPLOAD_TTL_MS) {
      pendingSharePointUploads.delete(key)
    }
  }
}

async function resolveChannelPath(canalId: string) {
  const channel = await getChannelById(canalId)
  if (!channel) {
    throw new HttpError(404, "Canal nao encontrado")
  }

  if (channel.PATH) {
    if (isSharePointEnabled()) {
      await ensureSharePointFolder(channel.PATH)
    } else {
      await ensurePublicDir(channel.PATH)
    }
    return { channel, channelPath: channel.PATH }
  }

  const channelPath = buildChannelRelativePath(channel.NOME)
  if (isSharePointEnabled()) {
    await ensureSharePointFolder(channelPath)
  } else {
    await ensurePublicDir(channelPath)
  }
  await updateChannel(channel.ID, { path: channelPath })
  return { channel, channelPath }
}

function buildVersionedChannelFileName(originalName: string, version: number, tipoConteudo: "video" | "pdf") {
  const ext = path.extname(originalName || "").toLowerCase() || ".mp4"
  const baseRaw = path.basename(originalName || "video", ext)
  const fallback = tipoConteudo === "pdf" ? "pdf" : "video"
  const base = sanitizeSegment(baseRaw).replace(/\s+/g, "-").toLowerCase() || fallback
  return `${base}${version}${ext}`
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

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { canalId } = req.query as { canalId?: string }
  if (!canalId) {
    throw new HttpError(400, "canalId e obrigatorio")
  }

  const videos = await listChannelVideos(canalId)
  res.json({ videos })
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const { versao } = req.query as { versao?: string }
  const parsedVersion =
    versao !== undefined && versao !== "" ? Number(versao) : undefined
  if (parsedVersion !== undefined && Number.isNaN(parsedVersion)) {
    throw new HttpError(400, "versao deve ser um numero")
  }

  const video = await getChannelVideoById(req.params.id, parsedVersion)
  if (!video) {
    throw new HttpError(404, "Video nao encontrado")
  }
  res.json({ video })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { id, canalId, pathVideo, duracaoSegundos, tipoConteudo, procedimentoId, normaId } = req.body as {
    id?: string
    canalId?: string
    pathVideo?: string
    duracaoSegundos?: number
    tipoConteudo?: "video" | "pdf"
    procedimentoId?: string
    normaId?: string
  }

  if (!id || !canalId || !pathVideo) {
    throw new HttpError(400, "ID, canalId e pathVideo sao obrigatorios")
  }

  const duration =
    duracaoSegundos !== undefined ? Number(duracaoSegundos) : undefined
  if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
    throw new HttpError(400, "duracaoSegundos invalida")
  }
  const normalizedTipo = parseTipoConteudo(tipoConteudo)

  const video = await createChannelVideo({
    id,
    canalId,
    pathVideo,
    tipoConteudo: normalizedTipo,
    procedimentoId: parseOptionalUuid(procedimentoId),
    normaId: parseOptionalUuid(normaId),
    duracaoSegundos: duration,
  })

  res.status(201).json({ video })
})

export const createUpload = asyncHandler(async (req: Request, res: Response) => {
  const { id, canalId, duracaoSegundos, tipoConteudo, procedimentoId, normaId } = req.body as {
    id?: string
    canalId?: string
    duracaoSegundos?: number
    tipoConteudo?: "video" | "pdf"
    procedimentoId?: string
    normaId?: string
  }
  const file = req.file

  if (!id || !canalId) {
    throw new HttpError(400, "ID e canalId sao obrigatorios")
  }

  const normalizedTipo = parseTipoConteudo(tipoConteudo)
  parseRequiredUploadedContent({ file, tipoConteudo: normalizedTipo })

  let duration =
    duracaoSegundos !== undefined ? Number(duracaoSegundos) : undefined
  if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
    throw new HttpError(400, "duracaoSegundos invalida")
  }

  if (normalizedTipo === "video" && duration === undefined) {
    const probed = await getVideoDurationSeconds(file.path)
    if (probed === null) {
      throw new HttpError(
        422,
        "Nao foi possivel identificar a duracao do video",
      )
    }
    duration = probed
  }
  if (normalizedTipo === "pdf") {
    duration = 0
  }

  const { channelPath } = await resolveChannelPath(canalId)
  const fileName = buildVersionedChannelFileName(file.originalname, 1, normalizedTipo)
  let storedPath = ""

  if (isSharePointEnabled()) {
    const uploaded = await uploadFileToSharePoint({
      tempFilePath: file.path,
      relativeFolderPath: channelPath,
      fileName,
      contentType: file.mimetype,
    })
    storedPath = uploaded.webUrl
  } else {
    const relativePath = [channelPath, fileName].filter(Boolean).join("/")
    const destPath = toFsPath(relativePath)
    await moveFile(file.path, destPath)
    storedPath = relativePath
  }

  const video = await createChannelVideo({
    id,
    canalId,
    pathVideo: storedPath,
    tipoConteudo: normalizedTipo,
    procedimentoId: parseOptionalUuid(procedimentoId),
    normaId: parseOptionalUuid(normaId),
    duracaoSegundos: duration,
  })

  res.status(201).json({ video })
})

export const updateUpload = asyncHandler(async (req: Request, res: Response) => {
  const { canalId, duracaoSegundos, tipoConteudo, procedimentoId, normaId } = req.body as {
    canalId?: string
    duracaoSegundos?: number
    tipoConteudo?: "video" | "pdf"
    procedimentoId?: string
    normaId?: string
  }
  const file = req.file

  const latestBeforeUpdate = await getChannelVideoById(req.params.id)
  if (!latestBeforeUpdate) {
    throw new HttpError(404, "Video nao encontrado")
  }
  const normalizedTipo = parseTipoConteudo(tipoConteudo ?? latestBeforeUpdate.TIPO_CONTEUDO)
  parseRequiredUploadedContent({ file, tipoConteudo: normalizedTipo })
  const resolvedCanalId =
    canalId ?? latestBeforeUpdate?.CANAL_FK_ID
  if (!resolvedCanalId) {
    throw new HttpError(400, "canalId e obrigatorio")
  }

  let duration =
    duracaoSegundos !== undefined ? Number(duracaoSegundos) : undefined
  if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
    throw new HttpError(400, "duracaoSegundos invalida")
  }

  if (normalizedTipo === "video" && duration === undefined) {
    const probed = await getVideoDurationSeconds(file.path)
    if (probed === null) {
      throw new HttpError(
        422,
        "Nao foi possivel identificar a duracao do video",
      )
    }
    duration = probed
  }
  if (normalizedTipo === "pdf") {
    duration = 0
  }

  const { channelPath } = await resolveChannelPath(resolvedCanalId)
  const nextVersion = (latestBeforeUpdate?.VERSAO ?? 0) + 1
  const fileName = buildVersionedChannelFileName(file.originalname, nextVersion, normalizedTipo)
  let storedPath = ""

  if (isSharePointEnabled()) {
    const uploaded = await uploadFileToSharePoint({
      tempFilePath: file.path,
      relativeFolderPath: channelPath,
      fileName,
      contentType: file.mimetype,
    })
    storedPath = uploaded.webUrl
  } else {
    const relativePath = [channelPath, fileName].filter(Boolean).join("/")
    const destPath = toFsPath(relativePath)
    await moveFile(file.path, destPath)
    storedPath = relativePath
  }

  const video = await updateChannelVideo(req.params.id, {
    canalId: resolvedCanalId,
    pathVideo: storedPath,
    tipoConteudo: normalizedTipo,
    procedimentoId: parseOptionalUuid(procedimentoId),
    normaId: parseOptionalUuid(normaId),
    duracaoSegundos: duration,
  })

  if (!video) {
    throw new HttpError(404, "Video nao encontrado")
  }

  if (normalizedTipo === "video" && latestBeforeUpdate?.PATH_VIDEO) {
    await syncTrilhaVideosFromChannelVersion(
      latestBeforeUpdate.PATH_VIDEO,
      video.PATH_VIDEO ?? latestBeforeUpdate.PATH_VIDEO,
      video.DURACAO_SEGUNDOS ?? undefined,
      parseOptionalUuid(procedimentoId) ?? video.PROCEDIMENTO_ID ?? null,
      parseOptionalUuid(normaId) ?? video.NORMA_ID ?? null,
    )
  }

  res.json({ video })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { canalId, pathVideo, duracaoSegundos, tipoConteudo, procedimentoId, normaId } = req.body as {
    canalId?: string
    pathVideo?: string
    duracaoSegundos?: number
    tipoConteudo?: "video" | "pdf"
    procedimentoId?: string
    normaId?: string
  }

  const trimmedPath = pathVideo?.trim()
  const latestBeforeUpdate = await getChannelVideoById(req.params.id)
  if (!latestBeforeUpdate) {
    throw new HttpError(404, "Video nao encontrado")
  }

  if (
    !trimmedPath &&
    canalId === undefined &&
    duracaoSegundos === undefined &&
    tipoConteudo === undefined &&
    procedimentoId === undefined &&
    normaId === undefined
  ) {
    throw new HttpError(400, "Informe ao menos um campo para atualizar")
  }

  const resolvedCanalId = canalId ?? latestBeforeUpdate.CANAL_FK_ID
  if (!resolvedCanalId) {
    throw new HttpError(400, "canalId e obrigatorio")
  }

  const duration = parseOptionalDuration(duracaoSegundos)
  const normalizedTipo =
    tipoConteudo !== undefined ? parseTipoConteudo(tipoConteudo) : undefined

  const video = await updateChannelVideo(req.params.id, {
    canalId: resolvedCanalId,
    pathVideo: trimmedPath,
    tipoConteudo: normalizedTipo,
    procedimentoId: parseOptionalUuid(procedimentoId),
    normaId: parseOptionalUuid(normaId),
    duracaoSegundos: duration,
  })

  if (!video) {
    throw new HttpError(404, "Video nao encontrado")
  }

  if ((normalizedTipo ?? latestBeforeUpdate.TIPO_CONTEUDO ?? "video") === "video" && latestBeforeUpdate.PATH_VIDEO) {
    await syncTrilhaVideosFromChannelVersion(
      latestBeforeUpdate.PATH_VIDEO,
      video.PATH_VIDEO ?? latestBeforeUpdate.PATH_VIDEO,
      video.DURACAO_SEGUNDOS ?? undefined,
      video.PROCEDIMENTO_ID ?? null,
      video.NORMA_ID ?? null,
    )
  }

  res.json({ video })
})

export const initSharePointUploadSession = asyncHandler(
  async (req: Request, res: Response) => {
    if (!isSharePointEnabled()) {
      throw new HttpError(
        400,
        "Upload em partes no SharePoint nao habilitado neste ambiente",
      )
    }

    cleanupPendingSharePointUploads()

    const { mode, id, canalId, fileName, duracaoSegundos, tipoConteudo, procedimentoId, normaId } = req.body as {
      mode?: "create" | "update"
      id?: string
      canalId?: string
      fileName?: string
      duracaoSegundos?: number
      tipoConteudo?: "video" | "pdf"
      procedimentoId?: string
      normaId?: string
    }

    if (!fileName?.trim()) {
      throw new HttpError(400, "fileName e obrigatorio")
    }

    const uploadMode = mode ?? "create"
    const duration = parseOptionalDuration(duracaoSegundos)
    const normalizedTipo = parseTipoConteudo(tipoConteudo)
    if (normalizedTipo === "pdf") {
      throw new HttpError(400, "Upload em partes para canal suporta apenas videos")
    }
    const sessionId = createSessionId()

    if (uploadMode === "create") {
      if (!id || !canalId) {
        throw new HttpError(400, "ID e canalId sao obrigatorios")
      }

      const { channelPath } = await resolveChannelPath(canalId)
      const uploadFileName = buildVersionedChannelFileName(fileName, 1, normalizedTipo)
      const session = await createSharePointUploadSession({
        relativeFolderPath: channelPath,
        fileName: uploadFileName,
      })

      pendingSharePointUploads.set(sessionId, {
        mode: "create",
        videoId: id,
        canalId,
        tipoConteudo: normalizedTipo,
        procedimentoId: parseOptionalUuid(procedimentoId) ?? null,
        normaId: parseOptionalUuid(normaId) ?? null,
        fullPath: session.fullPath,
        previousPath: null,
        duracaoSegundos: duration ?? null,
        createdAt: Date.now(),
      })

      res.status(201).json({
        sessionId,
        uploadUrl: session.uploadUrl,
        fileName: session.fileName,
      })
      return
    }

    if (uploadMode === "update") {
      if (!id) {
        throw new HttpError(400, "ID e obrigatorio")
      }

      const latestBeforeUpdate = await getChannelVideoById(id)
      if (!latestBeforeUpdate) {
        throw new HttpError(404, "Video nao encontrado")
      }

      const resolvedCanalId = canalId ?? latestBeforeUpdate.CANAL_FK_ID
      if (!resolvedCanalId) {
        throw new HttpError(400, "canalId e obrigatorio")
      }

      const { channelPath } = await resolveChannelPath(resolvedCanalId)
      const nextVersion = (latestBeforeUpdate.VERSAO ?? 0) + 1
      const uploadFileName = buildVersionedChannelFileName(fileName, nextVersion, normalizedTipo)
      const session = await createSharePointUploadSession({
        relativeFolderPath: channelPath,
        fileName: uploadFileName,
      })

      pendingSharePointUploads.set(sessionId, {
        mode: "update",
        videoId: id,
        canalId: resolvedCanalId,
        tipoConteudo: normalizedTipo,
        procedimentoId: parseOptionalUuid(procedimentoId) ?? latestBeforeUpdate.PROCEDIMENTO_ID ?? null,
        normaId: parseOptionalUuid(normaId) ?? latestBeforeUpdate.NORMA_ID ?? null,
        fullPath: session.fullPath,
        previousPath: latestBeforeUpdate.PATH_VIDEO ?? null,
        duracaoSegundos: duration ?? null,
        createdAt: Date.now(),
      })

      res.status(201).json({
        sessionId,
        uploadUrl: session.uploadUrl,
        fileName: session.fileName,
      })
      return
    }

    throw new HttpError(400, "mode deve ser 'create' ou 'update'")
  },
)

export const completeSharePointUploadSession = asyncHandler(
  async (req: Request, res: Response) => {
    if (!isSharePointEnabled()) {
      throw new HttpError(
        400,
        "Upload em partes no SharePoint nao habilitado neste ambiente",
      )
    }

    cleanupPendingSharePointUploads()

    const pending = pendingSharePointUploads.get(req.params.sessionId)
    if (!pending) {
      throw new HttpError(404, "Sessao de upload nao encontrada ou expirada")
    }

    if (Date.now() - pending.createdAt > PENDING_UPLOAD_TTL_MS) {
      pendingSharePointUploads.delete(req.params.sessionId)
      throw new HttpError(410, "Sessao de upload expirada")
    }

    const requestedDuration = parseOptionalDuration(
      (req.body as { duracaoSegundos?: number })?.duracaoSegundos,
    )
    const duration = requestedDuration ?? pending.duracaoSegundos ?? 0

    const uploadedFile = await getSharePointFileByPath(pending.fullPath)
    if (!uploadedFile.webUrl) {
      throw new HttpError(
        500,
        "Upload concluido sem webUrl do arquivo no SharePoint",
      )
    }

    let video
    if (pending.mode === "create") {
      video = await createChannelVideo({
        id: pending.videoId,
        canalId: pending.canalId,
        pathVideo: uploadedFile.webUrl,
        tipoConteudo: pending.tipoConteudo,
        procedimentoId: pending.procedimentoId,
        normaId: pending.normaId,
        duracaoSegundos: duration,
      })
    } else {
      video = await updateChannelVideo(pending.videoId, {
        canalId: pending.canalId,
        pathVideo: uploadedFile.webUrl,
        tipoConteudo: pending.tipoConteudo,
        procedimentoId: pending.procedimentoId,
        normaId: pending.normaId,
        duracaoSegundos: duration,
      })

      if (!video) {
        throw new HttpError(404, "Video nao encontrado")
      }

      if (pending.tipoConteudo === "video" && pending.previousPath) {
        await syncTrilhaVideosFromChannelVersion(
          pending.previousPath,
          video.PATH_VIDEO ?? pending.previousPath,
          video.DURACAO_SEGUNDOS ?? undefined,
          video.PROCEDIMENTO_ID ?? null,
          video.NORMA_ID ?? null,
        )
      }
    }

    pendingSharePointUploads.delete(req.params.sessionId)
    res.json({ video })
  },
)

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const versions = await listChannelVideoVersionsById(req.params.id)

  await deleteChannelVideo(req.params.id)

  for (const version of versions) {
    if (!version.PATH_VIDEO) continue
    if (isSharePointEnabled()) {
      // eslint-disable-next-line no-await-in-loop
      await deleteSharePointFileByUrl(version.PATH_VIDEO).catch(() => undefined)
    } else {
      // eslint-disable-next-line no-await-in-loop
      await removeLocalFileIfExists(version.PATH_VIDEO).catch(() => undefined)
    }
  }

  res.status(204).send()
})
