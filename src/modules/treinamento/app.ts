import express from "express"
import path from "path"
import cors from "cors"
import swaggerUi from "swagger-ui-express"
import routes from "./routes"
import { env } from "./config/env"
import openapi from "./docs/openapi"
import { errorHandler } from "./middlewares/errorHandler"
import { notFound } from "./middlewares/notFound"
const { createCorsOptionsDelegate, isRequestAllowed } = require("../../shared/swaggerAccess")

const app = express()

const corsOptions = createCorsOptionsDelegate(env)

app.use(cors(corsOptions))
app.options("*", cors(corsOptions))
app.use((req, res, next) => {
  if (isRequestAllowed(req, env)) {
    next()
    return
  }

  res.status(403).json({ error: "Origem nao permitida." })
})
app.use(express.json({ limit: "10mb" }))

app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

app.use("/api", routes)
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi))
app.get("/api/docs.json", (_req, res) => res.json(openapi))

const publicRoot = path.resolve(env.PUBLIC_ASSETS_ROOT)
app.use(express.static(publicRoot))

app.use(notFound)
app.use(errorHandler)

export default app
