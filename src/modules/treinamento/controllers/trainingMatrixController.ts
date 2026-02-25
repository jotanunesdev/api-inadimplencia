import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  createTrainingMatrix,
  deleteTrainingMatrix,
  getTrainingMatrixById,
  listTrainingMatrix,
  updateTrainingMatrix,
} from "../models/trainingMatrixModel"

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { cargo } = req.query as { cargo?: string }
  const items = await listTrainingMatrix(cargo)
  res.json({ items })
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const item = await getTrainingMatrixById(req.params.id)
  if (!item) {
    throw new HttpError(404, "Treinamento nao encontrado")
  }
  res.json({ item })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { id, cargoFk, cursoId, qtdHoras, titulo, provaBase64 } = req.body as {
    id?: string
    cargoFk?: string
    cursoId?: string
    qtdHoras?: number
    titulo?: string
    provaBase64?: string
  }

  if (!id || !cargoFk || !cursoId) {
    throw new HttpError(400, "ID, cargoFk e cursoId sao obrigatorios")
  }

  const provaBuffer = provaBase64 ? Buffer.from(provaBase64, "base64") : null

  const item = await createTrainingMatrix({
    id,
    cargoFk,
    cursoId,
    qtdHoras,
    titulo,
    prova: provaBuffer,
  })

  res.status(201).json({ item })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { cargoFk, cursoId, qtdHoras, titulo, provaBase64 } = req.body as {
    cargoFk?: string
    cursoId?: string
    qtdHoras?: number
    titulo?: string
    provaBase64?: string
  }

  if (!cargoFk || !cursoId) {
    throw new HttpError(400, "cargoFk e cursoId sao obrigatorios")
  }

  const provaBuffer = provaBase64 ? Buffer.from(provaBase64, "base64") : null

  const item = await updateTrainingMatrix(req.params.id, {
    cargoFk,
    cursoId,
    qtdHoras,
    titulo,
    prova: provaBuffer,
  })

  if (!item) {
    throw new HttpError(404, "Treinamento nao encontrado")
  }

  res.json({ item })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteTrainingMatrix(req.params.id)
  res.status(204).send()
})