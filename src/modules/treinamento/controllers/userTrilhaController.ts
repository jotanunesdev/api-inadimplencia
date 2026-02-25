import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import { normalizeCpf } from "../utils/normalizeCpf"
import { getUserByCpf, upsertUser } from "../models/userModel"
import { assignTrilhas, listUserTrilhas, removeUserTrilha } from "../models/userTrilhaModel"
import { mapReadViewToUser } from "../utils/userMapping"
import { trilhaHasObjectiveProva } from "../models/provaModel"
import { trilhaHasEficaciaConfig } from "../models/trilhaModel"

export const assign = asyncHandler(async (req: Request, res: Response) => {
  const { cpf, trilhaIds, atribuidoPor, user } = req.body as {
    cpf?: string
    trilhaIds?: string[]
    atribuidoPor?: string
    user?: Record<string, string>
  }

  if (!cpf || !Array.isArray(trilhaIds) || trilhaIds.length === 0) {
    throw new HttpError(400, "cpf e trilhaIds sao obrigatorios")
  }

  const cpfDigits = normalizeCpf(cpf)
  if (cpfDigits.length !== 11) {
    throw new HttpError(400, "CPF invalido")
  }

  for (const trilhaId of trilhaIds) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const hasProva = await trilhaHasObjectiveProva(trilhaId)
      if (!hasProva) {
        throw new HttpError(
          400,
          "Toda trilha deve possuir prova objetiva antes de ser atribuida.",
        )
      }

      // eslint-disable-next-line no-await-in-loop
      const hasEficacia = await trilhaHasEficaciaConfig(trilhaId)
      if (!hasEficacia) {
        throw new HttpError(
          400,
          "Toda trilha deve possuir avaliacao de eficacia configurada antes de ser atribuida.",
        )
      }
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
      if (error instanceof HttpError) throw error
      throw error
    }
  }

  if (user && typeof user === "object") {
    const mapped = mapReadViewToUser({ ...user, CPF: cpfDigits })
    await upsertUser(mapped)
  } else {
    const existing = await getUserByCpf(cpfDigits)
    if (!existing) {
      await upsertUser({ cpf: cpfDigits })
    }
  }

  const result = await assignTrilhas(cpfDigits, trilhaIds, atribuidoPor ?? null)
  res.status(201).json(result)
})

export const listByCpf = asyncHandler(async (req: Request, res: Response) => {
  const cpfDigits = normalizeCpf(req.params.cpf)
  if (cpfDigits.length !== 11) {
    throw new HttpError(400, "CPF invalido")
  }

  const { moduloId } = req.query as { moduloId?: string }
  const trilhas = await listUserTrilhas(cpfDigits, moduloId)
  res.json({ trilhas })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const cpfDigits = normalizeCpf(req.params.cpf)
  if (cpfDigits.length !== 11) {
    throw new HttpError(400, "CPF invalido")
  }

  const removed = await removeUserTrilha(cpfDigits, req.params.trilhaId)
  if (!removed) {
    throw new HttpError(404, "Vinculo nao encontrado")
  }

  res.status(204).send()
})
