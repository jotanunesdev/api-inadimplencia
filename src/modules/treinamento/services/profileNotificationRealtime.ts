import type { Request, Response } from "express"
import { getProfileNotificationSnapshot } from "../models/profileNotificationModel"

const STREAM_RETRY_MS = 3000
const STREAM_HEARTBEAT_MS = 15000
const STREAM_EVENT_NAME = "profile-notifications.snapshot"

const listenersByUsername = new Map<string, Set<Response>>()

const normalizeUsername = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    ?.trim() ?? ""

function serializeSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function addListener(username: string, response: Response) {
  const listeners = listenersByUsername.get(username) ?? new Set<Response>()
  listeners.add(response)
  listenersByUsername.set(username, listeners)
}

function removeListener(username: string, response: Response) {
  const listeners = listenersByUsername.get(username)
  if (!listeners) {
    return
  }

  listeners.delete(response)
  if (listeners.size === 0) {
    listenersByUsername.delete(username)
  }
}

export async function broadcastProfileNotificationSnapshot(username: string) {
  const normalizedUsername = normalizeUsername(username)
  const listeners = listenersByUsername.get(normalizedUsername)

  if (!normalizedUsername || !listeners?.size) {
    return
  }

  const snapshot = await getProfileNotificationSnapshot({
    username: normalizedUsername,
  })
  const message = serializeSseEvent(STREAM_EVENT_NAME, snapshot)

  listeners.forEach((response) => {
    try {
      response.write(message)
    } catch {
      removeListener(normalizedUsername, response)
    }
  })
}

export async function openProfileNotificationStream(
  request: Request,
  response: Response,
  username: string,
) {
  const normalizedUsername = normalizeUsername(username)

  response.status(200)
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8")
  response.setHeader("Cache-Control", "no-cache, no-transform")
  response.setHeader("Connection", "keep-alive")
  response.setHeader("X-Accel-Buffering", "no")
  response.flushHeaders?.()
  response.write(`retry: ${STREAM_RETRY_MS}\n\n`)

  let isClosed = false

  const pushSnapshot = async () => {
    const snapshot = await getProfileNotificationSnapshot({
      username: normalizedUsername,
    })

    if (!isClosed) {
      response.write(serializeSseEvent(STREAM_EVENT_NAME, snapshot))
    }
  }

  addListener(normalizedUsername, response)
  await pushSnapshot()

  const heartbeatInterval = setInterval(() => {
    if (!isClosed) {
      response.write(": ping\n\n")
    }
  }, STREAM_HEARTBEAT_MS)

  heartbeatInterval.unref?.()

  const closeStream = () => {
    if (isClosed) {
      return
    }

    isClosed = true
    clearInterval(heartbeatInterval)
    removeListener(normalizedUsername, response)
    response.end()
  }

  request.on("close", closeStream)
  request.on("aborted", closeStream)
}
