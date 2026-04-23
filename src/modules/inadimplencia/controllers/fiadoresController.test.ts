import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const modelModule = require("../models/fiadoresModel") as Record<string, any>
const original = {
  findByNumVenda: modelModule.findByNumVenda,
  findByCpf: modelModule.findByCpf,
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const controller = require("./fiadoresController") as typeof import("./fiadoresController") & {
  parseNumVenda: (v: unknown) => number | null
  parseCpfDigits: (v: unknown) => string | null
}

function createRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe("fiadoresController", () => {
  let findByNumVendaMock: ReturnType<typeof vi.fn>
  let findByCpfMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    findByNumVendaMock = vi.fn()
    findByCpfMock = vi.fn()
    modelModule.findByNumVenda = findByNumVendaMock
    modelModule.findByCpf = findByCpfMock
  })

  afterEach(() => {
    modelModule.findByNumVenda = original.findByNumVenda
    modelModule.findByCpf = original.findByCpf
  })

  describe("parseNumVenda", () => {
    it("aceita inteiros positivos", () => {
      expect(controller.parseNumVenda("20988")).toBe(20988)
      expect(controller.parseNumVenda(20988)).toBe(20988)
    })
    it("rejeita valores invalidos", () => {
      expect(controller.parseNumVenda(null)).toBeNull()
      expect(controller.parseNumVenda("abc")).toBeNull()
      expect(controller.parseNumVenda(0)).toBeNull()
      expect(controller.parseNumVenda(-1)).toBeNull()
      expect(controller.parseNumVenda(1.5)).toBeNull()
    })
  })

  describe("parseCpfDigits", () => {
    it("aceita 11 e 14 digitos, removendo mascara", () => {
      expect(controller.parseCpfDigits("601.423.405-53")).toBe("60142340553")
      expect(controller.parseCpfDigits("12345678901")).toBe("12345678901")
      expect(controller.parseCpfDigits("12.345.678/0001-99")).toBe("12345678000199")
    })
    it("rejeita tamanhos invalidos", () => {
      expect(controller.parseCpfDigits("123")).toBeNull()
      expect(controller.parseCpfDigits("")).toBeNull()
      expect(controller.parseCpfDigits(null as any)).toBeNull()
    })
  })

  describe("getByNumVenda", () => {
    it("retorna 200 com envelope { data }", async () => {
      findByNumVendaMock.mockResolvedValue([{ NUM_VENDA: 20988 }])
      const req: any = { params: { numVenda: "20988" } }
      const res = createRes()
      const next = vi.fn()

      await controller.getByNumVenda(req, res, next)

      expect(findByNumVendaMock).toHaveBeenCalledWith(20988)
      expect(res.json).toHaveBeenCalledWith({ data: [{ NUM_VENDA: 20988 }] })
      expect(next).not.toHaveBeenCalled()
    })

    it("retorna 400 quando numVenda e invalido", async () => {
      const req: any = { params: { numVenda: "abc" } }
      const res = createRes()
      const next = vi.fn()

      await controller.getByNumVenda(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: "numVenda invalido." })
      expect(findByNumVendaMock).not.toHaveBeenCalled()
    })

    it("propaga erros inesperados via next(err)", async () => {
      const boom = new Error("DB down")
      findByNumVendaMock.mockRejectedValue(boom)
      const req: any = { params: { numVenda: "1" } }
      const res = createRes()
      const next = vi.fn()

      await controller.getByNumVenda(req, res, next)

      expect(next).toHaveBeenCalledWith(boom)
    })
  })

  describe("getByCpf", () => {
    it("retorna 200 com envelope { data }", async () => {
      findByCpfMock.mockResolvedValue([{ NOME: "JOSEANE" }])
      const req: any = { params: { cpf: "601.423.405-53" } }
      const res = createRes()
      const next = vi.fn()

      await controller.getByCpf(req, res, next)

      expect(findByCpfMock).toHaveBeenCalledWith("60142340553")
      expect(res.json).toHaveBeenCalledWith({ data: [{ NOME: "JOSEANE" }] })
    })

    it("retorna 400 quando CPF invalido", async () => {
      const req: any = { params: { cpf: "123" } }
      const res = createRes()
      const next = vi.fn()

      await controller.getByCpf(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(findByCpfMock).not.toHaveBeenCalled()
    })
  })
})
