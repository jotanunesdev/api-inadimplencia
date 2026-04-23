import { describe, it, expect } from "vitest"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseDateRange } = require("./dateRange") as typeof import("./dateRange")

describe("parseDateRange", () => {
  it("retorna hasRange=false quando nao ha parametros", () => {
    const result = parseDateRange({})
    expect(result).toEqual({ hasRange: false, dataInicio: null, dataFim: null })
  })

  it("retorna hasRange=false quando query e undefined/null", () => {
    expect(parseDateRange(undefined)).toEqual({
      hasRange: false,
      dataInicio: null,
      dataFim: null,
    })
    expect(parseDateRange(null)).toEqual({
      hasRange: false,
      dataInicio: null,
      dataFim: null,
    })
  })

  it("retorna hasRange=false quando ambos parametros sao strings vazias", () => {
    expect(parseDateRange({ dataInicio: "", dataFim: "" })).toEqual({
      hasRange: false,
      dataInicio: null,
      dataFim: null,
    })
  })

  it("lanca 400 quando so dataInicio e informado", () => {
    expect(() => parseDateRange({ dataInicio: "2026-04-01" })).toThrowError(
      /dataInicio e dataFim em conjunto/i,
    )
    try {
      parseDateRange({ dataInicio: "2026-04-01" })
    } catch (err: any) {
      expect(err.statusCode).toBe(400)
    }
  })

  it("lanca 400 quando so dataFim e informado", () => {
    expect(() => parseDateRange({ dataFim: "2026-04-01" })).toThrowError(
      /dataInicio e dataFim em conjunto/i,
    )
  })

  it("lanca 400 quando formato e invalido", () => {
    expect(() =>
      parseDateRange({ dataInicio: "01/04/2026", dataFim: "15/04/2026" }),
    ).toThrowError(/Formato de data invalido/i)
    expect(() =>
      parseDateRange({ dataInicio: "2026-4-1", dataFim: "2026-04-15" }),
    ).toThrowError(/Formato de data invalido/i)
  })

  it("lanca 400 quando dataFim < dataInicio", () => {
    expect(() =>
      parseDateRange({ dataInicio: "2026-04-15", dataFim: "2026-04-01" }),
    ).toThrowError(/dataFim deve ser maior ou igual/i)
  })

  it("aceita range valido e retorna Date UTC", () => {
    const result = parseDateRange({
      dataInicio: "2026-04-01",
      dataFim: "2026-04-15",
    })
    expect(result.hasRange).toBe(true)
    expect(result.dataInicio).toBeInstanceOf(Date)
    expect(result.dataFim).toBeInstanceOf(Date)
    expect(result.dataInicio!.toISOString()).toBe("2026-04-01T00:00:00.000Z")
    expect(result.dataFim!.toISOString()).toBe("2026-04-15T00:00:00.000Z")
  })

  it("aceita range com mesma data de inicio e fim", () => {
    const result = parseDateRange({
      dataInicio: "2026-04-10",
      dataFim: "2026-04-10",
    })
    expect(result.hasRange).toBe(true)
  })

  it("trima espacos em branco dos valores", () => {
    const result = parseDateRange({
      dataInicio: "  2026-04-01  ",
      dataFim: "  2026-04-15  ",
    })
    expect(result.hasRange).toBe(true)
  })
})
