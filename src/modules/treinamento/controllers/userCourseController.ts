import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  createUserCourse,
  deleteUserCourse,
  listUserCourses,
  updateUserCourse,
} from "../models/userCourseModel"

const allowedStatus = new Set([
  "Nao iniciado",
  "Em andamento",
  "Concluido aprovado",
  "Concluido reprovado",
])

export const listByUser = asyncHandler(async (req: Request, res: Response) => {
  const courses = await listUserCourses(req.params.cpf)
  res.json({ courses })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { id, cpf, cursoId, status, dtInicio, dtConclusao } = req.body as {
    id?: string
    cpf?: string
    cursoId?: string
    status?: string
    dtInicio?: string
    dtConclusao?: string
  }

  if (!id || !cpf || !cursoId || !status) {
    throw new HttpError(400, "ID, cpf, cursoId e status sao obrigatorios")
  }

  if (!allowedStatus.has(status)) {
    throw new HttpError(400, "Status invalido")
  }

  await createUserCourse({
    id,
    cpf,
    cursoId,
    status,
    dtInicio: dtInicio ? new Date(dtInicio) : null,
    dtConclusao: dtConclusao ? new Date(dtConclusao) : null,
  })

  res.status(201).json({ message: "Curso associado ao usuario" })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { status, dtInicio, dtConclusao } = req.body as {
    status?: string
    dtInicio?: string
    dtConclusao?: string
  }

  if (!status) {
    throw new HttpError(400, "Status e obrigatorio")
  }

  if (!allowedStatus.has(status)) {
    throw new HttpError(400, "Status invalido")
  }

  await updateUserCourse(req.params.id, {
    status,
    dtInicio: dtInicio ? new Date(dtInicio) : null,
    dtConclusao: dtConclusao ? new Date(dtConclusao) : null,
  })

  res.json({ message: "Curso atualizado" })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteUserCourse(req.params.id)
  res.status(204).send()
})