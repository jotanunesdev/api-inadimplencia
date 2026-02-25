import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  generateNormaExpiryNotifications,
  listNormaExpiryNotifications,
  markNormaExpiryNotificationAsRead,
  type NotificationStatusFilter,
} from "../models/notificationModel"

function parseStatusFilter(raw: unknown): NotificationStatusFilter {
  const value = String(raw ?? "").trim().toLowerCase()
  if (!value) return "pendente"

  if (value === "pendente" || value === "lida" || value === "todas") {
    return value
  }

  throw new HttpError(400, "status invalido. Use: pendente, lida ou todas")
}

function parseLookaheadDays(raw: unknown) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return 7
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new HttpError(400, "lookaheadDays invalido")
  }

  return Math.trunc(parsed)
}

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { status, lookaheadDays } = req.query as {
    status?: string
    lookaheadDays?: string
  }

  const parsedStatus = parseStatusFilter(status)
  const parsedLookahead = parseLookaheadDays(lookaheadDays)
  const generated = await generateNormaExpiryNotifications(parsedLookahead)
  const notifications = await listNormaExpiryNotifications(parsedStatus)

  res.json({ notifications, generated })
})

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id
  if (!GUID_REGEX.test(id)) {
    throw new HttpError(400, "id invalido")
  }

  const updated = await markNormaExpiryNotificationAsRead(id, true)
  if (!updated) {
    throw new HttpError(404, "Notificacao nao encontrada")
  }

  res.status(204).send()
})

export const markAsUnread = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id
  if (!GUID_REGEX.test(id)) {
    throw new HttpError(400, "id invalido")
  }

  const updated = await markNormaExpiryNotificationAsRead(id, false)
  if (!updated) {
    throw new HttpError(404, "Notificacao nao encontrada")
  }

  res.status(204).send()
})
