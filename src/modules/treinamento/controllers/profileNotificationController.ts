import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  getProfileNotificationSnapshot,
  markAllProfileNotificationsAsRead,
  setProfileNotificationReadState,
  type ProfileNotificationStatusFilter,
} from "../models/profileNotificationModel"
import {
  broadcastProfileNotificationSnapshot,
  openProfileNotificationStream,
} from "../services/profileNotificationRealtime"

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

const normalizeUsername = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    ?.trim() ?? ""

function parseStatusFilter(raw: unknown): ProfileNotificationStatusFilter {
  const value = String(raw ?? "").trim().toLowerCase()
  if (!value) return "todas"

  if (value === "pendente" || value === "lida" || value === "todas") {
    return value
  }

  throw new HttpError(400, "status invalido. Use: pendente, lida ou todas")
}

function parseLimit(raw: unknown) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return 10
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new HttpError(400, "limit invalido")
  }

  return Math.trunc(parsed)
}

function readUsernameFromRequest(req: Request) {
  return normalizeUsername(
    String(req.query.username ?? req.body?.username ?? ""),
  )
}

export const listProfileFeedNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const username = readUsernameFromRequest(req)
    const status = parseStatusFilter(req.query.status)
    const limit = parseLimit(req.query.limit)

    if (!username) {
      throw new HttpError(400, "username e obrigatorio")
    }

    const snapshot = await getProfileNotificationSnapshot({
      username,
      status,
      limit,
    })

    res.json(snapshot)
  },
)

export const streamProfileFeedNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const username = readUsernameFromRequest(req)

    if (!username) {
      throw new HttpError(400, "username e obrigatorio")
    }

    await openProfileNotificationStream(req, res, username)
  },
)

export const markProfileFeedNotificationAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim()
    const username = readUsernameFromRequest(req)

    if (!GUID_REGEX.test(id)) {
      throw new HttpError(400, "id invalido")
    }

    if (!username) {
      throw new HttpError(400, "username e obrigatorio")
    }

    const updated = await setProfileNotificationReadState({
      id,
      read: true,
      username,
    })

    if (!updated) {
      throw new HttpError(404, "Notificacao nao encontrada")
    }

    await broadcastProfileNotificationSnapshot(username)
    res.status(204).send()
  },
)

export const markAllProfileFeedNotificationsAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    const username = readUsernameFromRequest(req)

    if (!username) {
      throw new HttpError(400, "username e obrigatorio")
    }

    await markAllProfileNotificationsAsRead(username)
    await broadcastProfileNotificationSnapshot(username)
    res.status(204).send()
  },
)
