import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const modelModule = require("../models/dashboardModel") as Record<string, any>

const originalModelMethods: Record<string, any> = {}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const controller = require("./dashboardController") as typeof import("./dashboardController")

function createRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

const FILTERED_HANDLERS = [
  ["getVendasPorResponsavel", "vendasPorResponsavel", 1] as const,
  ["getOcorrenciasPorUsuario", "ocorrenciasPorUsuario", 1] as const,
  ["getOcorrenciasPorVenda", "ocorrenciasPorVenda", 2] as const,
  ["getOcorrenciasPorDia", "ocorrenciasPorDia", 1] as const,
  ["getOcorrenciasPorHora", "ocorrenciasPorHora", 1] as const,
  ["getOcorrenciasPorDiaHora", "ocorrenciasPorDiaHora", 1] as const,
  ["getProximasAcoesPorDia", "proximasAcoesPorDia", 1] as const,
  ["getAcoesDefinidas", "acoesDefinidas", 1] as const,
  ["getAtendentesProximaAcao", "atendentesProximaAcao", 1] as const,
  ["getTodasOcorrencias", "todasOcorrencias", 1] as const,
]

describe("dashboardController — integração com parseDateRange", () => {
  beforeEach(() => {
    FILTERED_HANDLERS.forEach(([, modelMethodName]) => {
      originalModelMethods[modelMethodName] = modelModule[modelMethodName]
      modelModule[modelMethodName] = vi.fn(async () => [])
    })
  })

  afterEach(() => {
    FILTERED_HANDLERS.forEach(([, modelMethodName]) => {
      modelModule[modelMethodName] = originalModelMethods[modelMethodName]
    })
  })

  describe.each(FILTERED_HANDLERS)("%s", (handlerName, modelMethodName, arity) => {
    it(`[${handlerName}] sem querystring chama model com range.hasRange=false`, async () => {
      const req: any = { query: {} }
      const res = createRes()
      const next = vi.fn()

      await (controller as any)[handlerName](req, res, next)

      expect(next).not.toHaveBeenCalled()
      const mock = modelModule[modelMethodName] as ReturnType<typeof vi.fn>
      expect(mock).toHaveBeenCalledTimes(1)
      const calledArgs = mock.mock.calls[0]
      const range = calledArgs[arity - 1]
      expect(range).toMatchObject({ hasRange: false })
    })

    it(`[${handlerName}] com querystring valida chama model com range.hasRange=true`, async () => {
      const req: any = {
        query: { dataInicio: "2026-04-01", dataFim: "2026-04-15" },
      }
      const res = createRes()
      const next = vi.fn()

      await (controller as any)[handlerName](req, res, next)

      expect(next).not.toHaveBeenCalled()
      const mock = modelModule[modelMethodName] as ReturnType<typeof vi.fn>
      const range = mock.mock.calls[0][arity - 1]
      expect(range.hasRange).toBe(true)
      expect(range.dataInicio).toBeInstanceOf(Date)
      expect(range.dataFim).toBeInstanceOf(Date)
    })

    it(`[${handlerName}] com querystring invalida delega 400 via next(err)`, async () => {
      const req: any = {
        query: { dataInicio: "2026-04-15", dataFim: "2026-04-01" },
      }
      const res = createRes()
      const next = vi.fn()

      await (controller as any)[handlerName](req, res, next)

      expect(next).toHaveBeenCalledTimes(1)
      const err = next.mock.calls[0][0]
      expect(err).toBeInstanceOf(Error)
      expect(err.statusCode).toBe(400)
      const mock = modelModule[modelMethodName] as ReturnType<typeof vi.fn>
      expect(mock).not.toHaveBeenCalled()
    })
  })
})
