import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.js"],
    exclude: [
      "node_modules",
      "dist",
      "src/modules/inadimplencia/controllers/notificationsController.test.js",
      "src/modules/inadimplencia/controllers/ocorrenciasController.test.js",
      "src/modules/inadimplencia/controllers/responsavelController.test.js",
      "src/modules/inadimplencia/controllers/serasaPefinController.test.js",
      "src/modules/inadimplencia/models/kanbanStatusModel.test.js",
      "src/modules/inadimplencia/models/notificationsModel.test.js",
      "src/modules/inadimplencia/models/notificationsRepository.test.js",
      "src/modules/inadimplencia/serasaPefin.integration.test.js",
      "src/modules/inadimplencia/services/notificationService.test.js",
      "src/modules/inadimplencia/services/notificationsSmoke.test.js",
      "src/modules/inadimplencia/services/overdueScanner.test.js",
      "src/modules/inadimplencia/services/responsavelAssignmentService.test.js",
      "src/modules/inadimplencia/services/sseHub.test.js",
      "src/modules/inadimplencia/services/serasaPefinService.test.js",
      "src/modules/inadimplencia/services/serasaPefinHttpClient.test.js",
      "src/modules/inadimplencia/services/serasaPefinPayloadBuilder.test.js",
      "src/modules/inadimplencia/models/serasaPefinModel.test.js",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
})
