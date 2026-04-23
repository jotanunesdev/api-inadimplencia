import { describe, it, expect, vi } from "vitest"

describe("turmaController.ts - File Cleanup Robusto (Tarefa 3.0)", () => {
  describe("Validação da Implementação", () => {
    it("deve verificar que useSharePoint é capturado no início da função", () => {
      // Este teste documenta que a implementação captura o estado do SharePoint no início
      // Verificamos a estrutura do código através da leitura do arquivo
      const fs = require("fs")
      const path = require("path")
      const controllerPath = path.join(__dirname, "turmaController.ts")
      const content = fs.readFileSync(controllerPath, "utf-8")

      // Verificar que useSharePoint é definido antes do try
      const hasCapturedStateBeforeTry = 
        /const useSharePoint = isSharePointEnabled\(\)\s*\n\s*try/.test(content) ||
        /const useSharePoint = isSharePointEnabled\(\)\s*\n\s*\/\/ Capturar estado inicial/.test(content)

      expect(hasCapturedStateBeforeTry).toBe(true)
    })

    it("deve verificar que o cleanup no catch usa useSharePoint capturado", () => {
      const fs = require("fs")
      const path = require("path")
      const controllerPath = path.join(__dirname, "turmaController.ts")
      const content = fs.readFileSync(controllerPath, "utf-8")

      // Verificar que no catch usa !useSharePoint e não chama isSharePointEnabled()
      const catchBlockUsesCapturedState = 
        /catch[\s\S]*?if \(!useSharePoint\)/.test(content)

      expect(catchBlockUsesCapturedState).toBe(true)
    })

    it("deve verificar que o cleanup no finally tem log de falha", () => {
      const fs = require("fs")
      const path = require("path")
      const controllerPath = path.join(__dirname, "turmaController.ts")
      const content = fs.readFileSync(controllerPath, "utf-8")

      // Verificar que o finally tem .catch com log
      const finallyHasLogOnFailure = 
        /finally[\s\S]*?\.catch\(\(err\) => \{\s*console\.warn\(\{[\s\S]*?event: "CLEANUP_TEMP_FILE_FAILED"/.test(content)

      expect(finallyHasLogOnFailure).toBe(true)
    })

    it("deve verificar que o cleanup no catch tem log de falha", () => {
      const fs = require("fs")
      const path = require("path")
      const controllerPath = path.join(__dirname, "turmaController.ts")
      const content = fs.readFileSync(controllerPath, "utf-8")

      // Verificar que o catch tem log de falha para arquivos movidos
      const catchHasLogOnFailure = 
        /catch[\s\S]*?CLEANUP_FILE_FAILED/.test(content)

      expect(catchHasLogOnFailure).toBe(true)
    })

    it("deve verificar que existe comentário explicando a captura de estado", () => {
      const fs = require("fs")
      const path = require("path")
      const controllerPath = path.join(__dirname, "turmaController.ts")
      const content = fs.readFileSync(controllerPath, "utf-8")

      // Verificar que existe comentário explicativo
      const hasComment = 
        /Capturar estado inicial do SharePoint para decisão de cleanup determinística/.test(content) ||
        /Usar estado capturado/.test(content)

      expect(hasComment).toBe(true)
    })
  })
})
