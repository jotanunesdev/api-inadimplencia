import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  createTrilha,
  deleteTrilha,
  getTrilhaById,
  listTrilhasByModulo,
  listTrilhasByUser,
  upsertTrilhaEficaciaConfig,
  updateTrilha,
} from "../models/trilhaModel"
import { getModuleById } from "../models/moduleModel"
import { normalizeCpf } from "../utils/normalizeCpf"
import {
  buildModuleRelativePath,
  buildTrilhaRelativePath,
  ensurePublicDir,
  renameDirectory,
} from "../utils/storage"
import { updateMaterialPathsByPrefix } from "../models/pathUpdateModel"

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { moduloId, cpf } = req.query as { moduloId?: string; cpf?: string }

  if (!moduloId && !cpf) {
    throw new HttpError(400, "moduloId ou cpf e obrigatorio")
  }

  const trilhas = cpf
    ? await listTrilhasByUser(normalizeCpf(cpf), moduloId)
    : await listTrilhasByModulo(moduloId as string)
  res.json({ trilhas })
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const trilha = await getTrilhaById(req.params.id)
  if (!trilha) {
    throw new HttpError(404, "Trilha nao encontrada")
  }
  res.json({ trilha })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { id, moduloId, titulo, criadoPor, atualizadoEm, path } = req.body as {
    id?: string
    moduloId?: string
    titulo?: string
    criadoPor?: string
    atualizadoEm?: string
    path?: string
  }

  if (!id || !moduloId || !titulo) {
    throw new HttpError(400, "ID, moduloId e titulo sao obrigatorios")
  }

  const module = await getModuleById(moduloId)
  if (!module) {
    throw new HttpError(404, "Modulo nao encontrado")
  }

  const modulePath = module.PATH ?? buildModuleRelativePath(module.NOME)
  await ensurePublicDir(modulePath)
  const trilhaPath = buildTrilhaRelativePath(modulePath, titulo)
  await ensurePublicDir(trilhaPath)

  const trilha = await createTrilha({
    id,
    moduloId,
    titulo,
    criadoPor,
    atualizadoEm: atualizadoEm ? new Date(atualizadoEm) : null,
    path: path ?? trilhaPath,
  })

  res.status(201).json({ trilha })
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { moduloId, titulo, criadoPor, atualizadoEm, path } = req.body as {
    moduloId?: string
    titulo?: string
    criadoPor?: string
    atualizadoEm?: string
    path?: string
  }

  if (
    moduloId === undefined &&
    titulo === undefined &&
    criadoPor === undefined &&
    atualizadoEm === undefined &&
    path === undefined
  ) {
    throw new HttpError(400, "Informe ao menos um campo para atualizar")
  }

  const current = await getTrilhaById(req.params.id)
  if (!current) {
    throw new HttpError(404, "Trilha nao encontrada")
  }

  const targetModuloId = moduloId ?? current.MODULO_FK_ID
  const targetTitulo = titulo ?? current.TITULO

  const currentModule = await getModuleById(current.MODULO_FK_ID)
  if (!currentModule) {
    throw new HttpError(404, "Modulo nao encontrado")
  }

  const targetModule =
    targetModuloId === current.MODULO_FK_ID
      ? currentModule
      : await getModuleById(targetModuloId)

  if (!targetModule) {
    throw new HttpError(404, "Modulo nao encontrado")
  }

  const currentModulePath =
    currentModule.PATH ?? buildModuleRelativePath(currentModule.NOME)
  const currentPath =
    current.PATH ?? buildTrilhaRelativePath(currentModulePath, current.TITULO)

  const targetModulePath =
    targetModule.PATH ?? buildModuleRelativePath(targetModule.NOME)
  await ensurePublicDir(targetModulePath)
  const targetPath = buildTrilhaRelativePath(targetModulePath, targetTitulo)

  const shouldRename = targetPath !== currentPath
  if (shouldRename) {
    await renameDirectory(currentPath, targetPath)
    await updateMaterialPathsByPrefix(currentPath, targetPath)
  } else if (!current.PATH) {
    await ensurePublicDir(currentPath)
  }

  const shouldUpdatePath = !current.PATH || shouldRename
  const trilha = await updateTrilha(req.params.id, {
    moduloId,
    titulo,
    criadoPor,
    atualizadoEm: atualizadoEm ? new Date(atualizadoEm) : null,
    path: shouldUpdatePath ? targetPath : undefined,
  })

  if (!trilha) {
    throw new HttpError(404, "Trilha nao encontrada")
  }

  res.json({ trilha })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteTrilha(req.params.id)
  res.status(204).send()
})

export const upsertEficaciaConfig = asyncHandler(async (req: Request, res: Response) => {
  const { pergunta, obrigatoria } = req.body as {
    pergunta?: string
    obrigatoria?: boolean
  }

  const trilha = await getTrilhaById(req.params.id)
  if (!trilha) {
    throw new HttpError(404, "Trilha nao encontrada")
  }

  const perguntaTrimmed = (pergunta ?? "").trim()
  if (!perguntaTrimmed) {
    throw new HttpError(400, "A pergunta da avaliacao de eficacia e obrigatoria")
  }

  try {
    const updated = await upsertTrilhaEficaciaConfig(req.params.id, {
      pergunta: perguntaTrimmed,
      obrigatoria: obrigatoria !== false,
    })
    res.json({ trilha: updated })
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : ""
    if (code === "TRILHA_EFICACIA_CONFIG_COLUMNS_MISSING") {
      throw new HttpError(
        400,
        "Banco sem suporte a configuracao de avaliacao de eficacia por trilha. Execute a migration de TTRILHAS.",
      )
    }
    throw error
  }
})
