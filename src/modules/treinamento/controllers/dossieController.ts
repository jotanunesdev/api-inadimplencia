import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import { normalizeCpf } from "../utils/normalizeCpf"
import {
  generateDossiePdfForCpf,
  listDossieSelectableCoursesByCpf,
  type DossieCourseSelection,
} from "../services/dossieService"
import { listDossieCandidates } from "../models/dossieModel"

export const listCandidates = asyncHandler(async (_req: Request, res: Response) => {
  const candidates = await listDossieCandidates()
  res.json({ candidates })
})

export const listCourses = asyncHandler(async (req: Request, res: Response) => {
  const normalizedCpf = normalizeCpf(String(req.params.cpf ?? ""))
  if (!normalizedCpf) {
    throw new HttpError(400, "cpf e obrigatorio")
  }

  const courses = await listDossieSelectableCoursesByCpf(normalizedCpf)
  res.json({ courses })
})

export const generate = asyncHandler(async (req: Request, res: Response) => {
  const { cpf, usuarioEmissor, UsuarioEmissor, obra, Obra, setorObra, SetorObra, cursosSelecionados, CursosSelecionados } = (req.body ?? {}) as {
    cpf?: string
    usuarioEmissor?: string | null
    UsuarioEmissor?: string | null
    obra?: string | null
    Obra?: string | null
    setorObra?: string | null
    SetorObra?: string | null
    cursosSelecionados?: unknown
    CursosSelecionados?: unknown
  }
  const normalizedCpf = normalizeCpf(String(cpf ?? ""))

  if (!normalizedCpf) {
    throw new HttpError(400, "cpf e obrigatorio")
  }

  const selectedCoursesInput = CursosSelecionados ?? cursosSelecionados
  const parsedSelectedCourses: DossieCourseSelection[] | null = Array.isArray(selectedCoursesInput)
    ? selectedCoursesInput
        .map((item) => {
          if (!item || typeof item !== "object") return null
          const source = item as Record<string, unknown>
          const tipoRaw = String(source.tipo ?? "").trim().toLowerCase()
          const itemId = String(source.itemId ?? "").trim()
          const trilhaId = String(source.trilhaId ?? "").trim()
          if ((tipoRaw !== "norma" && tipoRaw !== "procedimento") || !itemId || !trilhaId) {
            return null
          }
          return {
            tipo: tipoRaw as DossieCourseSelection["tipo"],
            itemId,
            trilhaId,
          }
        })
        .filter((item): item is DossieCourseSelection => Boolean(item))
    : null

  const dossie = await generateDossiePdfForCpf(normalizedCpf, {
    usuarioEmissor: (() => {
      const value = UsuarioEmissor ?? usuarioEmissor
      return typeof value === "string" && value.trim() ? value.trim() : null
    })(),
    obra: (() => {
      const value = Obra ?? obra
      return typeof value === "string" && value.trim() ? value.trim() : null
    })(),
    setorObra: (() => {
      const value = SetorObra ?? setorObra
      return typeof value === "string" && value.trim() ? value.trim() : null
    })(),
    cursosSelecionados: parsedSelectedCourses,
  })
  res.status(201).json({ dossie })
})
