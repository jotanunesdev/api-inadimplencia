import { env } from "./config/env"
import { createStandaloneApp } from "./standaloneApp"

createStandaloneApp()
  .then((app) => {
    app.listen(env.PORT, () => {
      console.log(`API rodando em http://localhost:${env.PORT}`)
    })
  })
  .catch((error) => {
    console.error("Falha ao iniciar o modulo treinamento:", error)
    process.exit(1)
  })
