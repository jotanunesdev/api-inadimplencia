import type { NextFunction, Request, Response } from "express"
import multer from "multer"
import { env } from "../config/env"
import { HttpError } from "../utils/httpError"

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: `Arquivo maior que o limite permitido (${env.UPLOAD_MAX_FILE_SIZE_MB} MB)`,
      })
      return
    }

    res.status(400).json({ error: `Erro no upload: ${err.message}` })
    return
  }

  const error = err instanceof HttpError ? err : null
  const status = error?.status ?? 500
  const message = error?.message ?? "Erro interno do servidor"

  if (status >= 500) {
    console.error(err)
  }

  res.status(status).json({ error: message })
}
