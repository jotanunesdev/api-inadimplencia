import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  createCourse,
  deleteCourse,
  getCourseById,
  listCourses,
  updateCourse,
} from "../models/courseModel"

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const courses = await listCourses()
  res.json({ courses })
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const course = await getCourseById(req.params.id)
  if (!course) {
    throw new HttpError(404, "Curso nao encontrado")
  }

  res.json({ course })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { id, titulo, descricao, duracao, materialApoio } = req.body as {
    id?: string
    titulo?: string
    descricao?: string
    duracao?: number
    materialApoio?: string
  }

  if (!id) {
    throw new HttpError(400, "ID do curso e obrigatorio")
  }

  const course = await createCourse({
    id,
    titulo,
    descricao,
    duracao,
    materialApoio,
  })

  res.status(201).json({ course })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { titulo, descricao, duracao, materialApoio } = req.body as {
    titulo?: string
    descricao?: string
    duracao?: number
    materialApoio?: string
  }

  const course = await updateCourse(req.params.id, {
    titulo,
    descricao,
    duracao,
    materialApoio,
  })

  if (!course) {
    throw new HttpError(404, "Curso nao encontrado")
  }

  res.json({ course })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteCourse(req.params.id)
  res.status(204).send()
})