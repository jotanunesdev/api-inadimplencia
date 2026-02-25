import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  createChannel,
  deleteChannel,
  getChannelById,
  listChannels,
  updateChannel,
} from "../models/channelModel"
import { buildChannelRelativePath, ensurePublicDir } from "../utils/storage"
import {
  ensureSharePointFolder,
  isSharePointEnabled,
} from "../services/sharePointService"

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const channels = await listChannels()
  res.json({ channels })
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const channel = await getChannelById(req.params.id)
  if (!channel) {
    throw new HttpError(404, "Canal nao encontrado")
  }
  res.json({ channel })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { id, nome, criadoPor, path } = req.body as {
    id?: string
    nome?: string
    criadoPor?: string
    path?: string
  }

  if (!id || !nome) {
    throw new HttpError(400, "ID e nome sao obrigatorios")
  }

  const channelPath = buildChannelRelativePath(nome)
  if (isSharePointEnabled()) {
    await ensureSharePointFolder(channelPath)
  } else {
    await ensurePublicDir(channelPath)
  }

  const channel = await createChannel({
    id,
    nome,
    criadoPor,
    path: path ?? channelPath,
  })
  res.status(201).json({ channel })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { nome, criadoPor, path } = req.body as {
    nome?: string
    criadoPor?: string
    path?: string
  }

  if (nome === undefined && criadoPor === undefined && path === undefined) {
    throw new HttpError(400, "Informe ao menos um campo para atualizar")
  }

  const channel = await updateChannel(req.params.id, {
    nome,
    criadoPor,
    path,
  })
  if (!channel) {
    throw new HttpError(404, "Canal nao encontrado")
  }

  res.json({ channel })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteChannel(req.params.id)
  res.status(204).send()
})
