import dotenv from "dotenv"

dotenv.config()

const envSource: Record<string, string> = {}

for (const [key, value] of Object.entries(process.env)) {
  if (!key.startsWith("TREIN_") || value === undefined) {
    continue
  }

  const cleanKey = key.slice("TREIN_".length)
  if (!cleanKey) {
    continue
  }

  envSource[cleanKey] = value
}

function requireEnv(name: string, fallback?: string) {
  const value = envSource[name] ?? fallback
  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

function parsePositiveNumber(name: string, fallback: number) {
  const raw = envSource[name]
  if (raw === undefined || raw === "") {
    return fallback
  }

  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid environment variable: ${name}`)
  }

  return value
}

export const env = {
  NODE_ENV: envSource.NODE_ENV ?? "development",
  PORT: Number(envSource.PORT ?? 4000),
  UPLOAD_MAX_FILE_SIZE_MB: parsePositiveNumber("UPLOAD_MAX_FILE_SIZE_MB", 1024),
  SP_UPLOAD_CHUNK_MB: parsePositiveNumber("SP_UPLOAD_CHUNK_MB", 20),
  CORS_ORIGIN: envSource.CORS_ORIGIN ?? "*",
  CORS_ORIGINS: (envSource.CORS_ORIGIN ?? "*")
    .split(",")
    .map((origin) => origin.trim().toLowerCase())
    .filter(Boolean),
  CORS_ALLOW_ALL: (envSource.CORS_ORIGIN ?? "*")
    .split(",")
    .map((origin) => origin.trim().toLowerCase())
    .filter(Boolean)
    .includes("*"),
  DB_SERVER: requireEnv("DB_SERVER"),
  DB_PORT: Number(envSource.DB_PORT ?? 1433),
  DB_DATABASE: requireEnv("DB_DATABASE"),
  DB_USER: requireEnv("DB_USER"),
  DB_PASSWORD: requireEnv("DB_PASSWORD"),
  DB_ENCRYPT: (envSource.DB_ENCRYPT ?? "false").toLowerCase() === "true",
  DB_TRUST_CERT: (envSource.DB_TRUST_CERT ?? "true").toLowerCase() === "true",
  PUBLIC_ASSETS_ROOT:
    envSource.PUBLIC_ASSETS_ROOT ??
    "C:\\gestao-trienamento\\gestao-treinamento\\public",
  READVIEW_URL: requireEnv("READVIEW_URL"),
  READVIEW_USER: requireEnv("READVIEW_USER"),
  READVIEW_PASSWORD: requireEnv("READVIEW_PASSWORD"),
  READVIEW_ACTION: envSource.READVIEW_ACTION,
  READVIEW_NAMESPACE: envSource.READVIEW_NAMESPACE ?? "http://www.totvs.com/",
  SHAREPOINT_ENABLED:
    (envSource.SHAREPOINT_ENABLED ?? "false").toLowerCase() === "true",
  SHAREPOINT_TENANT_ID: envSource.SP_TENANT_ID,
  SHAREPOINT_CLIENT_ID: envSource.SP_CLIENT_ID,
  SHAREPOINT_CLIENT_SECRET: envSource.SP_CLIENT_SECRET,
  SHAREPOINT_SITE_URL: envSource.SP_SITE_URL,
  SHAREPOINT_LIBRARY_NAME:
    envSource.SP_LIBRARY_NAME ?? "Documentos Compartilhados",
  SHAREPOINT_ROOT_FOLDER: envSource.SP_ROOT_FOLDER ?? "Treinamento",
}
