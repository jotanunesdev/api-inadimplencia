import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

type QueryCapture = { text: string; inputs: Record<string, unknown> }

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("../config/db") as { getPool: unknown; sql: unknown }
const originalGetPool = db.getPool

// eslint-disable-next-line @typescript-eslint/no-require-imports
const model = require("./fiadoresModel") as typeof import("./fiadoresModel")

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
          return {
            recordset: [
              {
                NUM_VENDA: 20988,
                NOME: "JOSEANE TAVARES",
                TIPO_ASSOCIACAO: "CÔNJUGE",
              },
            ],
          }
        }),
      }
      return chain
    },
  }
}

describe("fiadoresModel", () => {
  const captures: QueryCapture[] = []

  beforeEach(() => {
    captures.length = 0
    ;(db as any).getPool = async () => createFakePool(captures)
  })

  afterEach(() => {
    ;(db as any).getPool = originalGetPool
  })

  describe("findByNumVenda", () => {
    it("executa query parametrizada por NUM_VENDA e ordena por DATA_CADASTRO DESC, NOME ASC", async () => {
      const rows = await model.findByNumVenda(20988)
      expect(rows).toHaveLength(1)
      expect(captures).toHaveLength(1)
      const [capture] = captures
      expect(capture.inputs).toEqual({ numVenda: 20988 })
      expect(capture.text).toContain("DW.vw_fiadores_por_venda")
      expect(capture.text).toContain("WHERE NUM_VENDA = @numVenda")
      expect(capture.text).toContain("ORDER BY DATA_CADASTRO DESC, NOME ASC")
    })
  })

  describe("findByCpf", () => {
    it("executa query normalizando DOCUMENTO (sem mascara) e ordena igual", async () => {
      const rows = await model.findByCpf("60142340553")
      expect(rows).toHaveLength(1)
      expect(captures).toHaveLength(1)
      const [capture] = captures
      expect(capture.inputs).toEqual({ cpfDigits: "60142340553" })
      expect(capture.text).toContain("REPLACE(REPLACE(REPLACE(DOCUMENTO")
      expect(capture.text).toContain("= @cpfDigits")
      expect(capture.text).toContain("ORDER BY DATA_CADASTRO DESC, NOME ASC")
    })
  })
})
