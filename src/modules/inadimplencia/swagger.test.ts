import { describe, it, expect } from "vitest"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const swaggerSpec = require("./swagger") as any

const FILTERED_ENDPOINTS = [
  "/dashboard/ocorrencias",
  "/dashboard/ocorrencias-por-usuario",
  "/dashboard/ocorrencias-por-venda",
  "/dashboard/ocorrencias-por-dia",
  "/dashboard/ocorrencias-por-hora",
  "/dashboard/ocorrencias-por-dia-hora",
  "/dashboard/proximas-acoes-por-dia",
  "/dashboard/acoes-definidas",
  "/dashboard/atendentes-proxima-acao",
]

describe("swagger spec — nova documentacao", () => {
  describe("rotas de fiadores", () => {
    it("registra a tag Fiadores", () => {
      const tags = swaggerSpec.tags.map((t: any) => t.name)
      expect(tags).toContain("Fiadores")
    })

    it("documenta GET /fiadores/num-venda/{numVenda}", () => {
      const path = swaggerSpec.paths["/fiadores/num-venda/{numVenda}"]
      expect(path).toBeDefined()
      expect(path.get.tags).toContain("Fiadores")
      expect(path.get.parameters).toBeDefined()
      expect(path.get.parameters[0].name).toBe("numVenda")
    })

    it("documenta GET /fiadores/cpf/{cpf}", () => {
      const path = swaggerSpec.paths["/fiadores/cpf/{cpf}"]
      expect(path).toBeDefined()
      expect(path.get.tags).toContain("Fiadores")
      expect(path.get.parameters[0].name).toBe("cpf")
    })
  })

  describe("filtro dataInicio/dataFim nos 9 endpoints de ocorrencias", () => {
    it.each(FILTERED_ENDPOINTS)("%s declara dataInicio e dataFim", (endpoint) => {
      const path = swaggerSpec.paths[endpoint]
      expect(path).toBeDefined()
      const params = path.get.parameters ?? []
      const names = params.map((p: any) => p.name)
      expect(names).toContain("dataInicio")
      expect(names).toContain("dataFim")
      const dataInicio = params.find((p: any) => p.name === "dataInicio")
      expect(dataInicio.schema.format).toBe("date")
    })
  })

  describe("script de ocorrencia 'Alteração de Data'", () => {
    it("POST /ocorrencias expoe enum de STATUS_OCORRENCIA incluindo 'Alteração de Data'", () => {
      const post = swaggerSpec.paths["/ocorrencias"].post
      const schema = post.requestBody.content["application/json"].schema
      const enumValues = schema.properties.STATUS_OCORRENCIA.enum
      expect(enumValues).toContain("Alteração de Data")
      expect(enumValues).toContain("Promessa de pagamento")
      expect(enumValues).toContain("Aguardando Assinatura")
    })

    it("PUT /ocorrencias/{id} reutiliza o mesmo enum", () => {
      const put = swaggerSpec.paths["/ocorrencias/{id}"].put
      const schema = put.requestBody.content["application/json"].schema
      const enumValues = schema.properties.STATUS_OCORRENCIA.enum
      expect(enumValues).toContain("Alteração de Data")
    })
  })
})
