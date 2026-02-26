import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  createModule,
  deleteModule,
  getModuleById,
  listModules,
  listModulesByUser,
  updateModule,
} from "../models/moduleModel"
import { normalizeCpf } from "../utils/normalizeCpf"
import {
  buildModuleRelativePath,
  ensurePublicDir,
  renameDirectory,
} from "../utils/storage"
import {
  updateMaterialPathsByPrefix,
  updateTrilhaPathsByPrefix,
} from "../models/pathUpdateModel"

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { cpf } = req.query as { cpf?: string }
  const modules = cpf
    ? await listModulesByUser(normalizeCpf(cpf))
    : await listModules()
  res.json({ modules })
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const module = await getModuleById(req.params.id)
  if (!module) {
    throw new HttpError(404, "Modulo nao encontrado")
  }
  res.json({ module })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { id, nome, qtdTrilhas, criadoPor, path } = req.body as {
    id?: string
    nome?: string
    qtdTrilhas?: number
    criadoPor?: string
    path?: string
  }

  if (!id || !nome) {
    throw new HttpError(400, "ID e nome sao obrigatorios")
  }

  const modulePath = buildModuleRelativePath(nome)
  await ensurePublicDir(modulePath)

  const module = await createModule({
    id,
    nome,
    qtdTrilhas,
    criadoPor,
    path: path ?? modulePath,
  })
  res.status(201).json({ module })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { nome, qtdTrilhas, criadoPor, path } = req.body as {
    nome?: string
    qtdTrilhas?: number
    criadoPor?: string
    path?: string
  }

  if (
    nome === undefined &&
    qtdTrilhas === undefined &&
    criadoPor === undefined &&
    path === undefined
  ) {
    throw new HttpError(400, "Informe ao menos um campo para atualizar")
  }

  const current = await getModuleById(req.params.id)
  if (!current) {
    throw new HttpError(404, "Modulo nao encontrado")
  }

  const currentPath = current.PATH ?? buildModuleRelativePath(current.NOME)
  let nextPath = currentPath

  if (nome && nome.trim() !== current.NOME) {
    nextPath = buildModuleRelativePath(nome)
    if (nextPath !== currentPath) {
      await renameDirectory(currentPath, nextPath)
      await updateTrilhaPathsByPrefix(currentPath, nextPath)
      await updateMaterialPathsByPrefix(currentPath, nextPath)
    }
  } else if (!current.PATH) {
    await ensurePublicDir(currentPath)
  }

  const shouldUpdatePath = !current.PATH || nextPath !== currentPath
  const module = await updateModule(req.params.id, {
    nome,
    qtdTrilhas,
    criadoPor,
    path: shouldUpdatePath ? nextPath : undefined,
  })
  if (!module) {
    throw new HttpError(404, "Modulo nao encontrado")
  }

  res.json({ module })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  try {
    await deleteModule(req.params.id)
  } catch (error) {
    const requestError = error as {
      number?: number
      originalError?: { info?: { message?: string } }
      message?: string
    }
    const message =
      requestError?.originalError?.info?.message ?? requestError?.message ?? ""

    if (requestError?.number === 547 && message.includes("FK_TTRILHAS_MODULO")) {
      throw new HttpError(
        409,
        "Nao e possivel excluir o modulo porque existem trilhas vinculadas. Exclua as trilhas do modulo primeiro.",
      )
    }

    throw error
  }
  res.status(204).send()
})
