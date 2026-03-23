import type { Request, Response } from "express"
import { asyncHandler } from "../utils/asyncHandler"
import { HttpError } from "../utils/httpError"
import {
  createProfileMessage,
  getProfileMessageById,
  listProfileMessages,
  setProfileMessageReaction,
  type ProfileMessageReactionType,
} from "../models/profileMessageModel"
import { createProfileNotification } from "../models/profileNotificationModel"
import { broadcastProfileNotificationSnapshot } from "../services/profileNotificationRealtime"

const normalizeUsername = (value: string | null | undefined) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .split("@")[0]
    ?.trim() ?? ""

async function broadcastNotificationRecipients(usernames: Array<string | null | undefined>) {
  const recipients = Array.from(
    new Set(usernames.map((value) => normalizeUsername(value)).filter(Boolean)),
  )

  await Promise.all(
    recipients.map((username) =>
      broadcastProfileNotificationSnapshot(username).catch(() => {}),
    ),
  )
}

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  const profileUsername = normalizeUsername(String(req.query.profileUsername ?? ""))
  const viewerUsername = normalizeUsername(String(req.query.viewerUsername ?? ""))

  if (!profileUsername) {
    throw new HttpError(400, "profileUsername e obrigatorio")
  }

  const messages = await listProfileMessages({
    profileUsername,
    viewerUsername,
  })

  res.json({ messages })
})

export const postMessage = asyncHandler(async (req: Request, res: Response) => {
  const {
    authorJobTitle,
    authorName,
    authorUsername,
    content,
    parentId,
    profileUsername,
  } = (req.body ?? {}) as {
    authorJobTitle?: string | null
    authorName?: string | null
    authorUsername?: string | null
    content?: string | null
    parentId?: string | null
    profileUsername?: string | null
  }

  const normalizedProfileUsername = normalizeUsername(profileUsername)
  const normalizedAuthorUsername = normalizeUsername(authorUsername)
  const normalizedContent = String(content ?? "").trim()
  const normalizedParentId = String(parentId ?? "").trim() || null

  if (!normalizedProfileUsername) {
    throw new HttpError(400, "profileUsername e obrigatorio")
  }

  if (!normalizedAuthorUsername) {
    throw new HttpError(400, "authorUsername e obrigatorio")
  }

  if (!normalizedContent) {
    throw new HttpError(400, "content e obrigatorio")
  }

  if (normalizedContent.length > 4000) {
    throw new HttpError(400, "content excede o limite de 4000 caracteres")
  }

  try {
    const id = await createProfileMessage({
      authorJobTitle,
      authorName,
      authorUsername: normalizedAuthorUsername,
      content: normalizedContent,
      parentId: normalizedParentId,
      profileUsername: normalizedProfileUsername,
    })

    const recipientsToBroadcast = new Set<string>()

    const profileNotification = await createProfileNotification({
      authorJobTitle,
      authorName,
      authorUsername: normalizedAuthorUsername,
      messageId: id,
      messageParentId: normalizedParentId,
      recipientUsername: normalizedProfileUsername,
      targetProfileUsername: normalizedProfileUsername,
      type: normalizedParentId ? "reply" : "new_message",
    })

    if (profileNotification) {
      recipientsToBroadcast.add(profileNotification.profileUsername)
    }

    if (normalizedParentId) {
      const parentMessage = await getProfileMessageById(normalizedParentId)
      const parentAuthorUsername = normalizeUsername(parentMessage?.authorUsername)

      if (
        parentAuthorUsername &&
        parentAuthorUsername !== normalizedProfileUsername
      ) {
        const authorMessageNotification = await createProfileNotification({
          authorJobTitle,
          authorName,
          authorUsername: normalizedAuthorUsername,
          messageId: id,
          messageParentId: normalizedParentId,
          recipientUsername: parentAuthorUsername,
          targetProfileUsername: normalizedProfileUsername,
          type: "message_reply",
        })

        if (authorMessageNotification) {
          recipientsToBroadcast.add(authorMessageNotification.profileUsername)
        }
      }
    }

    if (recipientsToBroadcast.size > 0) {
      void broadcastNotificationRecipients(Array.from(recipientsToBroadcast))
    }

    res.status(201).json({ id })
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PROFILE_MESSAGE_PARENT_NOT_FOUND"
    ) {
      throw new HttpError(404, "Mensagem pai nao encontrada para este perfil")
    }

    throw error
  }
})

export const reactToMessage = asyncHandler(async (req: Request, res: Response) => {
  const messageId = String(req.params.id ?? "").trim()
  const username = normalizeUsername(String(req.body?.username ?? ""))
  const reactionValue = String(req.body?.reaction ?? "")
    .trim()
    .toLowerCase()

  if (!messageId) {
    throw new HttpError(400, "id da mensagem e obrigatorio")
  }

  if (!username) {
    throw new HttpError(400, "username e obrigatorio")
  }

  let reaction: ProfileMessageReactionType | null = null
  if (reactionValue) {
    if (reactionValue !== "like" && reactionValue !== "dislike") {
      throw new HttpError(400, "reaction invalida")
    }

    reaction = reactionValue
  }

  const message = await getProfileMessageById(messageId)
  if (!message) {
    throw new HttpError(404, "Mensagem nao encontrada")
  }

  await setProfileMessageReaction({
    messageId,
    reaction,
    username,
  })

  if (reaction === "like") {
    const notification = await createProfileNotification({
      authorUsername: username,
      messageId: message.id,
      messageParentId: message.parentId,
      recipientUsername: message.authorUsername,
      targetProfileUsername: message.profileUsername,
      type: "message_like",
    })

    if (notification) {
      void broadcastNotificationRecipients([notification.profileUsername])
    }
  }

  res.status(204).send()
})
