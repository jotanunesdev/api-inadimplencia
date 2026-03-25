import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  createPlatformAccessAuditEntry,
  listPlatformAccessAuditEntries,
} from "../models/platformAccessAuditModel"

function parseLimit(raw: unknown) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return 100
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new HttpError(400, "limit invalido")
  }

  return Math.trunc(parsed)
}

function parseAccessedAt(raw: unknown) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return new Date()
  }

  const parsedDate = new Date(String(raw))
  if (Number.isNaN(parsedDate.getTime())) {
    throw new HttpError(400, "accessedAt invalido")
  }

  return parsedDate
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const limit = parseLimit(req.query.limit)
  const entries = await listPlatformAccessAuditEntries(limit)

  res.json({ entries })
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    accessedAt?: string
    department?: string
    displayName?: string
    email?: string
    username?: string
  }

  const username = String(body?.username ?? "").trim()
  if (!username) {
    throw new HttpError(400, "username e obrigatorio")
  }

  const entry = await createPlatformAccessAuditEntry({
    accessedAt: parseAccessedAt(body?.accessedAt),
    department: body?.department ?? null,
    displayName: body?.displayName ?? null,
    email: body?.email ?? null,
    username,
  })

  res.status(201).json({ entry })
})
