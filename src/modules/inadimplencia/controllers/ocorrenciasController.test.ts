import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const modelModule = require("../models/ocorrenciasModel") as Record<string, any>
const original = {
  create: modelModule.create,
  validateNumVendaFk: modelModule.validateNumVendaFk,
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const controller = require("./ocorrenciasController") as typeof import("./ocorrenciasController")

function createRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.send = vi.fn(() => res)
  return res
}

describe("ocorrenciasController", () => {
  let createMock: ReturnType<typeof vi.fn>
  let validateNumVendaFkMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createMock = vi.fn()
    validateNumVendaFkMock = vi.fn()
    modelModule.create = createMock
    modelModule.validateNumVendaFk = validateNumVendaFkMock
  })

  afterEach(() => {
    modelModule.create = original.create
    modelModule.validateNumVendaFk = original.validateNumVendaFk
  })

  describe("create", () => {
    it("aceita STATUS_OCORRENCIA='Alteração de Data' e retorna 201", async () => {
      validateNumVendaFkMock.mockResolvedValue({ exists: true })
      createMock.mockResolvedValue({
        ID_OCORRENCIA: "550e8400-e29b-41d4-a716-446655440000",
        NUM_VENDA_FK: 12345,
        STATUS_OCORRENCIA: "Alteração de Data",
        DT_OCORRENCIA: new Date("2026-04-22"),
        HORA_OCORRENCIA: new Date("2026-04-22T14:30:00Z"),
      })

      const req: any = {
        body: {
          NUM_VENDA_FK: 12345,
          NOME_USUARIO_FK: "joao.silva",
          DESCRICAO: "Cliente solicitou alteração da data de pagamento",
          STATUS_OCORRENCIA: "Alteração de Data",
          DT_OCORRENCIA: "2026-04-22",
          HORA_OCORRENCIA: "14:30:00",
        },
      }
      const res = createRes()
      const next = vi.fn()

      await controller.create(req, res, next)

      expect(validateNumVendaFkMock).toHaveBeenCalledWith(12345)
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          numVendaFk: 12345,
          statusOcorrencia: "Alteração de Data",
        })
      )
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            STATUS_OCORRENCIA: "Alteração de Data",
          }),
        })
      )
      expect(next).not.toHaveBeenCalled()
    })

    it("aceita outros valores de STATUS_OCORRENCIA (qualquer string)", async () => {
      validateNumVendaFkMock.mockResolvedValue({ exists: true })
      createMock.mockResolvedValue({
        ID_OCORRENCIA: "550e8400-e29b-41d4-a716-446655440001",
        NUM_VENDA_FK: 12345,
        STATUS_OCORRENCIA: "Promessa de pagamento",
        DT_OCORRENCIA: new Date("2026-04-22"),
        HORA_OCORRENCIA: new Date("2026-04-22T10:00:00Z"),
      })

      const req: any = {
        body: {
          NUM_VENDA_FK: 12345,
          NOME_USUARIO_FK: "maria.santos",
          DESCRICAO: "Cliente confirmou pagamento para amanhã",
          STATUS_OCORRENCIA: "Promessa de pagamento",
          DT_OCORRENCIA: "2026-04-22",
          HORA_OCORRENCIA: "10:00:00",
        },
      }
      const res = createRes()
      const next = vi.fn()

      await controller.create(req, res, next)

      expect(res.status).toHaveBeenCalledWith(201)
      expect(next).not.toHaveBeenCalled()
    })

    it("retorna 400 quando STATUS_OCORRENCIA está vazio", async () => {
      const req: any = {
        body: {
          NUM_VENDA_FK: 12345,
          NOME_USUARIO_FK: "joao.silva",
          DESCRICAO: "Descrição válida",
          STATUS_OCORRENCIA: "",
          DT_OCORRENCIA: "2026-04-22",
          HORA_OCORRENCIA: "14:30:00",
        },
      }
      const res = createRes()
      const next = vi.fn()

      await controller.create(req, res, next)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("STATUS_OCORRENCIA") }))
      expect(createMock).not.toHaveBeenCalled()
    })
  })

  describe("update", () => {
    it("aceita STATUS_OCORRENCIA='Alteração de Data' no PUT", async () => {
      validateNumVendaFkMock.mockResolvedValue({ exists: true })
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      modelModule.findById = vi.fn().mockResolvedValue({ ID_OCORRENCIA: "550e8400-e29b-41d4-a716-446655440000" })
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      modelModule.update = vi.fn().mockResolvedValue({
        ID_OCORRENCIA: "550e8400-e29b-41d4-a716-446655440000",
        NUM_VENDA_FK: 12345,
        STATUS_OCORRENCIA: "Alteração de Data",
        DT_OCORRENCIA: new Date("2026-04-22"),
        HORA_OCORRENCIA: new Date("2026-04-22T16:00:00Z"),
      })

      const req: any = {
        params: { id: "550e8400-e29b-41d4-a716-446655440000" },
        body: {
          NUM_VENDA_FK: 12345,
          NOME_USUARIO_FK: "joao.silva",
          DESCRICAO: "Alteração da data acordada",
          STATUS_OCORRENCIA: "Alteração de Data",
          DT_OCORRENCIA: "2026-04-22",
          HORA_OCORRENCIA: "16:00:00",
        },
      }
      const res = createRes()
      const next = vi.fn()

      await controller.update(req, res, next)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            STATUS_OCORRENCIA: "Alteração de Data",
          }),
        })
      )
      expect(next).not.toHaveBeenCalled()
    })
  })
})
