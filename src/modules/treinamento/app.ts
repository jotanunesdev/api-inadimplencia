import express from "express"
import path from "path"
import cors from "cors"
import swaggerUi from "swagger-ui-express"
import routes from "./routes"
import { env } from "./config/env"
import openapi from "./docs/openapi"
import { errorHandler } from "./middlewares/errorHandler"
import { notFound } from "./middlewares/notFound"

const app = express()

function isLocalhostOrigin(origin: string) {
  return (
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1") ||
    origin.startsWith("http://[::1]")
  )
}

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      callback(null, false)
      return
    }

    if (env.CORS_ALLOW_ALL) {
      callback(null, true)
      return
    }

    const normalized = origin.toLowerCase()
    const isLocalhost = isLocalhostOrigin(normalized)

    if (env.CORS_ORIGINS.includes(normalized) || (env.NODE_ENV !== "production" && isLocalhost)) {
      callback(null, true)
      return
    }

    callback(null, false)
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}

app.use(cors(corsOptions))
app.options("*", cors(corsOptions))
app.use((req, res, next) => {
  const origin = String(req.headers.origin ?? "").trim().toLowerCase()

  if (!origin) {
    res.status(403).json({ error: "Origem nao permitida." })
    return
  }

  if (
    env.CORS_ALLOW_ALL ||
    env.CORS_ORIGINS.includes(origin) ||
    (env.NODE_ENV !== "production" && isLocalhostOrigin(origin))
  ) {
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
