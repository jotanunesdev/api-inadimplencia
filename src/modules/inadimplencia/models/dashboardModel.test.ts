import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

type QueryCapture = { text: string; inputs: Record<string, unknown> }

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("../config/db") as { getPool: unknown }
const originalGetPool = db.getPool

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dashboardModel = require("./dashboardModel") as typeof import("./dashboardModel") & {
  vendasPorResponsavel: (range?: any) => Promise<unknown[]>
  ocorrenciasPorUsuario: (range?: any) => Promise<unknown[]>
  ocorrenciasPorVenda: (limit: number | null, range?: any) => Promise<unknown[]>
  ocorrenciasPorDia: (range?: any) => Promise<unknown[]>
  ocorrenciasPorHora: (range?: any) => Promise<unknown[]>
  ocorrenciasPorDiaHora: (range?: any) => Promise<unknown[]>
  proximasAcoesPorDia: (range?: any) => Promise<unknown[]>
  acoesDefinidas: (range?: any) => Promise<unknown>
  atendentesProximaAcao: (range?: any) => Promise<unknown[]>
  todasOcorrencias: (range?: any) => Promise<unknown[]>
}

function createFakePool(captures: QueryCapture[]) {
  return {
    request: () => {
      const capture: QueryCapture = { text: "", inputs: {} }
      const chain: any = {
        input: vi.fn((name: string, _type: unknown, value: unknown) => {
          capture.inputs[name] = value
          return chain
        }),
        query: vi.fn(async (text: string) => {
          capture.text = text
          captures.push(capture)
          return { recordset: [{ TOTAL: 1 }] }
        }),
      }
      return chain
    },
  }
}

const RANGE = {
  hasRange: true,
  dataInicio: new Date("2026-04-01T00:00:00Z"),
  dataFim: new Date("2026-04-15T00:00:00Z"),
}
const NO_RANGE = { hasRange: false, dataInicio: null, dataFim: null }

const FILTERED_ENDPOINTS: Array<[string, () => Promise<unknown>, () => Promise<unknown>]> = [
  [
    "vendasPorResponsavel",
    () => dashboardModel.vendasPorResponsavel(NO_RANGE),
    () => dashboardModel.vendasPorResponsavel(RANGE),
  ],
  [
    "ocorrenciasPorUsuario",
    () => dashboardModel.ocorrenciasPorUsuario(NO_RANGE),
    () => dashboardModel.ocorrenciasPorUsuario(RANGE),
  ],
  [
    "ocorrenciasPorVenda",
    () => dashboardModel.ocorrenciasPorVenda(null, NO_RANGE),
    () => dashboardModel.ocorrenciasPorVenda(null, RANGE),
  ],
  [
    "ocorrenciasPorDia",
    () => dashboardModel.ocorrenciasPorDia(NO_RANGE),
    () => dashboardModel.ocorrenciasPorDia(RANGE),
  ],
  [
    "ocorrenciasPorHora",
    () => dashboardModel.ocorrenciasPorHora(NO_RANGE),
    () => dashboardModel.ocorrenciasPorHora(RANGE),
  ],
  [
    "ocorrenciasPorDiaHora",
    () => dashboardModel.ocorrenciasPorDiaHora(NO_RANGE),
    () => dashboardModel.ocorrenciasPorDiaHora(RANGE),
  ],
  [
    "proximasAcoesPorDia",
    () => dashboardModel.proximasAcoesPorDia(NO_RANGE),
    () => dashboardModel.proximasAcoesPorDia(RANGE),
  ],
  [
    "acoesDefinidas",
    () => dashboardModel.acoesDefinidas(NO_RANGE),
    () => dashboardModel.acoesDefinidas(RANGE),
  ],
  [
    "atendentesProximaAcao",
    () => dashboardModel.atendentesProximaAcao(NO_RANGE),
    () => dashboardModel.atendentesProximaAcao(RANGE),
  ],
  [
    "todasOcorrencias",
    () => dashboardModel.todasOcorrencias(NO_RANGE),
    () => dashboardModel.todasOcorrencias(RANGE),
  ],
]

describe("dashboardModel — filtro de periodo", () => {
  const captures: QueryCapture[] = []

  beforeEach(() => {
    captures.length = 0
    ;(db as any).getPool = async () => createFakePool(captures)
  })

  afterEach(() => {
    ;(db as any).getPool = originalGetPool
  })

  describe.each(FILTERED_ENDPOINTS)("%s", (name, runWithoutRange, runWithRange) => {
    it(`[${name}] sem range: nao emite BETWEEN nem binda dataInicio/dataFim`, async () => {
      await runWithoutRange()
      const [capture] = captures
      expect(capture.text).not.toMatch(/BETWEEN\s+@dataInicio\s+AND\s+@dataFim/i)
      expect(capture.inputs.dataInicio).toBeUndefined()
      expect(capture.inputs.dataFim).toBeUndefined()
    })

    it(`[${name}] com range: emite BETWEEN e binda datas`, async () => {
      await runWithRange()
      const [capture] = captures
      expect(capture.text).toMatch(/BETWEEN\s+@dataInicio\s+AND\s+@dataFim/i)
      expect(capture.inputs.dataInicio).toEqual(RANGE.dataInicio)
      expect(capture.inputs.dataFim).toEqual(RANGE.dataFim)
    })
  })

  it("metodos nao-filtrados continuam funcionando sem parametros", async () => {
    await dashboardModel.kpis()
    await dashboardModel.aging()
    expect(captures.length).toBe(2)
    captures.forEach((c) => {
      expect(c.inputs.dataInicio).toBeUndefined()
      expect(c.inputs.dataFim).toBeUndefined()
    })
  })
})
