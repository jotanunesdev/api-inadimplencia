import express from "express"
import app from "./app"

const { createTreinamentoModule } = require("./index")

export async function createStandaloneApp() {
  const root = express()
  const treinamentoModule = await createTreinamentoModule()

  root.use(express.json({ limit: "10mb" }))
  root.use("/treinamento", treinamentoModule.router)
  root.use("/", app)

  return root
}
